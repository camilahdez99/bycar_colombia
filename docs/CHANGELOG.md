# Changelog

## 2026-09-28 — Fase 0: base de trabajo

**Qué cambió**
- Repositorio git propio en el proyecto (antes el repo era toda la carpeta de usuario). El commit inicial es el código tal como estaba.
- `scripts/fix_guardian.js` excluido localmente de git porque tiene credenciales hardcodeadas. El archivo no se modificó.
- Vitest + jsdom + Testing Library. Scripts `npm test` y `npm run test:watch`. Config en `vitest.config.mjs` (alias `@/`, pool `threads`).
- Tests de caracterización de humo: `lib/municipios` y la landing (`app/page.jsx`).
- `CLAUDE.md` con las reglas del proyecto y los comandos.
- Documentación inicial: `ARCHITECTURE.md`, `BUGS.md`, `BACKLOG.md`.

**Tests corridos**
- `npm test`: 2 archivos, 8 tests, todos OK.
- `npm run build`: OK.
- `npm run lint`: falla, igual que en la línea base (5 errores y 3 warnings previos; ninguno nuevo).

**Riesgos pendientes**
- Seguridad crítica: la API no tiene autenticación y las contraseñas están en texto plano (BUGS S1-S4).
- Dependencia transitiva: `postcss` pasó de 8.5.9 a 8.5.28 porque Vite lo exige. Afecta solo al pipeline de Tailwind; el build pasa.
- Cobertura de tests mínima: los route handlers y el dashboard todavía no tienen caracterización.
