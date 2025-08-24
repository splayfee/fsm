/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  collectCoverage: true,
  coverageDirectory: 'coverage',
  collectCoverageFrom: ['src/**/*.{ts,tsx}'],
  coveragePathIgnorePatterns: [
    'src/defaults.d.ts',
    'src/enums/*',
    'src/index.ts',
    'src/jobs/index.ts',
    'src/interfaces/*',
    'src/types/*'
  ],
  coverageThreshold: {
    global: {
      branches: 0,
      functions: 0,
      lines: 0,
      statements: 0
    }
  },
  moduleFileExtensions: ['js', 'ts', 'tsx'],
  setupFiles: []
};
