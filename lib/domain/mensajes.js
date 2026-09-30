/**
 * En un chat (una solicitud) el receptor es el otro participante: si el emisor es el pasajero,
 * el conductor; en cualquier otro caso, el pasajero.
 */
export function calcularParticipantesMensaje(senderId, passengerId, driverId) {
  const emisorId = parseInt(senderId, 10);
  const receptorId = (emisorId === parseInt(passengerId, 10)) ? parseInt(driverId, 10) : parseInt(passengerId, 10);
  return { emisorId, receptorId };
}
