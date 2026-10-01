// Carga del front (DT-26, DT-41, DT-45): levanta el build de producción y mide cada página.
// Requiere `npm run build` antes. Corre con: npm run perf:front
// No necesita BD: las páginas se sirven igual; las llamadas a la API no se hacen desde acá.
import { spawn, execFileSync } from 'node:child_process';
import { gzipSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const PUERTO = 3210;
const BASE = `http://127.0.0.1:${PUERTO}`;
const RUTAS = ['/', '/login', '/dashboard', '/admin'];
const REPETICIONES = 15;
const REQUESTS_MEMORIA = 300;

const mediana = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const kb = (bytes) => +(bytes / 1024).toFixed(1);

async function esperarServidor() {
  for (let i = 0; i < 120; i++) {
    try {
      await fetch(BASE + '/login');
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  throw new Error('El servidor no respondió en 60 s');
}

/** Memoria residente del proceso del servidor, en MB (Windows: tasklist; resto: ps). */
function rssMb(pid) {
  if (process.platform === 'win32') {
    const linea = execFileSync('tasklist', ['/FI', `PID eq ${pid}`, '/FO', 'CSV', '/NH'], { encoding: 'utf8' });
    const kbTexto = linea.split('","')[4]?.replace(/[^\d]/g, '');
    return kbTexto ? +(Number(kbTexto) / 1024).toFixed(1) : null;
  }
  return +(Number(execFileSync('ps', ['-o', 'rss=', '-p', String(pid)], { encoding: 'utf8' })) / 1024).toFixed(1);
}

async function tiempos(url) {
  const ttfb = [];
  const total = [];
  let html = '';
  for (let i = 0; i < REPETICIONES; i++) {
    const t0 = performance.now();
    const res = await fetch(url);
    ttfb.push(performance.now() - t0);
    html = await res.text();
    total.push(performance.now() - t0);
  }
  return { ttfb: mediana(ttfb), total: mediana(total), html };
}

/** Texto visible que llega en el HTML del servidor (0 = la página se arma solo en el cliente). */
function textoSsr(html) {
  const body = html.split(/<body[^>]*>/)[1] ?? '';
  return body
    .replace(/<script[\s\S]*?<\/script>/g, '')
    .replace(/<style[\s\S]*?<\/style>/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim().length;
}

const recursos = (html, patron) => [...new Set([...html.matchAll(patron)].map((m) => m[1]))];

/** href de cada <link rel="stylesheet">, sin importar el orden de los atributos. */
const hojasDeEstilo = (html) => [...new Set(
  [...html.matchAll(/<link\b[^>]*>/g)]
    .map((m) => m[0])
    .filter((tag) => /rel="stylesheet"/.test(tag))
    .map((tag) => tag.match(/href="([^"]+)"/)?.[1].replace(/&amp;/g, '&'))
    .filter(Boolean),
)];

const importsDe = (css) => [...css.matchAll(/@import\s+(?:url\()?['"]?(https?:[^'")\s;]+)/g)].map((m) => m[1]);

/**
 * Ruta crítica del CSS en una primera visita (sin caché): HTML, después todas sus hojas en paralelo,
 * y cada @import recién cuando su hoja terminó de bajar. Es lo que el navegador espera antes de pintar.
 */
async function rutaCriticaCss(ruta) {
  const t0 = performance.now();
  const html = await (await fetch(BASE + ruta + '?sin-cache=' + Math.random())).text();
  await Promise.all(hojasDeEstilo(html).map(async (href) => {
    const css = await (await fetch(new URL(href, BASE), { cache: 'no-store' })).text();
    await Promise.all(importsDe(css).map(async (u) => (await fetch(u, { cache: 'no-store' })).text()));
  }));
  return performance.now() - t0;
}

async function pesoRecursos(urls) {
  let crudo = 0;
  let gzip = 0;
  const cuerpos = [];
  for (const u of urls) {
    const buf = Buffer.from(await (await fetch(new URL(u, BASE))).arrayBuffer());
    crudo += buf.length;
    gzip += gzipSync(buf).length;
    cuerpos.push(buf.toString('utf8'));
  }
  return { crudo, gzip, cuerpos };
}

async function medirRuta(ruta) {
  const { ttfb, total, html } = await tiempos(BASE + ruta);
  const js = await pesoRecursos(recursos(html, /<script[^>]+src="([^"]+)"/g));
  const css = await pesoRecursos(hojasDeEstilo(html));
  const critica = [];
  for (let i = 0; i < REPETICIONES; i++) critica.push(await rutaCriticaCss(ruta));
  const estilosEnLinea = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('');
  // @import externos dentro del CSS: cadena bloqueante CSS → CSS de fuentes → fuentes
  const importsExternos = [...css.cuerpos, estilosEnLinea].join('').match(/@import\s+(url\()?['"]?https?:/g)?.length ?? 0;
  return {
    ruta,
    'TTFB ms (mediana)': +ttfb.toFixed(1),
    'HTML ms (mediana)': +total.toFixed(1),
    'HTML KB (gzip)': kb(gzipSync(html).length),
    'texto SSR (chars)': textoSsr(html),
    'JS KB (gzip)': kb(js.gzip),
    'JS KB (crudo)': kb(js.crudo),
    'CSS KB (gzip)': kb(css.gzip + gzipSync(estilosEnLinea).length),
    '@import externos': importsExternos,
    'ruta crítica CSS ms (mediana)': +mediana(critica).toFixed(0),
  };
}

const servidor = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-p', String(PUERTO)], {
  cwd: process.cwd(),
  env: { ...process.env, NODE_ENV: 'production', PORT: String(PUERTO) },
  stdio: 'ignore',
});

try {
  await esperarServidor();
  // Calentar: la primera respuesta de cada ruta carga módulos
  for (const r of RUTAS) await (await fetch(BASE + r)).text();

  const rssInicial = rssMb(servidor.pid);
  const filas = [];
  for (const r of RUTAS) filas.push(await medirRuta(r));
  for (let i = 0; i < REQUESTS_MEMORIA; i++) await (await fetch(BASE + RUTAS[i % RUTAS.length])).text();
  const memoria = { 'RSS MB tras calentar': rssInicial, [`RSS MB tras ${REQUESTS_MEMORIA} requests`]: rssMb(servidor.pid) };

  console.log('\n=== Carga del front (build de producción) ===');
  console.table(filas);
  console.table([memoria]);

  const carpeta = join(process.cwd(), 'bench', 'resultados');
  mkdirSync(carpeta, { recursive: true });
  writeFileSync(join(carpeta, 'front.json'), JSON.stringify({ fecha: new Date().toISOString(), filas, memoria }, null, 2));
} finally {
  servidor.kill();
}
