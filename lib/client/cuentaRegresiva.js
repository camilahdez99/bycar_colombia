/**
 * Segundos restantes guardados fuera del estado de React (DT-35). El temporizador del guardián
 * los descuenta sin volver a renderizar el dashboard; solo se renderiza quien se suscribe
 * (con `useSyncExternalStore`). Devuelve `{ leer, fijar, suscribir }`.
 */
export function crearCuentaRegresiva() {
  let segundos = 0;
  const oyentes = new Set();

  return {
    leer: () => segundos,
    fijar: (valor) => {
      if (valor === segundos) return;
      segundos = valor;
      oyentes.forEach((oyente) => oyente());
    },
    suscribir: (oyente) => {
      oyentes.add(oyente);
      return () => oyentes.delete(oyente);
    },
  };
}

/**
 * Vencimiento del guardián en ms: hora de inicio ("YYYY-MM-DD HH:mm:ss", hora local, como la
 * devuelve la API) más los minutos estimados, que ya incluyen las extensiones.
 */
export function finDelGuardian(inicio, tiempoMin) {
  return new Date(inicio.replace(' ', 'T')).getTime() + Number(tiempoMin) * 60 * 1000;
}

/** Segundos enteros que faltan hasta `fin` (ms), redondeando hacia arriba; 0 si ya venció (BUGS F39). */
export function segundosHasta(fin, ahora) {
  return Math.max(Math.ceil((fin - ahora) / 1000), 0);
}
