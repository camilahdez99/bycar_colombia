/**
 * ID del usuario guardado en localStorage. El login devuelve la fila de Oracle (ID_USU),
 * pero se aceptan también las variantes en minúsculas. Sin usuario devuelve undefined.
 */
export const getUserId = (user) => user?.ID_USU || user?.id_usu || user?.id;

/** Aviso cuando una acción necesita usuario y no hay ninguno guardado (BUGS F1). */
export const MENSAJE_SIN_SESION = 'Inicia sesión para continuar';
