import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const CARPETA = join(process.cwd(), 'bench', 'resultados');

/** Imprime la tabla y la guarda en bench/resultados/<slug>.json para comparar antes/después. */
export function reportar(titulo, filas) {
  process.stdout.write(`\n=== ${titulo} ===\n`);
  console.table(filas);
  mkdirSync(CARPETA, { recursive: true });
  const slug = titulo.split(' ')[0].toLowerCase();
  writeFileSync(join(CARPETA, `${slug}.json`), JSON.stringify({ titulo, fecha: new Date().toISOString(), filas }, null, 2));
}
