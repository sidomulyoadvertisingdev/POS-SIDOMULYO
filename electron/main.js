const { app, BrowserWindow, nativeImage } = require('electron');
const fs = require('fs');
const http = require('http');
const path = require('path');

const iconPath = path.join(__dirname, '..', 'assets', 'icon.png');
const appRootPath = app.getAppPath();
const distDirPath = path.join(appRootPath, 'dist-web');
const distIndexPath = path.join(distDirPath, 'index.html');

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

const toSafeAssetPath = (requestUrl) => {
  const pathname = decodeURIComponent(new URL(requestUrl, 'http://127.0.0.1').pathname);
  const normalized = path.normalize(pathname).replace(/^(\.\.[\\/])+/, '');
  const relative = normalized.replace(/^([\\/]+)/, '');
  return path.join(distDirPath, relative);
};

const createLocalServer = () => new Promise((resolve, reject) => {
  const server = http.createServer((request, response) => {
    const targetPath = toSafeAssetPath(request.url || '/');
    const fallbackToIndex = () => {
      fs.readFile(distIndexPath, (indexError, indexContent) => {
        if (indexError) {
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
};

app.whenReady().then(async () => {
  await createMainWindow();

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
