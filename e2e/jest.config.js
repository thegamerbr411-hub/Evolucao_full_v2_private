module.exports = {
  rootDir: '..',
  testMatch: ['<rootDir>/e2e/[0-9][0-9]-*.e2e.js'],
  testTimeout: 240000,
  maxWorkers: 1,
  globalSetup: 'detox/runners/jest/globalSetup',
  globalTeardown: 'detox/runners/jest/globalTeardown',
  reporters: ['detox/runners/jest/reporter'],
  testEnvironment: 'detox/runners/jest/testEnvironment',
  setupFilesAfterEnv: ['<rootDir>/e2e/init.js'],
  verbose: true,
};
