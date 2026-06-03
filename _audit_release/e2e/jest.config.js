module.exports = {
  rootDir: '..',
  testMatch: [
    '<rootDir>/e2e/[0-9][0-9]-*.e2e.js',
    '<rootDir>/e2e/semantic/[0-9][0-9]-*.e2e.js',
  ],
  transform: {},
  testTimeout: 240000,
  maxWorkers: 1,
  globalSetup: 'detox/runners/jest/globalSetup',
  globalTeardown: 'detox/runners/jest/globalTeardown',
  reporters: ['detox/runners/jest/reporter'],
  testEnvironment: 'detox/runners/jest/testEnvironment',
  setupFilesAfterEnv: ['<rootDir>/e2e/init.js'],
  modulePathIgnorePatterns: [
    '<rootDir>/_audit_release/',
    '<rootDir>/dist_clean_project/',
  ],
  verbose: true,
};
