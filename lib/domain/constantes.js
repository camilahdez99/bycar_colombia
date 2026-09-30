// IDs fijos de las tablas de catálogo (ver scripts/insercion_data_DML.txt).
// Los literales que están dentro del SQL todavía no usan estas constantes (BACKLOG BD-07).

export const ESTADO_SOLICITUD = Object.freeze({
  PENDIENTE: 1,
  ACEPTADA: 2,
  RECHAZADA: 3,
  CANCELADA: 4,
});

export const PERFIL = Object.freeze({
  USUARIO_ESTANDAR: 2,
});

/** Menú "Inicio": sus hijos (crear / buscar ruta) son acciones, no pestañas. */
export const MENU_INICIO_ID = 1;

/** Tiempo estimado del guardián cuando no se indica otro. */
export const TIEMPO_GUARDIAN_POR_DEFECTO_MIN = 30;
