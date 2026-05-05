const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const isWindows = process.platform === 'win32';
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

const getCommandVariants = (command) => {
  if (!isWindows) {
    return [command];
  }

  const variants = [command];
  for (const ext of ['.exe', '.cmd', '.bat']) {
    if (!command.toLowerCase().endsWith(ext)) {
      variants.push(`${command}${ext}`);
    }
  }

  return variants;
};

const getWindowsPathCandidates = (command) => {
  if (!isWindows) {
    return [];
  }

  const candidates = [];
  const dotnetRoot = process.env.DOTNET_ROOT;
  const userProfile = process.env.USERPROFILE;

  if (dotnetRoot) {
    for (const variant of getCommandVariants(command)) {
      candidates.push(path.join(dotnetRoot, variant));
    }
  }

  if (userProfile && (command === 'vpk' || command === 'dotnet')) {
    for (const variant of getCommandVariants(command)) {
      candidates.push(path.join(userProfile, '.dotnet', 'tools', variant));
    }
  }

  return candidates;
};

const trySpawn = (command, args = ['--version'], options = {}) => {
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    stdio: 'ignore',
    shell: false,
    ...options,
  });

  if (result.error && result.error.code === 'ENOENT') {
    return null;
  }

  return result;
};

const resolveCommand = (command, args = ['--version'], options = {}) => {
  for (const candidate of [
    ...getCommandVariants(command),
    ...getWindowsPathCandidates(command),
  ]) {
    const result = trySpawn(candidate, args, options);
    if (result && result.status === 0) {
      return candidate;
    }
  }

  return null;
};

const hasCommand = (command, args = ['--version']) => {
  const resolved = resolveCommand(command, args);
  if (!resolved) {
    return false;
  }

  const result = trySpawn(resolved, args);
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

  if (hasCommand('vpk')) {
    return;
  }

  if (hasCommand('dotnet', ['tool', 'run', 'vpk', '--', '--version'])) {
    return;
  }

  throw new Error([
    'Perintah "dnx", "vpk", atau "dotnet tool run vpk" tidak ditemukan.',
    'Install .NET SDK lalu jalankan "dotnet tool install -g vpk" atau gunakan "dnx vpk --version <versi>".',
  ].join(' '));
};

const getVelopackCommand = () => {
  const dnxCommand = resolveCommand('dnx');
  if (dnxCommand) {
    return {
      command: dnxCommand,
      args: ['vpk', '--version', velopackVersion],
    };
  }

  const vpkCommand = resolveCommand('vpk');
  if (vpkCommand) {
    return {
      command: vpkCommand,
      args: [],
    };
  }

  const dotnetCommand = resolveCommand('dotnet', ['tool', 'run', 'vpk', '--', '--version']);
  if (dotnetCommand) {
    return {
      command: dotnetCommand,
      args: ['tool', 'run', 'vpk', '--'],
    };
  }

  throw new Error('CLI Velopack tidak ditemukan.');
};

const main = () => {
  ensureConfig();
  ensureDnxInstalled();

  const npxCommand = resolveCommand('npx', ['--version']);
  if (!npxCommand) {
    throw new Error('Perintah "npx" tidak ditemukan.');
  }

  run(npxCommand, ['electron-builder', '--win', 'dir']);

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
