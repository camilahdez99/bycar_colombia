import { describe, expect, test } from 'vitest';
import {
  VERIFICACION,
  codigoConFormato,
  permisoDeReenvio,
  resultadoDelIntento,
} from '@/lib/domain/verificacionRegistro';
import { correoValido } from '@/lib/domain/validadores';

describe('reglas de la verificación', () => {
  test('5 minutos, 2 intentos, 3 reenvíos, 60 s entre envíos y 6 dígitos', () => {
    expect(VERIFICACION).toEqual({
      VIGENCIA_SEG: 300, MAX_INTENTOS: 2, MAX_REENVIOS: 3, ESPERA_REENVIO_SEG: 60, DIGITOS: 6,
    });
  });
});

describe('correoValido', () => {
  test.each([
    ['ana@x.co', 'ana@x.co'],
    ['  Ana.Perez@Gmail.COM ', 'ana.perez@gmail.com'],
    ['ana+viajes@correo.edu.co', 'ana+viajes@correo.edu.co'],
  ])('%j → %j', (entrada, esperado) => {
    expect(correoValido(entrada)).toBe(esperado);
  });

  test.each(['', 'ana', 'ana@', '@x.co', 'ana@x', 'ana@x.c', 'ana @x.co', 'ana@@x.co', 42, null, undefined])(
    '%j no es un correo válido',
    (entrada) => {
      expect(correoValido(entrada)).toBeNull();
    },
  );

  test('hasta 150 caracteres (el largo de la columna) es válido; 151 no', () => {
    expect(correoValido(`${'a'.repeat(145)}@x.co`)).toHaveLength(150);
    expect(correoValido(`${'a'.repeat(146)}@x.co`)).toBeNull();
  });
});

describe('codigoConFormato', () => {
  test.each([['123456', '123456'], [' 123 456 ', '123456'], ['000042', '000042'], [123456, '123456']])(
    '%j → %j',
    (entrada, esperado) => {
      expect(codigoConFormato(entrada)).toBe(esperado);
    },
  );

  test.each(['12345', '1234567', '12a456', '', null, undefined, {}])('%j no tiene formato de código', (entrada) => {
    expect(codigoConFormato(entrada)).toBeNull();
  });
});

describe('resultadoDelIntento', () => {
  test('vencido gana aunque el código sea correcto', () => {
    expect(resultadoDelIntento({ vencido: true, intentosPrevios: 0, correcto: true })).toEqual({ estado: 'vencido' });
  });

  test('correcto en el primer o el segundo intento → verificado', () => {
    expect(resultadoDelIntento({ vencido: false, intentosPrevios: 0, correcto: true })).toEqual({ estado: 'verificado' });
    expect(resultadoDelIntento({ vencido: false, intentosPrevios: 1, correcto: true })).toEqual({ estado: 'verificado' });
  });

  test('primer error → incorrecto, le queda 1 intento', () => {
    expect(resultadoDelIntento({ vencido: false, intentosPrevios: 0, correcto: false }))
      .toEqual({ estado: 'incorrecto', intentosRestantes: 1 });
  });

  test('segundo error → descartado', () => {
    expect(resultadoDelIntento({ vencido: false, intentosPrevios: 1, correcto: false })).toEqual({ estado: 'descartado' });
  });

  test('intentos que llegan como texto (INTEGER de la BD también puede venir así)', () => {
    expect(resultadoDelIntento({ vencido: false, intentosPrevios: '1', correcto: false })).toEqual({ estado: 'descartado' });
  });
});

describe('permisoDeReenvio', () => {
  test('pasados 60 s y con reenvíos disponibles → permitido', () => {
    expect(permisoDeReenvio({ reenvios: 0, segundosDesdeEnvio: 60 })).toEqual({ permitido: true });
    expect(permisoDeReenvio({ reenvios: 2, segundosDesdeEnvio: 200 })).toEqual({ permitido: true });
  });

  test('antes de 60 s → espera, con los segundos que faltan redondeados hacia arriba', () => {
    expect(permisoDeReenvio({ reenvios: 0, segundosDesdeEnvio: 15.2 })).toEqual({ permitido: false, motivo: 'espera', segundos: 45 });
  });

  test('con 3 reenvíos ya hechos → límite, aunque haya pasado el tiempo', () => {
    expect(permisoDeReenvio({ reenvios: 3, segundosDesdeEnvio: 999 })).toEqual({ permitido: false, motivo: 'limite' });
  });
});
