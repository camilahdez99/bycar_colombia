// Clave primaria de cada tabla, según scripts/tablas_DDL.txt. PERMISOS tiene PK compuesta
// (USUARIO_ID_USU, MENU_ID_ENU): no se edita ni se borra por id (la API responde 400).
export const CLAVE_PRIMARIA = Object.freeze({
  ROLES: 'ID_ROL',
  MENUS: 'ID_ENU',
  PERFILES: 'ID_PER',
  USUARIOS: 'ID_USU',
  MARCAS: 'ID_MAR',
  DEPARTAMENTOS: 'ID_DEP',
  MUNICIPIOS: 'ID_MUN',
  ESTADOS_SOL: 'ID_EST_SOL',
  ESTADOS_VIA: 'ID_EST_VIA',
  ESTADOS_GUA: 'ID_EST_GUA',
  VEHICULOS: 'PLACA_VEH',
  VIAJES: 'ID_VIA',
  MENSAJES: 'ID_MEN',
  SOLICITUDES: 'ID_SOL',
  GUARDIANES: 'ID_GUA',
});

// Para una tabla que no está en el mapa se mantiene la búsqueda anterior por nombre de columna
const COLUMNAS_ID_CONOCIDAS = [
  'ID_USU', 'ID_PER', 'ID_MUN', 'ID_DEP', 'PLACA_VEH', 'ID_VIA', 'ID_ENU', 'ID_GUA',
  'ID_MAR', 'ID_MOD', 'ID_EST_SOL', 'ID_EST_GUA', 'ID_ROL', 'ID_MEN',
];

const tieneValor = (valor) => valor !== undefined && valor !== null && valor !== '';

/**
 * ID de una fila del panel admin: el valor de la PK de la tabla (aunque sea 0).
 * Antes se adivinaba con una lista de columnas que no incluía ID_SOL ni ID_EST_VIA, y para
 * SOLICITUDES y ESTADOS_VIA se usaba la primera columna, que no siempre es la PK (BUGS F31).
 */
export function getRowId(tabla, fila, columnas = []) {
  const clave = CLAVE_PRIMARIA[tabla];
  if (clave) return fila[clave];
  const conocida = COLUMNAS_ID_CONOCIDAS.find((columna) => tieneValor(fila[columna]));
  return conocida ? fila[conocida] : fila[columnas[0]?.COLUMN_NAME];
}
