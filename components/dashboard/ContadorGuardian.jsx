'use client';

import { useSyncExternalStore } from 'react';

/**
 * Se suscribe a la cuenta regresiva del guardián y le pasa los segundos restantes a `children`.
 * Solo este subárbol se vuelve a renderizar en cada tick, no el dashboard entero (DT-35).
 */
export default function ContadorGuardian({ cuenta, children }) {
  const segundos = useSyncExternalStore(cuenta.suscribir, cuenta.leer, cuenta.leer);
  return children(segundos);
}
