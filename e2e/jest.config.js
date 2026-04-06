const isCI = process.env.CI === 'true';

module.exports = {
  testRunner: 'jest-circus/runner',
  testTimeout: 180000,
  maxWorkers: 1,
  verbose: true,
  globalSetup: 'detox/runners/jest/globalSetup',
  globalTeardown: 'detox/runners/jest/globalTeardown',
  testEnvironment: 'detox/runners/jest/testEnvironment',
  reporters: ['detox/runners/jest/reporter'],
  setupFilesAfterEnv: ['./init.js'],
  testMatch: isCI ? ['**/flow.test.js'] : ['**/*.test.js'],
};
