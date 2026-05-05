const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const distWebDir = path.join(projectRoot, 'dist-web');
const velopackDir = path.join(projectRoot, 'release', 'velopack');
const outputDir = path.join(projectRoot, 'release', 'pages-site');

const normalizeBasePath = (value) => {
  const trimmed = String(value || '').trim();
  if (!trimmed || trimmed === '/') {
    return '';
  }

  return `/${trimmed.replace(/^\/+|\/+$/g, '')}`;
};

const basePath = normalizeBasePath(
  process.env.GITHUB_PAGES_BASE_PATH || 'POS-SIDOMULYO'
);

const ensureDir = (dirPath) => {
  fs.mkdirSync(dirPath, { recursive: true });
};

const copyDirectory = (sourceDir, targetDir) => {
  if (!fs.existsSync(sourceDir)) {
    throw new Error(`Folder tidak ditemukan: ${sourceDir}`);
  }

  ensureDir(targetDir);

  for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
    const sourcePath = path.join(sourceDir, entry.name);
    const targetPath = path.join(targetDir, entry.name);

    if (entry.isDirectory()) {
      copyDirectory(sourcePath, targetPath);
      continue;
    }

    fs.copyFileSync(sourcePath, targetPath);
  }
};

const patchStaticBasePath = (filePath) => {
  const textFileExtensions = new Set(['.html', '.js', '.css', '.json', '.txt', '.map']);
  const extension = path.extname(filePath).toLowerCase();

  if (!textFileExtensions.has(extension)) {
    return;
  }

  const original = fs.readFileSync(filePath, 'utf8');
  let updated = original;

  const replacements = [
    ['href="/', `href="${basePath}/`],
    ['src="/', `src="${basePath}/`],
    ['content="/', `content="${basePath}/`],
    ['url(/', `url(${basePath}/`],
    ['"/assets/', `"${basePath}/assets/`],
    ['"/_expo/', `"${basePath}/_expo/`],
    ["'/assets/", `'${basePath}/assets/`],
    ["'/_expo/", `'${basePath}/_expo/`],
  ];

  for (const [searchValue, replaceValue] of replacements) {
    updated = updated.split(searchValue).join(replaceValue);
  }

  if (updated !== original) {
    fs.writeFileSync(filePath, updated, 'utf8');
  }
};

const walkFiles = (dirPath, onFile) => {
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      walkFiles(fullPath, onFile);
      continue;
    }

    onFile(fullPath);
  }
};

const main = () => {
  const indexHtmlPath = path.join(distWebDir, 'index.html');

  if (!fs.existsSync(indexHtmlPath)) {
    throw new Error(`File web export tidak ditemukan: ${indexHtmlPath}`);
  }

  fs.rmSync(outputDir, { recursive: true, force: true });
  ensureDir(outputDir);

  copyDirectory(distWebDir, outputDir);

  if (fs.existsSync(velopackDir)) {
    copyDirectory(velopackDir, outputDir);
  }

  walkFiles(outputDir, patchStaticBasePath);

  const outputIndexHtml = path.join(outputDir, 'index.html');
  const output404Html = path.join(outputDir, '404.html');
  const noJekyllPath = path.join(outputDir, '.nojekyll');

  fs.copyFileSync(outputIndexHtml, output404Html);
  fs.writeFileSync(noJekyllPath, '', 'utf8');

  console.log(`GitHub Pages site siap di: ${outputDir}`);
  console.log(`Base path GitHub Pages: ${basePath || '/'}`);
};

main();
