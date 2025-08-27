import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    coverage: {
      enabled: true,
      provider: 'v8',
      reportsDirectory: 'coverage',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/defaults.d.ts',
        'src/enums/**',
        'src/index.ts',
        'src/jobs/index.ts',
        'src/interfaces/**',
        'src/types/**'
      ],
      thresholds: {
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80
      }
    }
    // setupFiles: [], // only add if you actually have setup files
  }
});
