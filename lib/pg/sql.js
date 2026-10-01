// Traducción pura entre el contrato que usan las rutas (heredado de oracledb) y Postgres.
// Sin dependencias de `pg`: se prueba sin base de datos.

const IDENTIFICADOR_BIND = /[A-Za-z_][A-Za-z0-9_$#]*/y;

/**
 * Recorre el SQL saltando literales ('…'), identificadores entre comillas ("…") y comentarios,
 * y llama a `alBind(nombre)` por cada `:nombre`. Devuelve el SQL con cada bind reemplazado
 * por lo que retorne el callback. `::tipo` (cast de Postgres) no es un bind.
 */
function recorrerBinds(sql, alBind) {
  let salida = '';
  let i = 0;
  while (i < sql.length) {
    const c = sql[i];
    if (c === "'" || c === '"') {
      const fin = buscarCierre(sql, i, c);
      salida += sql.slice(i, fin);
      i = fin;
    } else if (c === '-' && sql[i + 1] === '-') {
      const fin = sql.indexOf('\n', i);
      const hasta = fin === -1 ? sql.length : fin;
      salida += sql.slice(i, hasta);
      i = hasta;
    } else if (c === '/' && sql[i + 1] === '*') {
      const fin = sql.indexOf('*/', i + 2);
      const hasta = fin === -1 ? sql.length : fin + 2;
      salida += sql.slice(i, hasta);
      i = hasta;
    } else if (c === ':' && sql[i + 1] === ':') {
      salida += '::';
      i += 2;
    } else if (c === ':') {
      IDENTIFICADOR_BIND.lastIndex = i + 1;
      const match = IDENTIFICADOR_BIND.exec(sql);
      if (match) {
        salida += alBind(match[0]);
        i += 1 + match[0].length;
      } else {
        salida += c;
        i += 1;
      }
    } else {
      salida += c;
      i += 1;
    }
  }
  return salida;
}

/** Índice siguiente al cierre de un literal o identificador entre comillas (las comillas dobladas escapan). */
function buscarCierre(sql, inicio, comilla) {
  let i = inicio + 1;
  while (i < sql.length) {
    if (sql[i] === comilla) {
      if (sql[i + 1] === comilla) {
        i += 2;
        continue;
      }
      return i + 1;
    }
    i += 1;
  }
  return sql.length;
}

/** Valor de un bind con nombre; acepta diferencias de mayúsculas, como Oracle. */
function valorDeBind(binds, nombre) {
  if (Object.hasOwn(binds, nombre)) return binds[nombre];
  const clave = Object.keys(binds).find((k) => k.toUpperCase() === nombre.toUpperCase());
  if (clave === undefined) throw new Error(`Falta el valor del bind :${nombre}`);
  return binds[clave];
}

/**
 * Convierte binds con nombre (`:usuarioId`) a posicionales (`$1`). Un nombre repetido reutiliza
 * su posición. La cadena vacía viaja como NULL, porque Oracle no distingue '' de NULL.
 */
export function traducirBinds(sql, binds = {}) {
  const posiciones = new Map();
  const valores = [];
  const texto = recorrerBinds(sql, (nombre) => {
    const clave = nombre.toUpperCase();
    if (!posiciones.has(clave)) {
      const valor = valorDeBind(binds ?? {}, nombre);
      valores.push(valor === '' ? null : valor);
      posiciones.set(clave, valores.length);
    }
    return `$${posiciones.get(clave)}`;
  });
  return { texto, valores };
}

/** Identificadores escritos entre comillas en el SQL (los alias como "passengerId"). */
export function identificadoresEntreComillas(sql) {
  const encontrados = new Set();
  let i = 0;
  while (i < sql.length) {
    const c = sql[i];
    if (c === "'") {
      i = buscarCierre(sql, i, c);
    } else if (c === '"') {
      const fin = buscarCierre(sql, i, c);
      encontrados.add(sql.slice(i + 1, fin - 1).replaceAll('""', '"'));
      i = fin;
    } else {
      i += 1;
    }
  }
  return encontrados;
}

/**
 * Nombres de columna como los devolvía Oracle: lo que no tiene alias entre comillas, en
 * MAYÚSCULAS (Postgres lo devuelve en minúsculas); los alias entre comillas, tal cual.
 */
export function nombresDeColumnas(campos, sql) {
  const entreComillas = identificadoresEntreComillas(sql);
  return campos.map(({ name }) => (entreComillas.has(name) ? name : name.toUpperCase()));
}

/** Filas de `pg` (claves en minúsculas) con las claves que esperan las rutas. */
export function normalizarFilas(filas, campos, sql) {
  const originales = campos.map(({ name }) => name);
  const nombres = nombresDeColumnas(campos, sql);
  return filas.map((fila) => {
    const salida = {};
    originales.forEach((original, i) => {
      salida[nombres[i]] = fila[original];
    });
    return salida;
  });
}

// SQLSTATE de Postgres → número de error de Oracle que ya interpretan las rutas y lib/api/errores.js
const ORACLE_POR_SQLSTATE = {
  23505: 1, // unique_violation → ORA-00001
  23502: 1400, // not_null_violation → ORA-01400
  23514: 2290, // check_violation → ORA-02290
  '22P02': 1722, // invalid_text_representation → ORA-01722
  22001: 12899, // string_data_right_truncation → ORA-12899
};

/** Número de error Oracle equivalente al de Postgres, o undefined si no tiene equivalente. */
export function errorNumDeOracle(error) {
  if (error?.code === '23503') {
    // La misma clave foránea falla al insertar un hijo huérfano (ORA-02291) o al borrar un padre con hijos (ORA-02292)
    return /^update or delete on table/i.test(error.message ?? '') ? 2292 : 2291;
  }
  return ORACLE_POR_SQLSTATE[error?.code];
}

/** Comandos de `pg` que informan filas modificadas (oracledb las expone como rowsAffected). */
export const COMANDOS_DML = new Set(['INSERT', 'UPDATE', 'DELETE', 'MERGE']);
