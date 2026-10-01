// Respuestas de validación de los route handlers (BACKLOG DT-31); los validadores puros están en lib/domain/validadores.js.
import { NextResponse } from 'next/server';

/** Respuesta 400 con un mensaje para el cliente. */
export const badRequest = (error) => NextResponse.json({ error }, { status: 400 });

export const invalidJsonResponse = () => badRequest('El cuerpo no es un JSON válido');

export const JSON_INVALIDO = Symbol('json-invalido');

/** Body parseado, o JSON_INVALIDO si no se puede leer (antes se escapaba como 500, BUGS E1). */
export async function readJson(req) {
  try {
    return await req.json();
  } catch {
    return JSON_INVALIDO;
  }
}
