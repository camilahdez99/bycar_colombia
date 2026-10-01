import { describe, expect, test } from 'vitest';
import {
  errorNumDeOracle,
  identificadoresEntreComillas,
  nombresDeColumnas,
  normalizarFilas,
  traducirBinds,
} from '@/lib/pg/sql';

describe('traducirBinds', () => {
  test('convierte binds con nombre a posicionales en orden de aparición', () => {
    expect(traducirBinds('SELECT * FROM T WHERE A = :a AND B = :b', { b: 2, a: 1 })).toEqual({
      texto: 'SELECT * FROM T WHERE A = $1 AND B = $2',
      valores: [1, 2],
    });
  });

  test('un nombre repetido reutiliza la misma posición', () => {
    const { texto, valores } = traducirBinds('WHERE X = :userId OR Y = :userId AND Z = :otro', { userId: 7, otro: 3 });
    expect(texto).toBe('WHERE X = $1 OR Y = $1 AND Z = $2');
    expect(valores).toEqual([7, 3]);
  });

  test('no toca dos puntos dentro de literales, identificadores entre comillas, comentarios ni casts', () => {
    const sql = `SELECT TO_CHAR(F, 'YYYY-MM-DD HH24:MI:SS') as "a:b", X::text -- :nada\n /* :tampoco */ FROM T WHERE ID = :id`;
    expect(traducirBinds(sql, { id: 5 })).toEqual({
      texto: `SELECT TO_CHAR(F, 'YYYY-MM-DD HH24:MI:SS') as "a:b", X::text -- :nada\n /* :tampoco */ FROM T WHERE ID = $1`,
      valores: [5],
    });
  });

  test('las comillas dobladas dentro de un literal no lo cierran', () => {
    expect(traducirBinds(`WHERE N = 'O''Brien :x' AND M = :m`, { m: 1 }).texto).toBe(`WHERE N = 'O''Brien :x' AND M = $1`);
  });

  test('la cadena vacía viaja como NULL, como en Oracle; los demás valores, intactos', () => {
    const fecha = new Date('2026-01-02T03:04:05Z');
    expect(traducirBinds('VALUES (:a, :b, :c, :d, :e)', { a: '', b: 'x', c: 0, d: null, e: fecha }).valores)
      .toEqual([null, 'x', 0, null, fecha]);
  });

  test('busca el bind sin distinguir mayúsculas si no está exacto', () => {
    expect(traducirBinds('VALUES (:ID_ENU)', { id_enu: 9 }).valores).toEqual([9]);
  });

  test('sin binds ni valores el SQL queda igual', () => {
    expect(traducirBinds('SELECT 1')).toEqual({ texto: 'SELECT 1', valores: [] });
  });

  test('si falta un bind lo dice por nombre', () => {
    expect(() => traducirBinds('WHERE A = :a', {})).toThrow('Falta el valor del bind :a');
  });
});

describe('nombres de columnas como en Oracle', () => {
  test('detecta los identificadores entre comillas, sin contar literales', () => {
    expect([...identificadoresEntreComillas(`SELECT A as "nextId", 'no "esto"' as "x" FROM T`)]).toEqual(['nextId', 'x']);
  });

  test('sin alias entre comillas la columna va en mayúsculas; con alias, tal cual', () => {
    const sql = 'SELECT ID_MUN, NOMBRE_MUN as "nombre", COUNT(*) AS "total" FROM MUNICIPIOS';
    const campos = [{ name: 'id_mun' }, { name: 'nombre' }, { name: 'total' }];
    expect(nombresDeColumnas(campos, sql)).toEqual(['ID_MUN', 'nombre', 'total']);
  });

  test('normalizarFilas reescribe las claves de cada fila', () => {
    const sql = 'SELECT * FROM T, U';
    const campos = [{ name: 'id_usu' }, { name: 'correo_usu' }];
    expect(normalizarFilas([{ id_usu: 1, correo_usu: 'a@b.co' }], campos, sql)).toEqual([{ ID_USU: 1, CORREO_USU: 'a@b.co' }]);
  });
});

describe('errorNumDeOracle', () => {
  test.each([
    ['23505', 'duplicate key value violates unique constraint "x"', 1],
    ['23502', 'null value in column "x"', 1400],
    ['23514', 'new row violates check constraint "nn_x"', 2290],
    ['22P02', 'invalid input syntax for type bigint: "abc"', 1722],
    ['22001', 'value too long for type character varying(6)', 12899],
    ['23503', 'insert or update on table "viajes" violates foreign key constraint "fk"', 2291],
    ['23503', 'update or delete on table "usuarios" violates foreign key constraint "fk" on table "viajes"', 2292],
  ])('SQLSTATE %s (%s) → ORA %i',(code, message, esperado) => {
    expect(errorNumDeOracle({ code, message })).toBe(esperado);
  });

  test('sin equivalente devuelve undefined', () => {
    expect(errorNumDeOracle({ code: '42P01', message: 'relation does not exist' })).toBeUndefined();
    expect(errorNumDeOracle(undefined)).toBeUndefined();
  });
});
