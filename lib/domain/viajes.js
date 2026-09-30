const PLACA_MAX = 6;
const COMENTARIOS_MAX = 500;

/**
 * Normaliza los datos de un viaje antes de insertarlo. No valida (BUGS F23):
 * - placa: solo alfanuméricos, recortada a 6 y en mayúsculas; si no es texto, lanza;
 * - puestos y valor pueden quedar NaN; el valor admite separador de miles con coma;
 * - comentarios: recortados a 500, o null si vienen vacíos.
 */
export function limpiarDatosViaje({ placa, puestos, valor, comentarios }) {
  return {
    cleanPlaca: placa.replace(/[^a-zA-Z0-9]/g, '').substring(0, PLACA_MAX).toUpperCase(),
    numPuestos: parseInt(puestos, 10),
    cleanComentarios: comentarios ? String(comentarios).substring(0, COMENTARIOS_MAX) : null,
    valorNum: parseFloat(String(valor).replace(/,/g, '')),
  };
}
