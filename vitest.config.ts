import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: [
      'src/**/__tests__/**/*.test.ts',
      'src/**/__tests__/**/*.test.tsx',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      include: [
        'src/features/**/utils/*.ts',
        'src/features/**/validations/*.ts',
        'src/features/approvals/permissions/index.ts',
        'src/features/claims/permissions/index.ts',
        'src/lib/utils/*.ts',
        'src/lib/validations/*.ts',
      ],
      exclude: ['**/__tests__/**', '**/*.d.ts'],
      thresholds: {
        perFile: true,
        lines: 90,
        functions: 90,
        branches: 85,
        statements: 90,
      },
    },
  },
})
