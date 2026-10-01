// Datos sintéticos de tamaño realista para los benchmarks (no salen de la BD)

/** 1 021 municipios, como el catálogo real (DT-12). */
export const MUNICIPIOS = Array.from({ length: 1021 }, (_, i) => ({ id: i + 1, nombre: `MUNICIPIO ${String(i + 1).padStart(4, '0')} BOYACA` }));

const ruta = (id, extra) => ({
  id, viajeId: id + 100, origen: 'BOGOTA', destino: 'TUNJA', conductor: 'LUIS PEREZ', placa: 'ABC123',
  carro: 'MAZDA', fecha: '2026-10-01', hora: '08:00', valor: '25.000', puestos: 3, estado: 'Aceptada', ...extra,
});

export const MIS_RUTAS = {
  publicadas: Array.from({ length: 10 }, (_, i) => ruta(i + 1)),
  solicitadas: Array.from({ length: 10 }, (_, i) => ruta(i + 50)),
};

export const CHATS = Array.from({ length: 5 }, (_, i) => ({ chatId: i + 1, nombre: `CONTACTO ${i + 1}`, ruta: 'BOGOTA → TUNJA', fecha: '2026-10-01' }));

/** Historial de un chat con 40 mensajes: se pide completo en cada refresco (DT-33). */
export const HISTORIAL_CHAT = Array.from({ length: 40 }, (_, i) => ({ senderId: i % 2 ? 7 : 8, text: `Mensaje número ${i + 1} para coordinar el punto de encuentro` }));

export const RECIBIDAS = Array.from({ length: 5 }, (_, i) => ({ id: i + 1, pasajero: `PASAJERO ${i + 1}`, ruta: 'BOGOTA → TUNJA', avatar: 'P' }));
