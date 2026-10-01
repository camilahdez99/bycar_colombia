import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import { transformWithOxc } from 'vite';
import react from '@vitejs/plugin-react';

// Next acepta JSX en archivos .js (app/layout.js); Vite solo lo habilita por extensión
const jsxEnArchivosJs = {
  name: 'jsx-en-archivos-js',
  enforce: 'pre',
  transform(code, id) {
    if (!/\.js$/.test(id) || id.includes('/node_modules/') || !code.includes('</')) return null;
    return transformWithOxc(code, id, { lang: 'jsx', jsx: { runtime: 'automatic' } });
  },
};

export default defineConfig({
  plugins: [jsxEnArchivosJs, react()],
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
