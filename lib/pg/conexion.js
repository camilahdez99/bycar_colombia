// Envoltorio de un cliente de `pg` con el contrato de conexión que usan las rutas
// (el de oracledb): execute(sql, binds, { autoCommit }) → { rows, rowsAffected }, commit, rollback, close.
import { COMANDOS_DML, errorNumDeOracle, normalizarFilas, traducirBinds } from './sql.js';

const SAVEPOINT = 'bycar_sentencia';
// SET TRANSACTION dentro de un savepoint se descarta al liberarlo (p. ej. READ ONLY): va directo a la transacción
const CONFIGURA_TRANSACCION = /^\s*SET\s+TRANSACTION\b/i;

export class ConexionPg {
  /**
   * @param {import('pg').PoolClient} cliente
   * @param {{ autoCommit?: boolean }} [opciones] autoCommit por defecto de esta conexión (true, como lib/db con Oracle)
   */
  constructor(cliente, { autoCommit = true } = {}) {
    this.cliente = cliente;
    this.autoCommitPorDefecto = autoCommit;
    this.enTransaccion = false;
  }

  /**
   * Con autoCommit=false abre una transacción si no hay una. Con autoCommit=true y una transacción
   * abierta, confirma todo al terminar la sentencia, como oracledb.
   */
  async execute(sql, binds = {}, opciones = {}) {
    const autoCommit = opciones.autoCommit ?? this.autoCommitPorDefecto;
    const { texto, valores } = traducirBinds(sql, binds);

    if (!autoCommit && !this.enTransaccion) {
      await this.cliente.query('BEGIN');
      this.enTransaccion = true;
    }

    const conSavepoint = this.enTransaccion && !CONFIGURA_TRANSACCION.test(texto);
    const resultado = conSavepoint
      ? await this.#ejecutarEnTransaccion(texto, valores)
      : await this.#consultar(texto, valores);

    if (autoCommit && this.enTransaccion) await this.commit();
    return adaptarResultado(resultado, sql);
  }

  async commit() {
    if (!this.enTransaccion) return;
    this.enTransaccion = false;
    await this.cliente.query('COMMIT');
  }

  async rollback() {
    if (!this.enTransaccion) return;
    this.enTransaccion = false;
    await this.cliente.query('ROLLBACK');
  }

  /** Devuelve el cliente al pool. Como en Oracle, lo no confirmado se descarta. */
  async close() {
    let errorAlCerrar;
    try {
      await this.rollback();
    } catch (error) {
      errorAlCerrar = error;
      throw error;
    } finally {
      // Con error el pool descarta el cliente en lugar de reutilizarlo en un estado dudoso
      this.cliente.release(errorAlCerrar);
    }
  }

  /**
   * En Postgres un error invalida toda la transacción; en Oracle solo deshace la sentencia que falló.
   * El savepoint por sentencia conserva el comportamiento de Oracle (p. ej. el alta de MENUS en
   * admin/tablas sigue aunque falle un permiso por defecto).
   */
  async #ejecutarEnTransaccion(texto, valores) {
    await this.cliente.query(`SAVEPOINT ${SAVEPOINT}`);
    try {
      const resultado = await this.#consultar(texto, valores);
      await this.cliente.query(`RELEASE SAVEPOINT ${SAVEPOINT}`);
      return resultado;
    } catch (error) {
      await this.cliente.query(`ROLLBACK TO SAVEPOINT ${SAVEPOINT}`);
      throw error;
    }
  }

  async #consultar(texto, valores) {
    try {
      return await this.cliente.query(texto, valores);
    } catch (error) {
      const errorNum = errorNumDeOracle(error);
      if (errorNum !== undefined) error.errorNum = errorNum;
      throw error;
    }
  }
}

/** { rows } en consultas (claves como en Oracle) y { rowsAffected } en INSERT/UPDATE/DELETE. */
function adaptarResultado(resultado, sql) {
  if (COMANDOS_DML.has(resultado.command)) return { rowsAffected: resultado.rowCount };
  if (!resultado.fields?.length) return {};
  return { rows: normalizarFilas(resultado.rows, resultado.fields, sql) };
}
