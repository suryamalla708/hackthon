module.exports = {
  testEnvironment: 'node',
  testTimeout: 30000,
  testMatch: ['**/tests/**/*.test.js'],
  forceExit: true,
  detectOpenHandles: true,
  // Collect coverage for all source files
  collectCoverageFrom: ['src/**/*.js'],
  // Run tests serially to avoid race conditions with in-memory DB
  maxWorkers: 1,
};
