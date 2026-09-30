/** Quita tildes y pasa a mayúsculas, para comparar nombres de municipios. */
export const normalizar = (str) => {
  return str.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
};

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
