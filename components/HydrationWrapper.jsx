"use client";
import { useSyncExternalStore } from 'react';

const sinSuscripcion = () => () => {};

/**
 * Renderiza los hijos solo en el cliente: en el servidor y durante la hidratación devuelve
 * vacío, así lo que lee `localStorage` no genera diferencias de hidratación.
 */
export default function HydrationWrapper({ children }) {
  const enCliente = useSyncExternalStore(sinSuscripcion, () => true, () => false);

  return (
    <div suppressHydrationWarning style={{ display: 'contents' }}>
      {enCliente ? children : null}
    </div>
  );
}
