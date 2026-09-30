# Rollout de autenticación (`AUTH_ENFORCED`)

Runbook para prender la autenticación en producción. Cubre S1, S2, S3 y S6 de `BUGS.md`.
Los pasos que tocan configuración o despliegue los ejecuta una persona del equipo: por la regla 7 de `CLAUDE.md`, Claude no toca credenciales ni configuración de producción.

**Revertir es inmediato:** con `AUTH_ENFORCED=false` y un redespliegue, la API vuelve a comportarse exactamente como antes. Las cookies de sesión que queden no afectan en nada.

---

## 0. Precondiciones

- [ ] Producción se sirve por **HTTPS**. En producción la cookie es `Secure`: por HTTP el navegador no la guarda y nadie podría autenticarse.
- [ ] El commit a desplegar pasa `npm test` y `npm run build`.
- [ ] Hay un entorno de prueba con Oracle y datos parecidos a los de producción (paso 1).

## 1. Entorno de prueba

1. Generar un secreto (≥ 32 caracteres). Tiene que ser distinto en prueba y en producción:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
   ```
2. Configurar `SESSION_SECRET` en el entorno de prueba.
3. **Verificar las consultas nuevas contra Oracle.** Corren en modo solo lectura. Elegí IDs reales de prueba: un usuario, un viaje donde tenga una solicitud aceptada, esa solicitud y un guardián de ese viaje.
   ```bash
   node --env-file=.env.local scripts/verificar-consultas-auth.mjs --usuario 7 --viaje 5 --solicitud 55 --guardian 77
   ```
   Se espera que las 4 líneas digan `OK`, con `true` en las dos de participación y los IDs correctos de pasajero y conductor. Repetir con un usuario que **no** participe: tiene que dar `false`. El aviso `MODULE_TYPELESS_PACKAGE_JSON` de Node es inofensivo.
4. Prender `AUTH_ENFORCED=true` en prueba y recorrer el flujo completo con dos usuarios, A (conductor) y B (pasajero):
   - [ ] Login de A y de B. En DevTools → Application → Cookies aparece `bycar_session` (HttpOnly).
   - [ ] A publica un viaje. B lo busca y solicita un cupo.
   - [ ] A ve la solicitud en "Solicitudes" y la acepta. B ve el cambio de estado en "Mis rutas".
   - [ ] Chat A↔B en los dos sentidos.
   - [ ] B activa el guardián (viaje aceptado de hoy), suma +15 min y lo finaliza. El contacto de confianza ve la alerta.
   - [ ] Login de admin: `/admin` carga, se edita una tabla y se gestionan permisos.
   - [ ] Borrar la cookie `bycar_session` con el dashboard abierto: en ≤ 10 s redirige a `/login`.
   - [ ] Logout: la cookie desaparece y `/dashboard` redirige a `/login`.
   - [ ] En los logs no aparece ningún `ownership_denied` durante este recorrido. Si aparece uno, hay un flujo legítimo que la regla bloquea: **no seguir**.

## 2. Producción, fase 1: emitir cookies (flag apagado)

1. Configurar `SESSION_SECRET` en producción, con un valor nuevo.
2. Desplegar con `AUTH_ENFORCED` **sin definir o en `false`**.
3. Verificar:
   - [ ] Al loguearse aparece la cookie `bycar_session` con los atributos HttpOnly y Secure.
   - [ ] Todo funciona igual que antes.

## 3. Espera (opcional)

Quien se logueó antes del paso 2 no tiene cookie. Al prender el flag lo redirige a `/login` una vez (`fetchConSesion`). Esperar unos días reduce la cantidad de usuarios afectados, pero no es obligatorio.

## 4. Producción, fase 2: prender el flag

1. Configurar `AUTH_ENFORCED=true` y redesplegar (la mayoría de las plataformas lo requieren para que tome variables nuevas).
2. Verificar desde afuera (reemplazar el dominio):
   ```bash
   curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" https://DOMINIO/dashboard
   ```
   ```bash
   curl -s -w " %{http_code}\n" "https://DOMINIO/api/admin/tablas?tabla=USUARIOS"
   ```
   ```bash
   curl -s -w " %{http_code}\n" "https://DOMINIO/api/viajes/mis-rutas?usuarioId=1"
   ```
   Se espera, en orden: `307 …/login`, `{"error":"No autenticado"} 401` y `{"error":"No autenticado"} 401`. **El segundo es el más importante:** antes devolvía todos los usuarios con sus contraseñas.
3. Repetir el recorrido del paso 1.4 en producción con cuentas de prueba.

## 5. Monitoreo (primeras 24–48 h)

Eventos estructurados (JSON) a buscar en los logs:

| Evento | Qué significa | Acción |
|---|---|---|
| `auth_misconfigured` | Flag prendido sin `SESSION_SECRET` válido: **todos** reciben 401 | Corregir la variable, o revertir (paso 6) |
| `session_invalid` | Cookie inválida o vencida (normal en poca cantidad) | Si hay picos justo después de desplegar, revisar si cambió el secreto |
| `ownership_denied` | Alguien intentó operar sobre un recurso ajeno | Pocos: intentos de abuso. Muchos del mismo endpoint: posible flujo legítimo mal cubierto, revisar la regla en `ARCHITECTURE.md` |

Además, vigilar la proporción de respuestas 401 y 403 por endpoint y los reportes de usuarios del tipo "me saca de la sesión".

## 6. Rollback

1. `AUTH_ENFORCED=false` y redesplegar. El comportamiento vuelve a ser el anterior de inmediato.
2. No hace falta borrar `SESSION_SECRET` ni las cookies.
3. Registrar en `CHANGELOG.md` qué se observó y por qué se revirtió.

**Rotar `SESSION_SECRET`** invalida todas las sesiones: todos tienen que volver a loguearse. Hacerlo si se sospecha que el secreto se filtró.

## Después del rollout

Queda pendiente (ver `BACKLOG.md`):
- **S4:** contraseñas en texto plano.
- **S5:** admin hardcodeado.
- **F3:** placa de otro usuario al publicar.

Los tres requieren trabajar la base de datos.
