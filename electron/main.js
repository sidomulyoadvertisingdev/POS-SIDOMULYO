const { app, BrowserWindow, dialog, nativeImage } = require('electron');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const { UpdateManager, VelopackApp } = require('velopack');
const {
  autoCheckDelayMs,
  isAutoUpdateEnabled,
  updateSourceUrl,
} = require('./update-config');

VelopackApp.build()
  .setAutoApplyOnStartup(true)
  .setLogger((level, message) => {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[velopack:${level}] ${message}`);
    }
  })
  .run();

const iconPath = path.join(__dirname, '..', 'assets', 'iconsm.ico');

const getCandidateAppRoots = () => {
  const candidates = [
    path.resolve(__dirname, '..'),
    app.getAppPath(),
    path.join(process.resourcesPath, 'app.asar'),
    process.resourcesPath,
    path.join(path.dirname(process.execPath), 'resources', 'app.asar'),
    path.join(path.dirname(process.execPath), 'resources'),
  ].filter(Boolean);

  return [...new Set(candidates.map((candidate) => path.resolve(candidate)))];
};

const resolveDistPaths = () => {
  for (const appRootPath of getCandidateAppRoots()) {
    const distDirPath = path.join(appRootPath, 'dist-web');
    const distIndexPath = path.join(distDirPath, 'index.html');

    if (fs.existsSync(distIndexPath)) {
      return {
        appRootPath,
        distDirPath,
        distIndexPath,
      };
    }
  }

  const fallbackRoot = path.resolve(__dirname, '..');
  return {
    appRootPath: fallbackRoot,
    distDirPath: path.join(fallbackRoot, 'dist-web'),
    distIndexPath: path.join(fallbackRoot, 'dist-web', 'index.html'),
  };
};

const { distDirPath, distIndexPath } = resolveDistPaths();

const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mp3': 'audio/mpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

let localServer = null;
let updateCheckStarted = false;

const sendJson = (response, statusCode, payload) => {
  response.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(payload));
};

const sanitizePathSegment = (value, fallback = 'lainnya') => {
  const text = String(value || '')
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, ' ');
  return text || fallback;
};

const normalizePathParts = (value) => String(value || '')
  .split(/[\\/]+/)
  .map((part) => sanitizePathSegment(part, ''))
  .filter(Boolean);

const buildRelativeDesignFolder = (settings = {}, metadata = {}) => {
  const now = new Date();
  const tokens = {
    yyyy: String(now.getFullYear()),
    mm: String(now.getMonth() + 1).padStart(2, '0'),
    dd: String(now.getDate()).padStart(2, '0'),
    invoice: sanitizePathSegment(metadata.invoiceNo, 'tanpa-invoice'),
    material: sanitizePathSegment(metadata.material, 'bahan-lain'),
    priority: sanitizePathSegment(metadata.priority, 'regular'),
  };
  const template = String(settings.folderTemplate || '{yyyy}\\{mm}\\{dd}\\{material}\\{priority}');
  const resolved = template.replace(/\{(yyyy|mm|dd|invoice|material|priority)\}/g, (_match, token) => tokens[token] || '');
  return normalizePathParts(resolved).join(path.sep);
};

const joinShareUrl = (baseUrl, relativePath, fileName) => {
  const base = String(baseUrl || '').trim();
  if (!base) return '';
  const suffix = [...normalizePathParts(relativePath), sanitizePathSegment(fileName, 'design-file')]
    .join(base.includes('\\') ? '\\' : '/');
  const separator = base.endsWith('\\') || base.endsWith('/') ? '' : (base.includes('\\') ? '\\' : '/');
  return `${base}${separator}${suffix}`;
};

const handleLocalDesignSave = (request, response) => {
  if (request.method !== 'POST') {
    sendJson(response, 405, { message: 'Method tidak didukung.' });
    return;
  }

  let metadata = {};
  try {
    metadata = JSON.parse(Buffer.from(String(request.headers['x-design-metadata'] || ''), 'base64').toString('utf8'));
  } catch (_error) {
    metadata = {};
  }

  const settings = metadata.settings && typeof metadata.settings === 'object' ? metadata.settings : {};
  if (settings.enabled === false) {
    sendJson(response, 422, { message: 'Storage lokal file produksi belum aktif di setting POS.' });
    return;
  }

  const rootPath = String(settings.rootPath || 'D:\\file siap layout').trim();
  const headerFileName = String(request.headers['x-design-file-name'] || metadata.fileName || 'design-file').trim();
  const decodedFileName = (() => {
    try {
      return decodeURIComponent(headerFileName);
    } catch (_error) {
      return headerFileName;
    }
  })();
  const originalName = sanitizePathSegment(decodedFileName, 'design-file');
  const relativeFolder = buildRelativeDesignFolder(settings, metadata);
  const targetFolder = path.resolve(rootPath, relativeFolder);
  const targetPath = path.join(targetFolder, originalName);
  const relativePath = [...normalizePathParts(relativeFolder), originalName].join('/');

  try {
    fs.mkdirSync(targetFolder, { recursive: true });
  } catch (error) {
    sendJson(response, 500, {
      message: `Gagal membuat folder produksi lokal: ${error.message}`,
    });
    return;
  }

  const output = fs.createWriteStream(targetPath);
  let writtenBytes = 0;
  request.on('data', (chunk) => {
    writtenBytes += chunk.length;
  });
  request.pipe(output);
  output.on('finish', () => {
    sendJson(response, 200, {
      message: 'File produksi tersimpan di storage lokal.',
      storage: 'local_server',
      design_original_name: originalName,
      design_file_name: originalName,
      design_file_size: writtenBytes,
      design_mime_type: String(request.headers['content-type'] || metadata.mimeType || ''),
      design_relative_path: relativePath,
      design_open_url: joinShareUrl(settings.shareBaseUrl, relativeFolder, originalName),
      design_share_folder: String(settings.shareFolder || 'file siap layout'),
      design_root_path: rootPath,
      design_server_name: String(settings.serverName || ''),
      design_server_host: String(settings.serverHost || ''),
      design_share_base_url: String(settings.shareBaseUrl || ''),
      layout_file_path: targetPath,
      workstation_name: os.hostname(),
    });
  });
  output.on('error', (error) => {
    sendJson(response, 500, {
      message: `Gagal menyimpan file produksi lokal: ${error.message}`,
    });
  });
};

const readJsonRequestBody = (request) => new Promise((resolve) => {
  const chunks = [];
  request.on('data', (chunk) => chunks.push(chunk));
  request.on('end', () => {
    try {
      const text = Buffer.concat(chunks).toString('utf8');
      resolve(text ? JSON.parse(text) : {});
    } catch (_error) {
      resolve({});
    }
  });
  request.on('error', () => resolve({}));
});

const handleLocalDesignTest = async (request, response) => {
  if (request.method !== 'POST') {
    sendJson(response, 405, { message: 'Method tidak didukung.' });
    return;
  }

  const payload = await readJsonRequestBody(request);
  const settings = payload?.settings && typeof payload.settings === 'object' ? payload.settings : {};
  if (settings.enabled === false) {
    sendJson(response, 422, {
      ok: false,
      message: 'Sambungan jaringan lokal sedang nonaktif di setting aplikasi.',
      checks: [],
    });
    return;
  }

  const rootPath = String(settings.rootPath || 'D:\\file siap layout').trim();
  const shareBaseUrl = String(settings.shareBaseUrl || '').trim();
  const checks = [];
  let ok = true;

  try {
    fs.mkdirSync(rootPath, { recursive: true });
    const testFilePath = path.join(rootPath, `.sidomulyo-pos-network-test-${Date.now()}.txt`);
    fs.writeFileSync(testFilePath, `SIDOMULYO POS network test ${new Date().toISOString()}`);
    fs.accessSync(testFilePath, fs.constants.R_OK | fs.constants.W_OK);
    fs.unlinkSync(testFilePath);
    checks.push({
      key: 'root_path',
      ok: true,
      label: 'Root folder lokal',
      message: `Bisa membuat dan menulis file test di ${rootPath}.`,
    });
  } catch (error) {
    ok = false;
    checks.push({
      key: 'root_path',
      ok: false,
      label: 'Root folder lokal',
      message: `Gagal akses/tulis root folder ${rootPath}: ${error.message}`,
    });
  }

  if (shareBaseUrl) {
    if (/^https?:\/\//i.test(shareBaseUrl)) {
      checks.push({
        key: 'share_path',
        ok: true,
        label: 'Path share LAN',
        message: 'Path share berupa URL HTTP/HTTPS. Akses file akan dicoba saat link dibuka.',
      });
    } else {
      try {
        fs.accessSync(shareBaseUrl, fs.constants.R_OK);
        checks.push({
          key: 'share_path',
          ok: true,
          label: 'Path share LAN',
          message: `Path share bisa dibaca dari komputer ini: ${shareBaseUrl}.`,
        });
      } catch (error) {
        ok = false;
        checks.push({
          key: 'share_path',
          ok: false,
          label: 'Path share LAN',
          message: `Path share belum bisa diakses dari komputer ini: ${error.message}`,
        });
      }
    }
  } else {
    ok = false;
    checks.push({
      key: 'share_path',
      ok: false,
      warning: true,
      label: 'Path share LAN',
      message: 'Path share LAN belum diisi. Komputer lain belum punya alamat untuk membuka file.',
    });
  }

  sendJson(response, ok ? 200 : 422, {
    ok,
    message: ok ? 'Sambungan jaringan lokal siap dipakai.' : 'Sambungan jaringan lokal belum siap.',
    workstation_name: os.hostname(),
    root_path: rootPath,
    share_base_url: shareBaseUrl,
    checks,
  });
};

const toSafeAssetPath = (requestUrl) => {
  const pathname = decodeURIComponent(new URL(requestUrl, 'http://127.0.0.1').pathname);
  const normalized = path.normalize(pathname).replace(/^(\.\.[\\/])+/, '');
  const relative = normalized.replace(/^([\\/]+)/, '');
  return path.join(distDirPath, relative);
};

const createLocalServer = () => new Promise((resolve, reject) => {
  const server = http.createServer((request, response) => {
    if ((request.url || '').startsWith('/__local-design/save')) {
      handleLocalDesignSave(request, response);
      return;
    }
    if ((request.url || '').startsWith('/__local-design/test')) {
      handleLocalDesignTest(request, response);
      return;
    }

    const targetPath = toSafeAssetPath(request.url || '/');
    const fallbackToIndex = () => {
      fs.readFile(distIndexPath, (indexError, indexContent) => {
        if (indexError) {
          console.error('[desktop] gagal membaca index build:', distIndexPath, indexError);
          response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
          response.end('Gagal memuat aplikasi desktop.');
          return;
        }

        response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        response.end(indexContent);
      });
    };

    fs.stat(targetPath, (statError, stats) => {
      if (statError || !stats.isFile()) {
        fallbackToIndex();
        return;
      }

      const extension = path.extname(targetPath).toLowerCase();
      const contentType = MIME_TYPES[extension] || 'application/octet-stream';
      response.writeHead(200, { 'Content-Type': contentType });
      fs.createReadStream(targetPath).pipe(response);
    });
  });

  server.on('error', reject);
  server.listen(0, '127.0.0.1', () => resolve(server));
});

const createMainWindow = async () => {
  const icon = nativeImage.createFromPath(iconPath);
  localServer = await createLocalServer();
  const address = localServer.address();
  const appUrl = `http://127.0.0.1:${address.port}`;
  const mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 720,
    autoHideMenuBar: true,
    title: 'POS Kasir',
    icon: icon.isEmpty() ? undefined : icon,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.loadURL(appUrl);
  return mainWindow;
};

const canUseAutoUpdate = () => (
  process.platform === 'win32'
  && app.isPackaged
  && isAutoUpdateEnabled
  && Boolean(updateSourceUrl)
);

const createUpdateManager = () => {
  if (!canUseAutoUpdate()) {
    return null;
  }

  return new UpdateManager(updateSourceUrl);
};

const promptToRestartForUpdate = async (mainWindow, updateManager, updateInfo) => {
  const version = String(
    updateInfo?.TargetFullRelease?.Version
    || updateInfo?.Version
    || ''
  ).trim();

  const message = version
    ? `Update versi ${version} sudah siap dipasang.`
    : 'Update terbaru sudah siap dipasang.';

  const detail = [
    'Aplikasi perlu restart untuk menyelesaikan update otomatis.',
    'Jika pilih "Nanti", update akan tetap terpasang saat aplikasi dibuka ulang berikutnya.',
  ].join(' ');

  const dialogWindow = mainWindow && !mainWindow.isDestroyed()
    ? mainWindow
    : undefined;

  const { response } = await dialog.showMessageBox(dialogWindow, {
    type: 'info',
    buttons: ['Restart Sekarang', 'Nanti'],
    defaultId: 0,
    cancelId: 1,
    title: 'Update Aplikasi',
    message,
    detail,
    noLink: true,
  });

  if (response !== 0) {
    return;
  }

  updateManager.waitExitThenApplyUpdate(updateInfo, false, true);
  app.quit();
};

const checkForUpdatesInBackground = async (mainWindow) => {
  if (updateCheckStarted) {
    return;
  }

  updateCheckStarted = true;

  let updateManager = null;

  try {
    updateManager = createUpdateManager();
    if (!updateManager) {
      return;
    }

    const updateInfo = await updateManager.checkForUpdatesAsync();
    if (!updateInfo) {
      return;
    }

    await updateManager.downloadUpdateAsync(updateInfo);
    await promptToRestartForUpdate(mainWindow, updateManager, updateInfo);
  } catch (error) {
    console.error('[velopack] gagal memeriksa update otomatis:', error);
  }
};

app.whenReady().then(async () => {
  const mainWindow = await createMainWindow();

  if (canUseAutoUpdate()) {
    setTimeout(() => {
      checkForUpdatesInBackground(mainWindow);
    }, autoCheckDelayMs);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  if (localServer) {
    localServer.close();
    localServer = null;
  }
});
