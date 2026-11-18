/**
 * Lista de chats para la pestaña Mensajes: primero los vigentes (se puede escribir) y después el
 * historial. Dentro de cada grupo, los de guardián (urgentes) antes que los de viaje.
 * Cada uno lleva su `tipo`, una `clave` única para la interfaz y `vigente` (true si falta).
 */
export function unirChats(viajes, guardianes) {
  const todos = [
    ...guardianes.map((chat) => ({ ...chat, tipo: 'guardian', clave: `guardian-${chat.guardianId}` })),
    ...viajes.map((chat) => ({ ...chat, tipo: 'viaje', clave: `viaje-${chat.chatId}` })),
  ].map((chat) => ({ ...chat, vigente: chat.vigente !== false }));
  return [...todos.filter((c) => c.vigente), ...todos.filter((c) => !c.vigente)];
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
