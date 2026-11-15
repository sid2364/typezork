import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Served from https://sid2364.github.io/zork/
  base: '/zork/',
  build: {
    target: 'es2022',
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
