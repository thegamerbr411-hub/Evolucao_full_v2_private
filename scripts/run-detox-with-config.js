const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const mode = String(process.argv[2] || '').trim().toLowerCase();
const config = mode === 'attached' ? 'android.attached.debug' : 'android.emulator.debug';

function getLocalPropertiesSdkRoot() {
  try {
    const localPropsPath = path.join(process.cwd(), 'android', 'local.properties');
    if (!fs.existsSync(localPropsPath)) {
      return '';
    }
    const content = fs.readFileSync(localPropsPath, 'utf8');
    const match = content.match(/^sdk\.dir=(.+)$/m);
    if (!match) {
      return '';
    }
    return String(match[1] || '').trim().replace(/\\\\/g, '\\');
  } catch {
    return '';
  }
}

function resolveAttachedSerial() {
  const out = spawnSync(getAdbCommand(), ['devices'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
    timeout: 15000,
  });
  const raw = String(out.stdout || '');
  const lines = raw.split(/\r?\n/).slice(1).map((line) => line.trim()).filter(Boolean);
  const devices = lines
    .map((line) => line.split(/\s+/))
    .filter((parts) => parts[1] === 'device')
    .map((parts) => parts[0]);

  const physical = devices.find((item) => !String(item).startsWith('emulator-'));
  return physical || devices[0] || '';
}

function killRunningEmulators() {
  const out = spawnSync(getAdbCommand(), ['devices'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
    timeout: 15000,
  });
  const raw = String(out.stdout || '');
  const lines = raw.split(/\r?\n/).slice(1).map((line) => line.trim()).filter(Boolean);
  const emulators = lines
    .map((line) => line.split(/\s+/))
    .filter((parts) => parts[1] === 'device' && String(parts[0]).startsWith('emulator-'))
    .map((parts) => parts[0]);

  for (const serial of emulators) {
    spawnSync(getAdbCommand(), ['-s', serial, 'emu', 'kill'], {
      stdio: 'ignore',
      timeout: 10000,
    });
  }
}

function getAdbCommand() {
  const sdkRoot = process.env.ANDROID_SDK_ROOT
    || process.env.ANDROID_HOME
    || getLocalPropertiesSdkRoot()
    || path.join(process.env.LOCALAPPDATA || '', 'Android', 'Sdk');
  const adbPath = path.join(sdkRoot, 'platform-tools', process.platform === 'win32' ? 'adb.exe' : 'adb');
  if (fs.existsSync(adbPath)) {
    return adbPath;
  }
  return process.platform === 'win32' ? 'adb.exe' : 'adb';
}

function getDetoxCommand() {
  const detoxBin = path.join(
    process.cwd(),
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'detox.cmd' : 'detox'
  );
  if (fs.existsSync(detoxBin)) {
    return detoxBin;
  }
  return 'npx';
}

function runDetox(args, env) {
  const detoxCommand = getDetoxCommand();
  const commandArgs = detoxCommand === 'npx' ? ['detox', ...args] : args;
  return spawnSync(detoxCommand, commandArgs, {
    env,
    stdio: 'inherit',
    timeout: 0,
  });
}

const env = {
  ...process.env,
  DETOX_CONFIGURATION: config,
  DETOX_FORCE_ATTACHED: mode === 'attached' ? '1' : '0',
};

if (mode === 'attached') {
  console.log('[detox-runner] mode=attached');
  console.log(`[detox-runner] adb-command=${getAdbCommand()}`);
  killRunningEmulators();
  const serial = resolveAttachedSerial();
  if (serial) {
    env.DETOX_ADB_NAME = serial;
    console.log(`[detox-runner] attached-serial=${serial}`);
  } else {
    console.log('[detox-runner] attached-serial=not-found');
    process.exit(2);
  }
}

console.log(`[detox-runner] configuration=${config}`);
console.log('[detox-runner] step=build');
const buildResult = runDetox(['build', '--configuration', config], env);

if (typeof buildResult.status === 'number' && buildResult.status !== 0) {
  process.exit(buildResult.status);
}

console.log('[detox-runner] step=test');
const result = runDetox(['test', '--cleanup', '--configuration', config], env);

process.exit(typeof result.status === 'number' ? result.status : 1);
