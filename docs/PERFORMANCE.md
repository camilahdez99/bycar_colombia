# Performance — mediciones y optimizaciones

Línea base tomada el 2026-10-01 sobre `7e19e1b` (rama `mejoras/backlog-pendiente`), en el worktree `perf/mediciones`.
Máquina: Windows 11, 8 núcleos, Node 24.19. Sin BD local (no hay `.env.local`): ver [Fuera de alcance](#fuera-de-alcance-bd-pendiente).

Regla de aceptación: una optimización se queda solo si mejora **al menos 10 %** la métrica principal de su ítem; si no, se revierte.

## Cómo reproducir

| Benchmark | Comando | Qué mide | Ítems |
|---|---|---|---|
| `bench/dashboard-polling.perf.jsx` | `npm run perf:dashboard` | Requests y KB por minuto del dashboard en régimen estable (10 min simulados con relojes falsos), por pestaña y con la pestaña del navegador visible u oculta. | DT-33 |
| `bench/dashboard-guardian-timer.perf.jsx` | `npm run perf:dashboard` | Con el guardián activo: commits de React por segundo (Profiler), llamadas a `normalizar()` por segundo (filtro del Autocomplete), ms de render, y desfase del contador tras 5 min en segundo plano. | DT-35 |
| `bench/front-load.mjs` | `npm run build && npm run perf:front` | Contra `next start` (producción): TTFB, peso de HTML/JS/CSS (gzip), texto que llega renderizado del servidor, `@import` externos, ruta crítica del CSS en primera visita y RSS del servidor. | DT-26, DT-41, DT-45 |
| `bench/browser-metrics.js` | Pegar en la consola de Chromium | FCP, LCP, DCL, fuentes y heap de JS. Uso manual: el panel del navegador integrado estaba oculto y no emite eventos de pintado. | DT-26, DT-45 |

Los resultados quedan en `bench/resultados/*.json` (ignorado por git). Los datos de prueba son sintéticos y de tamaño realista (`bench/fixtures.js`: 1 021 municipios, 20 rutas, 5 chats, historial de 40 mensajes).

**Ruido:** los conteos (requests, commits, llamadas) son deterministas. Los milisegundos en jsdom variaron hasta 7× entre corridas por la carga de la máquina (otras sesiones compilando en paralelo), así que se informan como dato secundario con su rango y no se usan para aceptar o rechazar.

## Línea base

### DT-33 · Polling del dashboard (3 corridas, valores idénticos)

| Escenario | requests/min | KB/min | Detalle |
|---|---|---|---|
| Inicio, pestaña visible | 12 | 26,3 | `mis-rutas` 6/min, `chats` 6/min |
| Inicio, pestaña **oculta** | 12 | 26,3 | igual que visible: no se pausa |
| Mensajes, chat abierto (40 msjs) | 32 | 87,8 | `mensajes?chatId` 20/min (historial completo cada 3 s), `mis-rutas` 6/min, `chats` 6/min |
| Mensajes, chat abierto, pestaña **oculta** | 32 | 87,8 | igual que visible |

Cada request abre y cierra una conexión a Oracle (BD-06): con el chat abierto son 32 conexiones por minuto y por usuario, aunque nadie esté mirando la pestaña.

### DT-35 · Temporizador del guardián (3 corridas)

| Escenario | commits/s del dashboard | `normalizar()`/s | ms render/s (rango) |
|---|---|---|---|
| Inicio, buscando un municipio en el Autocomplete | 1,1 | 1 125 | 24–38 |
| Pestaña Guardián (mirando el contador) | 1,1 | 0 | 12–91 |
| Desfase tras 5 min en segundo plano (1 tick/min) | — | — | muestra `29:55`, debería `25:00`: **295 s de error** |

Cada segundo se vuelve a renderizar el dashboard entero (1 255 líneas); en Inicio, cada tick refiltra los 1 021 municipios. El 0,1 commits/s extra viene del polling (DT-33). El desfase es el bug F39 (`docs/BUGS.md`, relacionado con F28): se registra acá como métrica, pero no se corrige dentro de una optimización.

### Carga del front (build de producción, mediana de 15 requests × 3 corridas)

| Ruta | TTFB ms | HTML KB gz | Texto SSR (chars) | JS KB gz (crudo) | CSS KB gz | `@import` externos | Ruta crítica CSS ms |
|---|---|---|---|---|---|---|---|
| `/` | 13–14 | 6,7 | 1 331 | 191 (644) | 8,1 | 1 | 113–122 |
| `/login` | 13–15 | 3,0 | 281 | 191 (640) | 5,1 | 1 | 110–124 |
| `/dashboard` | 14–16 | 2,3 | **0** | 201 (687) | 5,1 | 1 | 112–118 |
| `/admin` | 14–15 | 2,3 | **0** | 191 (639) | 5,1 | 1 | 111–115 |

- **RSS del servidor:** 98–102 MB tras calentar, 115–139 MB tras 300 requests.
- **Texto SSR 0** en dashboard y admin: `HydrationWrapper` renderiza `null` hasta montar (DT-41); el usuario ve la página en blanco hasta que baja y corre todo el JS.
- **`@import` externo:** `globals.css` importa Google Fonts (Syne y DM Sans) con `@import`. El navegador recién lo descubre cuando terminó de bajar el CSS de la app, así que son dos viajes en serie que bloquean el render en todas las páginas (DT-26).
- **Navegador (Chromium, primera visita a `/`):** el CSS de la app terminó a los 631 ms y el CSS de Google Fonts recién empezó a los 696 ms y terminó a los 1 064 ms. Es el último recurso que bloquea el render. Con caché caliente, la diferencia desaparece (todo termina en 25–60 ms).

## Fuera de alcance (`bd-pendiente`)

- **Latencia de la API:** no se midió de punta a punta porque no hay BD local. El costo dominante es abrir una conexión por request (BD-06, sin pool). Ninguna optimización de este documento toca queries, conexiones ni el driver.
- **Historial del chat incremental:** `GET /api/mensajes?chatId` devuelve el historial completo cada 3 s (20 req/min, ~62 KB/min con 40 mensajes). Pedir solo los mensajes nuevos requiere una query con filtro por ID o fecha: se registra como `bd-pendiente` (BD-19 en `docs/BACKLOG.md`).

## Optimizaciones propuestas (ganancia estimada / riesgo)

| # | Ítem | Cambio | Ganancia estimada | Riesgo | Estado |
|---|---|---|---|---|---|
| 1 | DT-33a | Pausar el polling (10 s y chat de 3 s) mientras `document.hidden`; al volver, refrescar enseguida. | −100 % de requests con la pestaña oculta (12→0 y 32→0 por min) | bajo | ✅ aplicada |
| 2 | DT-26 (acotado) | Sacar el `@import` de Google Fonts de `globals.css` y cargarlo con `<link>` + `preconnect` en el layout. No toca las 42 referencias literales a `'Syne'`/`'DM Sans'`. | Descubrimiento en paralelo con el CSS de la app: menos ruta crítica en primera visita | bajo | ❌ revertida (no llega al 10 %) |
| 3 | DT-35 | Mover el contador a un componente propio para que el tick no vuelva a renderizar el dashboard ni refiltre municipios. Sin tocar la forma de descontar (F39 va aparte). | −90 % o más de commits del dashboard por segundo; `normalizar()`/s de 1 125 a 0 | medio | ✅ aplicada |
| 4 | DT-41 | Quitar `HydrationWrapper` del dashboard y del admin (leer `localStorage` en efectos) para que el servidor mande HTML. | Texto SSR > 0; pinta antes que el JS | medio | espera DT-38 (sesión 4 mueve el archivo) |
| 5 | DT-45 | Landing como server component; el cliente solo para contador, nav y animaciones. | Menos JS en `/` | medio | ⚠️ medida: −1,6 % de JS, no llega al 10 % (rama `mejoras/varios`, decide la usuaria) |

## Resultados (antes / después)

_Se completa a medida que se aplica cada optimización._

### DT-33a · polling pausado con la pestaña oculta — ✅ aplicada

Cambio: `lib/client/intervaloVisible.js` (`iniciarIntervaloVisible`) reemplaza los dos `setInterval` del dashboard (refresco cada 10 s y chat cada 3 s). Con `document.hidden` no consulta; al volver ejecuta enseguida (el usuario no ve datos viejos) y retoma el intervalo. No cambia nada con la pestaña visible ni toca la API. Tests: `__tests__/lib/client/intervaloVisible.test.js` (5) y `__tests__/app/dashboard-polling.test.jsx` (2, fallan sin el cambio).

| Escenario | requests/min antes → después | KB/min antes → después |
|---|---|---|
| Inicio, pestaña visible | 12 → 12 | 26,3 → 26,3 |
| Inicio, pestaña **oculta** | 12 → **0** (−100 %) | 26,3 → **0** |
| Mensajes, chat abierto | 32 → 32 | 87,8 → 87,8 |
| Mensajes, chat abierto, pestaña **oculta** | 32 → **0** (−100 %) | 87,8 → **0** |

Con la pestaña visible el costo sigue igual. Bajarlo ahí requiere pedir solo los mensajes nuevos (BD-19, `bd-pendiente`) o unificar los endpoints en uno de resumen (cambio de contrato de API: hay que consultarlo).

### DT-35 · tick del guardián fuera del estado raíz — ✅ aplicada

Cambio: los segundos restantes viven en `lib/client/cuentaRegresiva.js` (fuera del estado de React) y solo `components/dashboard/ContadorGuardian.jsx` se suscribe, con `useSyncExternalStore`. El intervalo (en `hooks/dashboard/useGuardian.js`) solo toca el estado del dashboard al cruzar la pre-alerta o la alerta; los `toast` y el `PUT` salieron del updater de `setState`. La forma de descontar no cambió: el desfase (F39) se mantiene a propósito. Tests: los 98 del dashboard sin cambios y `__tests__/lib/client/cuentaRegresiva.test.js` (4).

Medido con `npm run perf:dashboard`, antes y después en la misma máquina y sesión (3 corridas después; el "antes" es la línea base del mismo día):

| Escenario | commits/s antes → después | `normalizar()`/s antes → después | ms render/s (Profiler) antes → después |
|---|---|---|---|
| Inicio, buscando un municipio | 1,1 → **0,1** (−91 %) | 1 125 → **102** (−91 %) | 8,1 → **0,6** |
| Pestaña Guardián | 1,1 → 1,1 | 0 → 0 | 4,4 → **0,9–1,4** |
| Desfase tras 5 min oculto | — | — | 295 s → 295 s (F39, sin tocar; corregido después, ver abajo) |

El 0,1 commits/s que queda en Inicio es el polling de 10 s (DT-33), y con él las 102 llamadas a `normalizar()`/s. En la pestaña Guardián el Profiler sigue contando un commit por segundo, pero ahora solo se renderiza el panel del contador.

### F39 · contador del guardián contra el reloj — ✅ corregido

No es una optimización sino un bug, pero se mide con el mismo benchmark: tras 5 min con la pestaña en segundo plano (1 tick por minuto) el contador mostraba `29:55` en vez de `25:00`. Ahora cada tick calcula contra el vencimiento: **desfase 295 s → 0 s**. Commits/s y ms de render no cambian.

### DT-45 · landing como server component — ⚠️ medida, no llega al umbral

Lo implementó otra sesión en la rama `mejoras/varios` (`89e4ec9`), todavía sin integrar. Medido con el mismo `bench/front-load.mjs` sobre un build de esa rama (3 corridas):

| Métrica `/` | Antes | Después | Δ |
|---|---|---|---|
| JS KB gzip (crudo) | 191,3 (644) | 188,2 (630) | −1,6 % |
| HTML KB gzip | 6,7 | 8,5 | +27 % |
| Texto SSR (chars) | 1 331 | 1 331 | = (ya se renderizaba en el servidor) |
| TTFB ms | 13–14 | 12–14 | = |
| CSS KB gzip | 8,1 | 8,1 | = |

Casi todo el JS de `/` es el runtime compartido de Next y React (`/login` también pesa 191 KB), así que sacar la página del cliente ahorra poco. **Según la regla del 10 %, no se justificaría por performance.** Puede tener sentido por legibilidad, pero eso lo decidís vos al integrar la rama. No se revirtió nada acá porque el cambio no está en esta rama.

### DT-26 (acotado) · fuentes con `<link>` en lugar de `@import` — ❌ revertida

Cambio probado: quitar la línea 1 de `globals.css` y cargar la misma URL con `<link rel="stylesheet" precedence>` más `preconnect` a `fonts.googleapis.com` y `fonts.gstatic.com` desde `app/layout.js`. Antes se agregó el test de caracterización `__tests__/app/layout.test.jsx`, que exige que las fuentes se pidan una sola vez con las mismas familias y pesos. Ese test se queda.

| Métrica (3 corridas, mediana de 15) | Antes | Después |
|---|---|---|
| `@import` externos en el CSS | 1 | 0 |
| Ruta crítica CSS `/` (ms) | 113–122 | 101–165 |
| Ruta crítica CSS `/login` (ms) | 110–124 | 102–110 |
| Ruta crítica CSS `/dashboard` (ms) | 112–118 | 101–135 |
| TTFB `/` (ms), control de ruido | 13–14 | 23–28 |

**Por qué no alcanza el 10 %:** lo único que el cambio saca de la cadena serial es la descarga del CSS de la app, y con el servidor en `localhost` eso tarda 2 a 5 ms de un total de ~110 ms (el resto es Google Fonts, igual en las dos variantes). Encima, la máquina estaba más cargada en la segunda tanda (el TTFB de control casi se duplicó), así que la diferencia queda dentro del ruido. En producción, con el servidor lejos, la ganancia sería un RTT al servidor: en la primera visita medida en Chromium, el CSS de Google Fonts empezó 65 ms después de terminar el CSS de la app (631 → 696 ms), alrededor del 6 % del bloqueo total de 1 064 ms. Tampoco llega al umbral.

**Si se retoma:** la ganancia real está en no depender de Google Fonts para pintar (`next/font` autoaloja y precarga), lo que exige reemplazar las 42 referencias literales (DT-26 completo, riesgo medio).
