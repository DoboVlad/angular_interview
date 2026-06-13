import { defineConfig } from 'vitest/config';
import angular from '@analogjs/vite-plugin-angular';

// Angular 22 ships Vitest as the default unit-test runner. The Analog Angular
// plugin handles the Angular template/decorator compilation for `.spec.ts` files.
export default defineConfig({
  plugins: [angular()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['src/test-setup.ts'],
    include: ['src/**/*.spec.ts'],
    reporters: ['default'],
  },
});
