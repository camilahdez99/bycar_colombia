// Respuestas de validación de los route handlers (BACKLOG DT-31); los validadores puros están en lib/domain/validadores.js.
import { NextResponse } from 'next/server';

/** Respuesta 400 con un mensaje para el cliente. */
export const badRequest = (error) => NextResponse.json({ error }, { status: 400 });
