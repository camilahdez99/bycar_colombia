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
  },
});
