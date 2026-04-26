const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');

const DETOX_STAGE_DIR = process.env.DETOX_APK_STAGE_DIR
  || (process.platform === 'win32' ? 'C:\\detox-bin' : '/tmp/detox-bin');
if (!fs.existsSync(DETOX_STAGE_DIR)) {
  fs.mkdirSync(DETOX_STAGE_DIR, { recursive: true });
}

const inferredSdkRoot = path.join(process.env.LOCALAPPDATA || '', 'Android', 'Sdk');
if (!process.env.ANDROID_SDK_ROOT && fs.existsSync(inferredSdkRoot)) {
  process.env.ANDROID_SDK_ROOT = inferredSdkRoot;
}
if (!process.env.ANDROID_HOME && process.env.ANDROID_SDK_ROOT) {
  process.env.ANDROID_HOME = process.env.ANDROID_SDK_ROOT;
}

function getFirstAttachedDevice() {
  const sdkRoot = process.env.ANDROID_SDK_ROOT
    || process.env.ANDROID_HOME
    || path.join(process.env.LOCALAPPDATA || '', 'Android', 'Sdk');

  const adbPath = path.join(sdkRoot, 'platform-tools', process.platform === 'win32' ? 'adb.exe' : 'adb');
  const adbCommand = adbPath && adbPath.length ? adbPath : (process.platform === 'win32' ? 'adb.exe' : 'adb');

  try {
    const output = execFileSync(adbCommand, ['devices'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });

    const devices = String(output || '')
      .split(/\r?\n/)
      .slice(1)
      .map((line) => line.trim())
      .filter(Boolean)
      .filter((line) => /\sdevice$/.test(line))
      .map((line) => line.split(/\s+/)[0]);

    return devices[0] || '.*';
  } catch {
    return '.*';
  }
}

const androidDebugBinary = path.join(DETOX_STAGE_DIR, 'app-debug.apk');
const androidTestBinary = path.join(DETOX_STAGE_DIR, 'app-debug-androidTest.apk');
const androidReleaseBinary = path.join(DETOX_STAGE_DIR, 'app-release.apk');
const androidReleaseTestBinary = path.join(DETOX_STAGE_DIR, 'app-release-androidTest.apk');
const jestBinary = process.platform === 'win32'
  ? path.join('node_modules', '.bin', 'jest.cmd')
  : path.join('node_modules', '.bin', 'jest');

module.exports = {
  behavior: {
    init: {
      exposeGlobals: true,
    },
    cleanup: {
      shutdownDevice: false,
    },
  },
  testRunner: {
    args: {
      $0: jestBinary,
      config: 'e2e/jest.config.js',
    },
    jest: {
      setupTimeout: 120000,
    },
  },
  apps: {
    'android.debug': {
      type: 'android.apk',
      binaryPath: androidDebugBinary,
      testBinaryPath: androidTestBinary,
      build: 'cd android && gradlew.bat assembleDebug assembleAndroidTest -DtestBuildType=debug && node ..\\scripts\\stage-detox-apks.js --configuration=debug',
    },
    'android.release': {
      type: 'android.apk',
      binaryPath: androidReleaseBinary,
      testBinaryPath: androidReleaseTestBinary,
      build: 'cd android && gradlew.bat assembleRelease assembleAndroidTest -DtestBuildType=release && node ..\\scripts\\stage-detox-apks.js --configuration=release',
    },
  },
  devices: {
    emulator: {
      type: 'android.emulator',
      device: {
        // Prefer available AVDs used in this workspace; can still be overridden via DETOX_AVD_NAME.
        avdName: process.env.DETOX_AVD_NAME || 'Detox_Stable_34',
      },
    },
    attached: {
      type: 'android.attached',
      device: {
        adbName: process.env.DETOX_ADB_NAME || getFirstAttachedDevice(),
        reversePorts: [8081, 3000, 8082],
      },
    },
  },
  configurations: {
    'android.emulator.debug': {
      device: 'emulator',
      app: 'android.debug',
    },
    'android.attached.debug': {
      device: 'attached',
      app: 'android.debug',
    },
    'android.attached.release': {
      device: 'attached',
      app: 'android.release',
    },
  },
  artifacts: {
    rootDir: 'artifacts/detox',
    plugins: {
      log: {
        enabled: true,
        keepOnlyFailedTestsArtifacts: false,
      },
      screenshot: {
        shouldTakeAutomaticSnapshots: true,
        keepOnlyFailedTestsArtifacts: false,
      },
      video: {
        enabled: false,
      },
      uiHierarchy: {
        enabled: true,
      },
    },
  },
};
