import { logError } from '@/lib/log';

/**
 * Cierra la conexión si se llegó a abrir. Un fallo al cerrar se registra y no reemplaza
 * la respuesta que ya se armó (antes se tragaba con un catch vacío).
 */
export async function closeConnection(connection, route) {
  if (!connection) return;
  try {
    await connection.close();
  } catch (error) {
    logError('db_close_failed', error, { route });
  }
}
