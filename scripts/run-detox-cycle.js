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

function getDetoxRunner() {
  const detoxCli = path.resolve(__dirname, '..', 'node_modules', 'detox', 'local-cli', 'cli.js');
  if (fs.existsSync(detoxCli)) {
    return {
      command: process.execPath,
      argsPrefix: [detoxCli],
    };
  }

  const detoxBin = process.platform === 'win32'
    ? path.resolve(__dirname, '..', 'node_modules', '.bin', 'detox.cmd')
    : path.resolve(__dirname, '..', 'node_modules', '.bin', 'detox');
  if (fs.existsSync(detoxBin)) {
    return {
      command: detoxBin,
      argsPrefix: [],
    };
  }

  return {
    command: getNpxCommand(),
    argsPrefix: [],
  };
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

function getApkPathForConfiguration(configuration) {
  const isRelease = String(configuration || '').includes('.release');
  const stagedRoot = process.env.DETOX_APK_STAGE_DIR
    || (process.platform === 'win32' ? 'C:\\detox-bin' : '/tmp/detox-bin');
  const stagedPath = isRelease
    ? path.resolve(stagedRoot, 'app-release.apk')
    : path.resolve(stagedRoot, 'app-debug.apk');

  if (fs.existsSync(stagedPath)) {
    return stagedPath;
  }

  return isRelease
    ? path.resolve(__dirname, '..', 'android', 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk')
    : path.resolve(__dirname, '..', 'android', 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');
}

function isAppInstalled(deviceId, packageId, androidEnv = process.env) {
  try {
    const output = execFileSync(getAdbCommand(androidEnv), ['-s', deviceId, 'shell', 'pm', 'path', packageId], {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return String(output || '').includes('package:');
  } catch {
    return false;
  }
}

function installAppWithRetry(deviceId, apkPath, packageId, androidEnv = process.env) {
  const adb = getAdbCommand(androidEnv);
  try {
    execFileSync(adb, ['-s', deviceId, 'install', '-r', '-d', '-g', apkPath], {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return true;
  } catch {
    try {
      execFileSync(adb, ['-s', deviceId, 'uninstall', packageId], {
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch {
      // best effort uninstall
    }

    try {
      execFileSync(adb, ['-s', deviceId, 'install', '-r', '-d', '-g', apkPath], {
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      return true;
    } catch {
      return false;
    }
  }
}

function ensureAttachedAppInstalled(target, configuration, androidEnv = process.env) {
  if (!target || target.mode !== 'attached' || !target.selected) {
    return;
  }

  const packageId = 'com.tipolt.evolucaofullv2';
  const apkPath = getApkPathForConfiguration(configuration);
  const shouldForceInstall = String(process.env.DETOX_FORCE_INSTALL_APK || '1').trim() !== '0';
  if (!shouldForceInstall && isAppInstalled(target.selected, packageId, androidEnv)) {
    return;
  }

  if (!fs.existsSync(apkPath)) {
    throw new Error(`detox_install_preflight_failed: apk_not_found ${apkPath}`);
  }

  const ok = installAppWithRetry(target.selected, apkPath, packageId, androidEnv);
  if (!ok) {
    throw new Error(`detox_install_preflight_failed: adb_install_failed device=${target.selected}`);
  }
}

function ensureAttachedDeviceAwake(target, androidEnv = process.env) {
  if (!target || target.mode !== 'attached' || !target.selected) {
    return;
  }

  const adb = getAdbCommand(androidEnv);
  const serial = target.selected;

  const safeExec = (args) => {
    try {
      execFileSync(adb, ['-s', serial, ...args], {
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'ignore'],
      });
    } catch {
      // best effort only
    }
  };

  // Evita lock/sleep durante testes longos em device físico.
  safeExec(['shell', 'svc', 'power', 'stayon', 'true']);
  safeExec(['shell', 'input', 'keyevent', 'KEYCODE_WAKEUP']);
  safeExec(['shell', 'wm', 'dismiss-keyguard']);
}

function ensureAttachedAppForeground(target, androidEnv = process.env) {
  if (!target || target.mode !== 'attached' || !target.selected) {
    return;
  }

  const adb = getAdbCommand(androidEnv);
  const serial = target.selected;
  const packageId = 'com.tipolt.evolucaofullv2';
  const launchActivity = `${packageId}/.MainActivity`;

  try {
    // Tenta trazer a activity principal para foreground antes do bootstrap Detox.
    execFileSync(adb, ['-s', serial, 'shell', 'am', 'start', '-W', '-n', launchActivity], {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return;
  } catch {
    // Fallback best effort para dispositivos com variação de launcher/activity resolve.
  }

  try {
    execFileSync(adb, ['-s', serial, 'shell', 'monkey', '-p', packageId, '-c', 'android.intent.category.LAUNCHER', '1'], {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    // Best effort somente; Detox ainda pode tentar iniciar app normalmente.
  }
}

function resolveDetoxRuntimeTarget(baseEnv = process.env) {
  const explicitConfiguration = String(baseEnv.DETOX_CONFIGURATION || '').trim();
  const explicitAvd = String(baseEnv.DETOX_AVD_NAME || '').trim();
  const explicitAdb = String(baseEnv.DETOX_ADB_NAME || '').trim();

  if (explicitConfiguration) {
    if (explicitConfiguration.includes('android.attached')) {
      const attachedDevices = findAttachedAndroidDevices(baseEnv);
      const selected = explicitAdb || attachedDevices[0] || '';
      if (!selected) {
        throw new Error('detox_target_not_available: configuracao attached explicita sem device USB conectado.');
      }

      return {
        configuration: explicitConfiguration,
        env: {
          DETOX_ADB_NAME: selected,
        },
        mode: 'attached',
        selected,
      };
    }

    if (explicitConfiguration.includes('android.emulator')) {
      const avds = findAvailableAvds();
      const selected = explicitAvd || avds[0] || '';
      if (!selected) {
        throw new Error('detox_target_not_available: configuracao emulator explicita sem AVD disponivel.');
      }

      return {
        configuration: explicitConfiguration,
        env: {
          DETOX_AVD_NAME: selected,
        },
        mode: 'emulator',
        selected,
      };
    }

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
    const attachedConfiguration = String(baseEnv.DETOX_ATTACHED_CONFIGURATION || '').trim() || 'android.attached.debug';
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

async function healthcheckUrl(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      return false;
    }
    const payload = await response.json();
    return Boolean(payload?.ok);
  } catch {
    return false;
  }
}

async function ensureBackendHealthForAttached(target) {
  if (!target || target.mode !== 'attached') {
    return;
  }

  const requireHealth = String(process.env.DETOX_REQUIRE_BACKEND_HEALTH || '1').trim() !== '0';
  if (!requireHealth) {
    return;
  }

  const backendHealthUrl = String(process.env.DETOX_BACKEND_HEALTH_URL || 'http://127.0.0.1:3001/health').trim();
  const ok = await healthcheckUrl(backendHealthUrl);
  if (!ok) {
    throw new Error(`backend_healthcheck_failed: ${backendHealthUrl}`);
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

    const runner = getDetoxRunner();
    // When using the local Detox CLI entrypoint, `detox` subcommand is implicit.
    const commandArgs = runner.argsPrefix.length > 0 ? args.slice(1) : args;
    const finalArgs = [...runner.argsPrefix, ...commandArgs];

    let child = null;
    try {
      child = spawn(runner.command, finalArgs, spawnOptions);
    } catch {
      resolve(1);
      return;
    }

    child.on('close', (code) => resolve(Number(code || 0)));
    child.on('error', (error) => {
      console.error('[detox-cycle] spawn error', String(error?.message || error));
      resolve(1);
    });
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

function resolveFallbackTarget(failedTarget, baseEnv) {
  if (!failedTarget || !failedTarget.mode) {
    return null;
  }

  const failedConfiguration = String(failedTarget.configuration || '');
  const tryToKeepVariant = (nextMode) => {
    if (!failedConfiguration) {
      return '';
    }
    if (nextMode === 'emulator') {
      return failedConfiguration.replace('.attached.', '.emulator.');
    }
    if (nextMode === 'attached') {
      return failedConfiguration.replace('.emulator.', '.attached.');
    }
    return '';
  };

  if (failedTarget.mode === 'attached') {
    const avds = findAvailableAvds();
    const accelReady = hasEmulatorAcceleration(baseEnv);
    if (!avds.length || !accelReady) {
      return null;
    }

    return {
      configuration: tryToKeepVariant('emulator') || 'android.emulator.debug',
      env: { DETOX_AVD_NAME: avds[0] },
      mode: 'emulator',
      selected: avds[0],
      fallbackFrom: failedTarget.mode,
    };
  }

  if (failedTarget.mode === 'emulator') {
    const attachedDevices = findAttachedAndroidDevices(baseEnv);
    if (!attachedDevices.length) {
      return null;
    }

    return {
      configuration: tryToKeepVariant('attached') || 'android.attached.debug',
      env: { DETOX_ADB_NAME: attachedDevices[0] },
      mode: 'attached',
      selected: attachedDevices[0],
      fallbackFrom: failedTarget.mode,
    };
  }

  return null;
}

function buildDetoxArgs(configuration, testPattern, testFile) {
  const args = ['detox', 'test', '--configuration', configuration];

  if (testPattern) {
    args.push('--testNamePattern', testPattern);
  }

  if (String(process.env.DETOX_HEADLESS || '').trim() === '1') {
    args.push('--headless');
  }

  if (String(process.env.DETOX_CLEANUP || '1').trim() !== '0') {
    args.push('--cleanup');
  }

  // Keep attached runs isolated by default; forcing --reuse has caused
  // Detox session collisions ("app is already connected to the session").
  const shouldReuse = String(process.env.DETOX_REUSE_APP || '').trim() === '1';
  if (shouldReuse) {
    args.push('--reuse');
  }

  if (String(process.env.DETOX_RECORD_LOGS || '').trim()) {
    args.push('--record-logs', String(process.env.DETOX_RECORD_LOGS).trim());
  }

  if (testFile) {
    // Forward directly to Jest to avoid loading unrelated suites in loop mode.
    args.push('--', '--runTestsByPath', testFile);
  }

  return args;
}

async function main() {
  ensureArtifactsDir();

  const persona = process.env.QA_PERSONA || 'iniciante';
  const seed = String(process.env.QA_SEED || Date.now());
  const testPattern = String(process.env.DETOX_TEST_PATTERN || '').trim();
  const testFile = String(process.env.DETOX_TEST_FILE || '').trim();
  let androidEnv = resolveAndroidEnv(process.env);
  let target = null;
  let configuration = String(process.env.DETOX_CONFIGURATION || '').trim() || 'android.emulator.debug';
  const attempts = [];
  let finalExitCode = 1;

  const startedAt = new Date().toISOString();
  const allowNoTarget = parseBoolean(process.env.DETOX_ALLOW_NO_TARGET, false);
  let qaServer = null;
  let analyzeExitCode = 1;

  try {
    target = resolveDetoxRuntimeTarget(androidEnv);
    qaServer = await ensureQaServer();
    const fallbackEnabled = parseBoolean(process.env.DETOX_FALLBACK_ON_FAILURE, true);

    const runAttempt = async (currentTarget, reason = 'primary') => {
      configuration = currentTarget.configuration;
      await ensureBackendHealthForAttached(currentTarget);
      ensureAttachedDeviceAwake(currentTarget, androidEnv);
      ensureAttachedAppInstalled(currentTarget, configuration, androidEnv);
      if (String(process.env.DETOX_PREFLIGHT_FOREGROUND || '0').trim() === '1') {
        ensureAttachedAppForeground(currentTarget, androidEnv);
      }

      console.log(
        `[detox-cycle] attempt=${attempts.length + 1} reason=${reason} configuration=${configuration} mode=${currentTarget.mode} target=${currentTarget.selected || 'default'} persona=${persona} seed=${seed}`
      );

      const attemptExitCode = await runDetox(buildDetoxArgs(configuration, testPattern, testFile), {
        ...androidEnv,
        ...currentTarget.env,
        QA_PERSONA: persona,
        QA_SEED: seed,
      });

      attempts.push({
        attempt: attempts.length + 1,
        configuration,
        mode: currentTarget.mode,
        target: currentTarget.selected || 'default',
        reason,
        exitCode: attemptExitCode,
      });

      return attemptExitCode;
    };

    finalExitCode = await runAttempt(target, 'primary');

    if (finalExitCode !== 0 && fallbackEnabled) {
      const fallbackTarget = resolveFallbackTarget(target, androidEnv);
      if (fallbackTarget) {
        console.warn(
          `[detox-cycle] primary_failed_exit=${finalExitCode}; retrying with fallback mode=${fallbackTarget.mode} target=${fallbackTarget.selected || 'default'}`
        );
        target = fallbackTarget;
        finalExitCode = await runAttempt(target, `fallback_from_${fallbackTarget.fallbackFrom}`);
      }
    }

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
          exitCode: finalExitCode,
          attempts,
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

    process.exit(finalExitCode);
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
          attempts,
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
