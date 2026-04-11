const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawn } = require('child_process');

const { startServer } = require('../dashboard/server');

const ARTIFACTS_DIR = path.resolve(__dirname, '..', 'artifacts');
const REPORT_FILE = path.join(ARTIFACTS_DIR, 'detox-cycle-last.json');
const QA_BASE_URL = 'http://127.0.0.1:3000';

function ensureArtifactsDir() {
  if (!fs.existsSync(ARTIFACTS_DIR)) {
    fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
  }
}

function getNpxCommand() {
  return process.platform === 'win32' ? 'npx.cmd' : 'npx';
}

function parseBoolean(value, fallback = false) {
  if (typeof value === 'boolean') {
    return value;
  }
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) {
    return fallback;
  }
  return ['1', 'true', 'yes', 'on'].includes(normalized);
}

function findAvailableAvds() {
  const avdDir = path.join(os.homedir(), '.android', 'avd');
  if (!fs.existsSync(avdDir)) {
    return [];
  }

  return fs
    .readdirSync(avdDir)
    .filter((entry) => entry.endsWith('.ini'))
    .map((entry) => entry.replace(/\.ini$/i, '').trim())
    .filter(Boolean);
}

function getAdbCommand(androidEnv = process.env) {
  const sdkRoot = androidEnv.ANDROID_SDK_ROOT || androidEnv.ANDROID_HOME;
  if (!sdkRoot) {
    return 'adb';
  }

  const adbExe = process.platform === 'win32'
    ? path.join(sdkRoot, 'platform-tools', 'adb.exe')
    : path.join(sdkRoot, 'platform-tools', 'adb');

  return fs.existsSync(adbExe) ? adbExe : 'adb';
}

function hasEmulatorAcceleration(androidEnv = process.env) {
  const sdkRoot = androidEnv.ANDROID_SDK_ROOT || androidEnv.ANDROID_HOME || '';
  if (!sdkRoot) {
    return false;
  }

  const emulatorCheckExe = process.platform === 'win32'
    ? path.join(sdkRoot, 'emulator', 'emulator-check.exe')
    : path.join(sdkRoot, 'emulator', 'emulator-check');

  if (!fs.existsSync(emulatorCheckExe)) {
    return false;
  }

  try {
    execFileSync(emulatorCheckExe, ['accel'], {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return true;
  } catch {
    return false;
  }
}

function findAttachedAndroidDevices(androidEnv = process.env) {
  try {
    const output = execFileSync(getAdbCommand(androidEnv), ['devices'], {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });

    return String(output || '')
      .split(/\r?\n/)
      .slice(1)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => line.split(/\s+/))
      .filter((parts) => parts[1] === 'device')
      .map((parts) => parts[0]);
  } catch {
    return [];
  }
}

function resolveDetoxRuntimeTarget(baseEnv = process.env) {
  const explicitConfiguration = String(baseEnv.DETOX_CONFIGURATION || '').trim();
  const explicitAvd = String(baseEnv.DETOX_AVD_NAME || '').trim();
  const explicitAdb = String(baseEnv.DETOX_ADB_NAME || '').trim();

  if (explicitConfiguration) {
    return {
      configuration: explicitConfiguration,
      env: {
        ...(explicitAvd ? { DETOX_AVD_NAME: explicitAvd } : {}),
        ...(explicitAdb ? { DETOX_ADB_NAME: explicitAdb } : {}),
      },
      mode: 'explicit',
    };
  }

  const avds = findAvailableAvds();
  const accelReady = hasEmulatorAcceleration(baseEnv);
  if (avds.length > 0 && accelReady) {
    return {
      configuration: 'android.emulator.debug',
      env: { DETOX_AVD_NAME: avds[0] },
      mode: 'emulator',
      selected: avds[0],
    };
  }

  const attachedDevices = findAttachedAndroidDevices(baseEnv);
  if (attachedDevices.length > 0) {
    const attachedConfiguration = String(baseEnv.DETOX_ATTACHED_CONFIGURATION || '').trim() || 'android.attached.release';
    return {
      configuration: attachedConfiguration,
      env: { DETOX_ADB_NAME: attachedDevices[0] },
      mode: 'attached',
      selected: attachedDevices[0],
    };
  }

  if (avds.length > 0 && !accelReady) {
    throw new Error('detox_target_not_available: AVD encontrado, mas aceleracao do emulador indisponivel (habilite Hypervisor/WHPX).');
  }

  throw new Error('detox_target_not_available: sem AVD e sem device attached (configure DETOX_AVD_NAME ou conecte device com USB debug).');
}

function resolveAndroidEnv(baseEnv) {
  const env = { ...baseEnv };
  const fallbackSdk = process.platform === 'win32'
    ? path.join(os.homedir(), 'AppData', 'Local', 'Android', 'Sdk')
    : '';
  const sdkRoot = env.ANDROID_SDK_ROOT || env.ANDROID_HOME || fallbackSdk;

  if (!sdkRoot || !fs.existsSync(sdkRoot)) {
    return env;
  }

  env.ANDROID_SDK_ROOT = sdkRoot;
  env.ANDROID_HOME = env.ANDROID_HOME || sdkRoot;

  const extraPaths = [
    path.join(sdkRoot, 'platform-tools'),
    path.join(sdkRoot, 'emulator'),
  ].filter((item) => fs.existsSync(item));

  const pathKey = Object.prototype.hasOwnProperty.call(env, 'Path') ? 'Path' : 'PATH';
  const currentPath = String(env[pathKey] || '');
  const parts = currentPath.split(path.delimiter).filter(Boolean);
  extraPaths.reverse().forEach((item) => {
    if (!parts.includes(item)) {
      parts.unshift(item);
    }
  });
  env[pathKey] = parts.join(path.delimiter);

  return env;
}

async function healthcheck(baseUrl = QA_BASE_URL) {
  try {
    const response = await fetch(`${baseUrl}/health`);
    if (!response.ok) {
      return false;
    }
    const payload = await response.json();
    return payload?.status === 'ok';
  } catch {
    return false;
  }
}

async function waitForHealth(baseUrl = QA_BASE_URL, timeoutMs = 10000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await healthcheck(baseUrl)) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  return false;
}

async function ensureQaServer() {
  const shouldAutostart = String(process.env.QA_AUTOSTART_SERVER || '1').trim() !== '0';
  if (!shouldAutostart) {
    return { server: null, started: false };
  }

  if (await healthcheck()) {
    return { server: null, started: false };
  }

  const server = startServer(3000);
  const ready = await waitForHealth();
  if (!ready) {
    await new Promise((resolve) => server.close(resolve));
    throw new Error('qa_server_failed_to_start');
  }

  return { server, started: true };
}

function runDetox(args, env) {
  return new Promise((resolve) => {
    const spawnOptions = {
      cwd: path.resolve(__dirname, '..'),
      env: resolveAndroidEnv(env),
      stdio: 'inherit',
      shell: false,
    };

    let child = null;
    try {
      child = spawn(getNpxCommand(), args, spawnOptions);
    } catch (error) {
      if (String(error?.code || '') !== 'EINVAL') {
        resolve(1);
        return;
      }

      child = spawn('cmd.exe', ['/c', getNpxCommand(), ...args], {
        ...spawnOptions,
        shell: true,
      });
    }

    child.on('close', (code) => resolve(Number(code || 0)));
    child.on('error', () => resolve(1));
  });
}

function runAnalyze(env) {
  return new Promise((resolve) => {
    const child = spawn('node', ['dashboard/scripts/ai-analyze.js'], {
      cwd: path.resolve(__dirname, '..'),
      env,
      stdio: 'inherit',
      shell: false,
    });

    child.on('close', (code) => resolve(Number(code || 0)));
    child.on('error', () => resolve(1));
  });
}

async function main() {
  ensureArtifactsDir();

  const persona = process.env.QA_PERSONA || 'iniciante';
  const seed = String(process.env.QA_SEED || Date.now());
  const testPattern = String(process.env.DETOX_TEST_PATTERN || '').trim();
  let androidEnv = resolveAndroidEnv(process.env);
  let target = null;
  let configuration = String(process.env.DETOX_CONFIGURATION || '').trim() || 'android.emulator.debug';
  let args = ['detox', 'test', '--configuration', configuration];

  const startedAt = new Date().toISOString();
  const allowNoTarget = parseBoolean(process.env.DETOX_ALLOW_NO_TARGET, false);
  let qaServer = null;
  let analyzeExitCode = 1;

  try {
    target = resolveDetoxRuntimeTarget(androidEnv);
    configuration = target.configuration;
    args = ['detox', 'test', '--configuration', configuration];

    if (testPattern) {
      args.push('--testNamePattern', testPattern);
    }

    if (String(process.env.DETOX_HEADLESS || '').trim() === '1') {
      args.push('--headless');
    }

    if (String(process.env.DETOX_CLEANUP || '1').trim() !== '0') {
      args.push('--cleanup');
    }

    if (String(process.env.DETOX_RECORD_LOGS || '').trim()) {
      args.push('--record-logs', String(process.env.DETOX_RECORD_LOGS).trim());
    }

    qaServer = await ensureQaServer();
    console.log(`[detox-cycle] configuration=${configuration} mode=${target.mode} target=${target.selected || 'default'} persona=${persona} seed=${seed}`);

    const exitCode = await runDetox(args, {
      ...androidEnv,
      ...target.env,
      QA_PERSONA: persona,
      QA_SEED: seed,
    });

    analyzeExitCode = await runAnalyze({
      ...process.env,
      QA_CLIENT_ID: process.env.QA_CLIENT_ID || 'default',
    });

    fs.writeFileSync(
      REPORT_FILE,
      JSON.stringify(
        {
          analyzeExitCode,
          configuration,
          exitCode,
          finishedAt: new Date().toISOString(),
          persona,
          qaServerAutostarted: Boolean(qaServer?.started),
          seed,
          startedAt,
        },
        null,
        2
      ),
      'utf-8'
    );

    process.exit(exitCode);
  } catch (error) {
    const errorMessage = String(error?.message || error || 'unknown_error');
    const isNoTargetError = errorMessage.includes('detox_target_not_available');
    const shouldSkip = allowNoTarget && isNoTargetError;

    if (shouldSkip) {
      console.warn(`[detox-cycle] skip: ${errorMessage}`);
    } else {
      console.error('[detox-cycle] fatal', errorMessage);
    }

    fs.writeFileSync(
      REPORT_FILE,
      JSON.stringify(
        {
          analyzeExitCode,
          configuration,
          exitCode: shouldSkip ? 0 : 1,
          finishedAt: new Date().toISOString(),
          persona,
          qaServerAutostarted: Boolean(qaServer?.started),
          seed,
          startedAt,
          skipped: shouldSkip,
          fatalError: errorMessage,
        },
        null,
        2
      ),
      'utf-8'
    );
    process.exit(shouldSkip ? 0 : 1);
  } finally {
    if (qaServer?.server) {
      await new Promise((resolve) => qaServer.server.close(resolve));
    }
  }
}

main();
