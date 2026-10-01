import { enteroPositivo, numeroPositivo } from '@/lib/domain/validadores';

const PLACA_MAX = 6;
const COMENTARIOS_MAX = 500;
const FECHA_ISO = /^\d{4}-\d{2}-\d{2}$/;

const soloAlfanumericos = (texto) => texto.replace(/[^a-zA-Z0-9]/g, '');

/**
 * Valida los datos de un viaje nuevo, ya chequeada la presencia de los campos.
 * Devuelve el mensaje de error para el cliente, o null si son válidos (BUGS F23).
 */
export function validarDatosViaje({ placa, fecha, puestos, valor }) {
  if (typeof placa !== 'string') return 'La placa debe ser un texto';
  const placaLimpia = soloAlfanumericos(placa);
  if (!placaLimpia || placaLimpia.length > PLACA_MAX) {
    return `La placa debe tener entre 1 y ${PLACA_MAX} letras o números`;
  }
  if (typeof fecha !== 'string' || !FECHA_ISO.test(fecha)) return 'La fecha debe tener el formato AAAA-MM-DD';
  if (!enteroPositivo(puestos)) return 'Los puestos deben ser un número entero mayor a 0';
  if (!numeroPositivo(valor)) return 'El valor debe ser un número mayor a 0';
  return null;
}

/**
 * Normaliza los datos de un viaje antes de insertarlo; se llama después de validarDatosViaje.
 * - placa: solo alfanuméricos y en mayúsculas;
 * - valor: admite separador de miles con coma;
 * - comentarios: recortados a 500, o null si vienen vacíos.
 */
export function limpiarDatosViaje({ placa, puestos, valor, comentarios }) {
  return {
    cleanPlaca: soloAlfanumericos(placa).substring(0, PLACA_MAX).toUpperCase(),
    numPuestos: parseInt(puestos, 10),
    cleanComentarios: comentarios ? String(comentarios).substring(0, COMENTARIOS_MAX) : null,
    valorNum: parseFloat(String(valor).replace(/,/g, '')),
  };
}

/**
 * ID de catálogo (municipio o marca) si el valor es un número entero completo ("5", 8).
 * Un texto que solo empieza con dígitos ("2024 Mazda") ya no se toma como ID (BUGS F6).
 */
export const idDeCatalogo = (valor) => enteroPositivo(typeof valor === 'number' ? valor : String(valor).trim());
