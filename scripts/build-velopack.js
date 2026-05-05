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
const iconPath = path.join(projectRoot, 'assets', 'iconsm.ico');
const productName = String(packageJson.build?.productName || packageJson.productName || packageJson.name).trim();
const packId = String(packageJson.build?.appId || packageJson.name).trim();
const packVersion = String(packageJson.version || '').trim();
const mainExe = `${productName}.exe`;
const velopackVersion = String(
  packageJson.dependencies?.velopack
  || packageJson.devDependencies?.velopack
  || ''
).trim().replace(/^[~^]/, '');

const unique = (items) => [...new Set(items.filter(Boolean))];

const getCommandVariants = (command) => {
  if (!isWindows) {
    return [command];
  }

  const pathext = String(process.env.PATHEXT || '.EXE;.CMD;.BAT')
    .split(';')
    .map((ext) => ext.trim())
    .filter(Boolean);

  const variants = [command];
  const lowerCommand = command.toLowerCase();

  for (const ext of pathext) {
    const lowerExt = ext.toLowerCase();
    if (!lowerCommand.endsWith(lowerExt)) {
      variants.push(`${command}${lowerExt}`);
    }
  }

  return unique(variants);
};

const getPathDirectories = () => {
  const pathDirs = String(process.env.PATH || '')
    .split(path.delimiter)
    .map((dir) => dir.trim())
    .filter(Boolean);

  const extraDirs = [];
  const dotnetRoot = process.env.DOTNET_ROOT;
  const userProfile = process.env.USERPROFILE;

  if (dotnetRoot) {
    extraDirs.push(dotnetRoot);
  }

  if (userProfile) {
    extraDirs.push(path.join(userProfile, '.dotnet', 'tools'));
  }

  return unique([...extraDirs, ...pathDirs]);
};

const resolveCommandPath = (command) => {
  if (!isWindows) {
    return command;
  }

  for (const dir of getPathDirectories()) {
    for (const variant of getCommandVariants(command)) {
      const candidate = path.join(dir, variant);
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }
  }

  return null;
};

const resolveLocalBin = (name) => {
  const binDir = path.join(projectRoot, 'node_modules', '.bin');
  const variants = isWindows
    ? getCommandVariants(name).filter((variant) => path.extname(variant)).concat(
      getCommandVariants(name).filter((variant) => !path.extname(variant))
    )
    : getCommandVariants(name);

  for (const variant of variants) {
    const candidate = path.join(binDir, variant);
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
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
  const pathCandidate = resolveCommandPath(command);
  const candidates = isWindows
    ? unique([pathCandidate, ...getCommandVariants(command)])
    : [command];

  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }

    const result = trySpawn(candidate, args, options);
    if (result && !result.error) {
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
  const isWindowsShellScript = isWindows && ['.cmd', '.bat'].includes(path.extname(command).toLowerCase());

  const result = spawnSync(command, args, {
    cwd: projectRoot,
    stdio: 'inherit',
    shell: isWindowsShellScript,
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
  if (resolveCommand('dnx')) {
    return;
  }

  if (resolveCommand('vpk', ['-h'])) {
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

  const vpkCommand = resolveCommand('vpk', ['-h']);
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

  const electronBuilderCommand = resolveLocalBin('electron-builder');
  if (!electronBuilderCommand) {
    throw new Error('Binary lokal "electron-builder" tidak ditemukan di node_modules/.bin.');
  }

  run(electronBuilderCommand, ['--win', 'dir']);

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
