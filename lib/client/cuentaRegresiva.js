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
