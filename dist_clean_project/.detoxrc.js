const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');

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

const androidDebugBinary = path.join('android', 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');
const androidTestBinary = path.join('android', 'app', 'build', 'outputs', 'apk', 'androidTest', 'debug', 'app-debug-androidTest.apk');
const jestBinary = process.platform === 'win32'
  ? path.join('node_modules', '.bin', 'jest.cmd')
  : path.join('node_modules', '.bin', 'jest');

module.exports = {
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
      build: 'cd android && gradlew.bat assembleDebug assembleAndroidTest -DtestBuildType=debug',
    },
    'android.release': {
      type: 'android.apk',
      binaryPath: 'android/app/build/outputs/apk/release/app-release.apk',
      testBinaryPath: 'android/app/build/outputs/apk/androidTest/release/app-release-androidTest.apk',
      build: 'cd android && gradlew.bat assembleRelease assembleAndroidTest -DtestBuildType=release',
    },
  },
  devices: {
    emulator: {
      type: 'android.emulator',
      device: {
        avdName: process.env.DETOX_AVD_NAME || 'Pixel_4_API_30',
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
      // Mapeado para release para estabilidade no device físico com RN 0.83.
      app: 'android.release',
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
        keepOnlyFailedTestsArtifacts: true,
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
