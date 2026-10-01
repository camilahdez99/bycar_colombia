import { describe, expect, test } from 'vitest';
import { mensajeDeError } from '@/lib/api/errores';

const oracle = (errorNum, message) => Object.assign(new Error(message), { errorNum });

describe('mensajeDeError (BUGS S8)', () => {
  test.each([
    [1, 'Ya existe un registro con esos datos'],
    [1400, 'Falta un campo obligatorio'],
    [1722, 'Un valor numérico no es válido'],
    [2291, 'El registro hace referencia a otro que no existe'],
    [2292, 'El registro tiene otros asociados y no se puede borrar'],
    [12899, 'Un valor supera el largo permitido'],
  ])('ORA-%i → mensaje en español', (errorNum, esperado) => {
    expect(mensajeDeError(oracle(errorNum, `ORA-${errorNum}: constraint (US_BYCAR.FK_X) violated`), 'x')).toBe(esperado);
  });

  test('un código desconocido o un error sin código usa el mensaje por defecto', () => {
    expect(mensajeDeError(oracle(942, 'ORA-00942: table or view does not exist'), 'Error interno')).toBe('Error interno');
    expect(mensajeDeError(new Error('sin red'), 'Error interno')).toBe('Error interno');
    expect(mensajeDeError(undefined, 'Error interno')).toBe('Error interno');
  });

  test('nunca incluye el texto original de Oracle', () => {
    const mensaje = mensajeDeError(oracle(2292, 'ORA-02292: integrity constraint (US_BYCAR.FK_VIAJES) violated'), 'x');
    expect(mensaje).not.toMatch(/ORA-|US_BYCAR|FK_/);
  });
});
