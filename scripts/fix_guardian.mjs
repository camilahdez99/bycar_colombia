// Agrega TIEMPO_ESTIMADO_GUA a GUARDIANES en bases creadas antes de que la columna estuviera en el esquema.
// scripts/postgres/01_esquema.sql ya la incluye: en una base nueva no hace nada. Se puede correr varias veces.
//
// Uso (credenciales por variables de entorno, nunca en el archivo):
//   node --env-file=.env.local scripts/fix_guardian.mjs

import { getConnection } from '../lib/db.js';

async function run() {
  if (!process.env.DATABASE_URL) {
    console.error('Falta DATABASE_URL. Usá --env-file con el archivo del entorno.');
    return 2;
  }

  const connection = await getConnection();
  try {
    console.log('Agregando TIEMPO_ESTIMADO_GUA a GUARDIANES...');
    await connection.execute('ALTER TABLE GUARDIANES ADD COLUMN IF NOT EXISTS TIEMPO_ESTIMADO_GUA NUMERIC');
    console.log('Listo: la columna existe.');
    return 0;
  } catch (error) {
    console.error(`Error: ${error.message}`);
    return 1;
  } finally {
    await connection.close();
  }
}

run()
  .then((code) => process.exit(code))
  .catch((error) => {
    console.error(`No se pudo conectar: ${error.message}`);
    process.exit(1);
  });
