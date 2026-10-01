import { defineConfig } from 'vitest/config';
import base from '../vitest.config.mjs';

// Benchmarks de performance: fuera de `npm test`, se corren con `npm run perf:dashboard`.
// No se usa mergeConfig porque concatena `include` en vez de reemplazarlo.
export default defineConfig({
  ...base,
  test: {
    ...base.test,
    include: ['bench/**/*.perf.{js,jsx}'],
    testTimeout: 120000,
    // Un archivo a la vez: los tiempos no se mezclan con otros workers
    fileParallelism: false,
  },
});
