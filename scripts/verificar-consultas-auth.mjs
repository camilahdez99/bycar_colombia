// Verifica contra la base (Postgres/Supabase) las consultas de pertenencia (lib/auth/ownershipQueries.js) antes de prender AUTH_ENFORCED.
// Solo lectura: corre dentro de una transacción READ ONLY y termina con rollback.
//
// Uso (credenciales por variables de entorno, nunca por argumentos):
//   node --env-file=.env.local scripts/verificar-consultas-auth.mjs --usuario 7 --viaje 5 --solicitud 55 --guardian 77
// Todos los IDs son opcionales; se corren las consultas que tengan sus datos.

import { parseArgs } from 'node:util';
import { getConnection } from '../lib/db.js';
import {
  findSolicitudParticipants,
  findUserEmail,
  isGuardianParticipant,
  isViajeParticipant,
} from '../lib/auth/ownershipQueries.js';

const REQUIRED_ENV = ['DATABASE_URL'];

function readOptions() {
  const { values } = parseArgs({
    options: {
      usuario: { type: 'string' },
      viaje: { type: 'string' },
      solicitud: { type: 'string' },
      guardian: { type: 'string' },
    },
  });
  return values;
}

function buildChecks({ usuario, viaje, solicitud, guardian }) {
  const checks = [];
  if (solicitud) {
    checks.push(['findSolicitudParticipants', (c) => findSolicitudParticipants(c, solicitud)]);
  }
  if (usuario) checks.push(['findUserEmail', (c) => findUserEmail(c, usuario).then((correo) => (correo ? '(encontrado)' : null))]);
  if (usuario && viaje) checks.push(['isViajeParticipant', (c) => isViajeParticipant(c, viaje, usuario)]);
  if (usuario && guardian) checks.push(['isGuardianParticipant', (c) => isGuardianParticipant(c, guardian, usuario)]);
  return checks;
}

async function run() {
  const missing = REQUIRED_ENV.filter((name) => !process.env[name]);
  if (missing.length) {
    console.error(`Faltan variables de entorno: ${missing.join(', ')}. Usá --env-file con el archivo del entorno de prueba.`);
    return 2;
  }

  const checks = buildChecks(readOptions());
  if (!checks.length) {
    console.error('No hay nada para verificar: pasá al menos --solicitud, o --usuario (con --viaje / --guardian).');
    return 2;
  }

  // Sin autoCommit en esta conexión, para que la transacción READ ONLY dure toda la corrida
  const connection = await getConnection({ autoCommit: false });
  let failures = 0;
  try {
    await connection.execute('SET TRANSACTION READ ONLY');
    for (const [name, check] of checks) {
      const started = performance.now();
      try {
        const result = await check(connection);
        console.log(`OK    ${name} → ${JSON.stringify(result)} (${Math.round(performance.now() - started)} ms)`);
      } catch (error) {
        failures += 1;
        console.error(`ERROR ${name} → ${error.message}`);
      }
    }
  } finally {
    await connection.rollback();
    await connection.close();
  }
  return failures ? 1 : 0;
}

run()
  .then((code) => process.exit(code))
  .catch((error) => {
    console.error(`No se pudo verificar: ${error.message}`);
    process.exit(1);
  });
