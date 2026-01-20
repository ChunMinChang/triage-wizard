import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Use jsdom for DOM testing
    environment: 'jsdom',

    // Test file patterns
    include: ['src/**/*.{test,spec}.{js,mjs}', 'src/__tests__/**/*.{js,mjs}'],

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.js'],
      exclude: ['src/__tests__/**'],
    },

    // Global test timeout
    testTimeout: 10000,

    // Reporter
    reporters: ['verbose'],
  },
});
