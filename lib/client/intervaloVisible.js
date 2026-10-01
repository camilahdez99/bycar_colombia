/**
 * Ejecuta `tarea` cada `ms` solo mientras la pestaña del navegador está visible (DT-33).
 * Al ocultarse se detiene; al volver ejecuta `tarea` enseguida, para no mostrar datos viejos,
 * y retoma el intervalo. Devuelve la función de limpieza, para retornarla desde un `useEffect`.
 */
export function iniciarIntervaloVisible(tarea, ms) {
  let intervalo = null;

  const arrancar = () => {
    if (intervalo === null) intervalo = setInterval(tarea, ms);
  };
  const detener = () => {
    clearInterval(intervalo);
    intervalo = null;
  };
  const alCambiarVisibilidad = () => {
    if (document.hidden) {
      detener();
    } else if (intervalo === null) {
      tarea();
      arrancar();
    }
  };

  if (!document.hidden) arrancar();
  document.addEventListener('visibilitychange', alCambiarVisibilidad);

  return () => {
    detener();
    document.removeEventListener('visibilitychange', alCambiarVisibilidad);
  };
}
