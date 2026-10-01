// Métricas de carga en un navegador Chromium. Uso: con `next start -p 3210` levantado,
// abrir la página, recargar sin caché (Ctrl+Shift+R) y pegar esto en la consola.
// Repetir 5 veces por página y tomar la mediana.
(async () => {
  const lcp = await new Promise((resolve) => {
    new PerformanceObserver((lista) => {
      const entradas = lista.getEntries();
      resolve(entradas[entradas.length - 1]?.startTime ?? null);
    }).observe({ type: 'largest-contentful-paint', buffered: true });
    setTimeout(() => resolve(null), 3000);
  });
  await document.fonts.ready;
  const nav = performance.getEntriesByType('navigation')[0];
  const fcp = performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? null;
  const fuentes = performance.getEntriesByType('resource').filter((r) => /fonts\.(googleapis|gstatic)/.test(r.name));
  return {
    ruta: location.pathname,
    'FCP ms': Math.round(fcp),
    'LCP ms': lcp && Math.round(lcp),
    'DOMContentLoaded ms': Math.round(nav.domContentLoadedEventEnd),
    'load ms': Math.round(nav.loadEventEnd),
    'fuentes listas ms': Math.round(Math.max(0, ...fuentes.map((r) => r.responseEnd))),
    'requests a Google Fonts': fuentes.length,
    'heap JS MB': performance.memory ? +(performance.memory.usedJSHeapSize / 1048576).toFixed(1) : null,
  };
})();
