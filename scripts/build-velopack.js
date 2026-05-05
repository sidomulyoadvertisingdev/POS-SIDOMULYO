const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const projectRoot = path.resolve(__dirname, '..');
const packageJsonPath = path.join(projectRoot, 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

const releaseRoot = path.join(projectRoot, 'release');
const unpackedDir = path.join(releaseRoot, 'win-unpacked');
const outputDir = path.join(releaseRoot, 'velopack');
const iconPath = path.join(projectRoot, 'assets', 'Logo-SM.ico');
const productName = String(packageJson.build?.productName || packageJson.productName || packageJson.name).trim();
const packId = String(packageJson.build?.appId || packageJson.name).trim();
const packVersion = String(packageJson.version || '').trim();
const mainExe = `${productName}.exe`;
const velopackVersion = String(
  packageJson.dependencies?.velopack
  || packageJson.devDependencies?.velopack
  || ''
).trim().replace(/^[~^]/, '');

const commandName = (base) => (process.platform === 'win32' ? `${base}.cmd` : base);

const hasCommand = (command, args = ['--version']) => {
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    stdio: 'ignore',
    shell: false,
  });

  return result.status === 0;
};

const run = (command, args, options = {}) => {
  console.log(`\n> ${command} ${args.join(' ')}`);

  const result = spawnSync(command, args, {
    cwd: projectRoot,
    stdio: 'inherit',
    shell: false,
    ...options,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
};

const ensureConfig = () => {
  if (!packVersion) {
    throw new Error('Versi aplikasi tidak ditemukan di package.json.');
  }

  if (!velopackVersion) {
    throw new Error('Dependency velopack belum ditemukan di package.json.');
  }
};

const ensureDnxInstalled = () => {
  if (hasCommand('dnx')) {
    return;
  }

  if (hasCommand(commandName('vpk'))) {
    return;
  }

  throw new Error([
    'Perintah "dnx" atau "vpk" tidak ditemukan.',
    'Install .NET SDK lalu jalankan "dotnet tool install -g vpk" atau gunakan "dnx vpk --version <versi>".',
  ].join(' '));
};

const getVelopackCommand = () => {
  if (hasCommand('dnx')) {
    return {
      command: 'dnx',
      args: ['vpk', '--version', velopackVersion],
    };
  }

  if (hasCommand(commandName('vpk'))) {
    return {
      command: commandName('vpk'),
      args: [],
    };
  }

  throw new Error('CLI Velopack tidak ditemukan.');
};

const main = () => {
  ensureConfig();
  ensureDnxInstalled();

  run(commandName('npx'), ['electron-builder', '--win', 'dir']);

  if (!fs.existsSync(unpackedDir)) {
    throw new Error(`Folder hasil build Electron tidak ditemukan: ${unpackedDir}`);
  }

  fs.mkdirSync(outputDir, { recursive: true });

  const velopackCli = getVelopackCommand();

  run(velopackCli.command, [
    ...velopackCli.args,
    'pack',
    '--packId',
    packId,
    '--packVersion',
    packVersion,
    '--packDir',
    unpackedDir,
    '--mainExe',
    mainExe,
    '--packTitle',
    productName,
    '--icon',
    iconPath,
    '--outputDir',
    outputDir,
  ]);

  console.log(`\nRelease Velopack selesai dibuat di: ${outputDir}`);
};

main();
