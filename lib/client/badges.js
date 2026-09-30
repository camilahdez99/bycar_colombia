/**
 * Cantidad a mostrar en el badge de cada menú del dashboard.
 * `estado` trae la pestaña activa y los datos que ya cargó el dashboard.
 */
export const getBadgeCount = (url, {
  activePage,
  solicitudesRecibidas,
  rutasSolicitadas,
  rutasSolicitadasLeidas,
  mensajes,
  mensajesLeidos,
  alertasRecibidas,
}) => {
  if (url === '/solicitudes') {
    return solicitudesRecibidas.length;
  }
  if (url === '/mis-rutas') {
    return activePage !== 'mis-rutas'
      ? rutasSolicitadas.filter(r => {
          const esCambio = r.estado?.toUpperCase().startsWith('ACEPTAD') || r.estado?.toUpperCase().startsWith('RECHAZAD');
          if (!esCambio) return false;
          // Mostrar badge solo si el estado actual es diferente al que el usuario vio/leyó
          return rutasSolicitadasLeidas[r.id] !== r.estado;
        }).length
      : 0;
  }
  if (url === '/mensajes') {
    // Mostrar la cantidad de chats NUEVOS que aún no ha visto
    const nuevos = mensajes.length - mensajesLeidos;
    return activePage !== 'mensajes' && nuevos > 0 ? nuevos : 0;
  }
  if (url === '/guardian') {
    return alertasRecibidas.filter(a => a.estado?.toUpperCase() === 'ALERTA').length;
  }
  return 0;
};
