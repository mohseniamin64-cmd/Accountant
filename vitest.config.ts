import {defineConfig} from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    env: {
      DATABASE_URL: 'postgres://test:test@127.0.0.1:5432/diaco_test',
    },
    include: [
      'server/**/*.test.ts',
      'shared/**/*.test.ts',
      'src/app/**/*.test.ts',
    ],
    coverage: {reporter: ['text', 'html']},
  },
});
