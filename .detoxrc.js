module.exports = {
  testRunner: {
    args: {
      $0: 'jest',
      config: 'e2e/jest.config.js',
    },
    jest: {
      setupTimeout: 120000,
    },
  },
  apps: {
    'android.debug': {
      type: 'android.apk',
      binaryPath: 'android/app/build/outputs/apk/debug/app-debug.apk',
      testBinaryPath: 'android/app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk',
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
        adbName: process.env.DETOX_ADB_NAME || '.*',
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
