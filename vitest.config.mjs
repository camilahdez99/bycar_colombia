import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Replica el alias "@/*" de jsconfig.json
    alias: { '@': fileURLToPath(new URL('./', import.meta.url)) },
  },
  test: {
    environment: 'jsdom',
    // "forks" no logra iniciar el worker en entornos con IPC restringido
    pool: 'threads',
    include: ['__tests__/**/*.test.{js,jsx}'],
    // Solo con `npm run test:coverage`; `npm test` no la calcula
    coverage: {
      provider: 'v8',
      include: ['app/**/*.{js,jsx}', 'lib/**/*.js', 'components/**/*.jsx', 'proxy.js'],
      // El provider no parsea JSX en un .js que ningún test importa
      exclude: ['app/layout.js'],
      reporter: ['text', 'json-summary'],
    },
  },
});
