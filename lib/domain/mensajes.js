/**
 * Lista de chats para la pestaña Mensajes: primero los de guardián (son del día y urgentes),
 * después los de viaje. Cada uno lleva su `tipo` y una `clave` única para la interfaz.
 */
export function unirChats(viajes, guardianes) {
  return [
    ...guardianes.map((chat) => ({ ...chat, tipo: 'guardian', clave: `guardian-${chat.guardianId}` })),
    ...viajes.map((chat) => ({ ...chat, tipo: 'viaje', clave: `viaje-${chat.chatId}` })),
  ];
}

/**
 * En un chat (una solicitud, o un guardián con su contacto) el receptor es el otro participante: si el emisor es el pasajero,
 * el conductor; en cualquier otro caso, el pasajero.
 */
export function calcularParticipantesMensaje(senderId, passengerId, driverId) {
  const emisorId = parseInt(senderId, 10);
  const receptorId = (emisorId === parseInt(passengerId, 10)) ? parseInt(driverId, 10) : parseInt(passengerId, 10);
  return { emisorId, receptorId };
}
