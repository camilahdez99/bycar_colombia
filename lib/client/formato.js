/** Quita tildes y pasa a mayúsculas, para comparar nombres de municipios. */
export const normalizar = (str) => {
  return str.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
};

/**
 * Texto de una opción del autocompletado, que puede ser un string o un municipio { id, nombre }.
 * Un municipio sin nombre devuelve '' (no coincide con ninguna búsqueda) en lugar del objeto (BUGS F34).
 */
export const nombreDeOpcion = (opcion) => (typeof opcion === 'string' ? opcion : opcion?.nombre || '');

/** Segundos → "mm:ss". */
export const formatTiempo = (seg) => {
  const m = Math.floor(seg / 60);
  const s = seg % 60;
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
};

/** Deja solo dígitos y agrega separador de miles con coma. Falla con null (BUGS F8). */
export const formatCurrency = (value) => {
  const cleanValue = value.replace(/\D/g, "");
  return cleanValue.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};
