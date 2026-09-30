/**
 * Feature flag CATALOG_CACHE_SECONDS: segundos que el navegador puede reutilizar los catálogos
 * públicos (menús, marcas, municipios). Sin configurar, o con un valor inválido, no se envía
 * Cache-Control y las respuestas quedan como antes. Un menú nuevo puede tardar ese tiempo en verse.
 */
export function catalogCacheHeaders() {
  const seconds = Number(process.env.CATALOG_CACHE_SECONDS);
  if (!Number.isInteger(seconds) || seconds <= 0) return undefined;
  return { 'Cache-Control': `public, max-age=${seconds}` };
}
