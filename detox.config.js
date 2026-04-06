const path = require('path');

// Ensure Detox can resolve adb even in fresh/background shells.
if (!process.env.ANDROID_SDK_ROOT && process.env.LOCALAPPDATA) {
  process.env.ANDROID_SDK_ROOT = path.join(process.env.LOCALAPPDATA, 'Android', 'Sdk');
}

if (!process.env.ANDROID_HOME && process.env.ANDROID_SDK_ROOT) {
  process.env.ANDROID_HOME = process.env.ANDROID_SDK_ROOT;
}

module.exports = {
  testRunner: {
    args: {
      '$0': 'jest',
      config: 'e2e/jest.config.js',
    },
    jest: {
      setupTimeout: 120000,
    },
  },
  artifacts: {
    rootDir: 'artifacts',
    plugins: {
      log: {
        enabled: true,
        keepOnlyFailedTestsArtifacts: false,
      },
      screenshot: {
        enabled: true,
        keepOnlyFailedTestsArtifacts: false,
        shouldTakeAutomaticSnapshots: true,
        takeWhen: {
          testStart: true,
          testDone: true,
          appNotReady: true,
          testFailure: true,
        },
      },
      video: {
        enabled: true,
        keepOnlyFailedTestsArtifacts: false,
      },
      instruments: { enabled: false },
      uiHierarchy: { enabled: true },
    },
  },
  devices: {
    attached: {
      type: 'android.attached',
      device: {
        adbName: '.*',
      },
    },
    emulator: {
      type: 'android.emulator',
      device: {
        avdName: 'test',
      },
    },
  },
  apps: {
    'android.debug': {
      type: 'android.apk',
      binaryPath: 'android/app/build/outputs/apk/debug/app-debug.apk',
      testBinaryPath: 'android/app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk',
      build:
        'powershell -ExecutionPolicy Bypass -Command "Set-Location android; .\\gradlew.bat assembleDebug assembleAndroidTest -DtestBuildType=debug"',
      reversePorts: [8081],
    },
    'android.emu.debug': {
      type: 'android.apk',
      binaryPath: 'android/app/build/outputs/apk/debug/app-debug.apk',
      testBinaryPath: 'android/app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk',
      build: 'cd android && ./gradlew assembleDebug assembleAndroidTest -DtestBuildType=debug',
      reversePorts: [8081],
    },
  },
  configurations: {
    'android.attached': {
      device: 'attached',
      app: 'android.debug',
    },
    'android.emu.debug': {
      device: 'emulator',
      app: 'android.emu.debug',
    },
  },
};
