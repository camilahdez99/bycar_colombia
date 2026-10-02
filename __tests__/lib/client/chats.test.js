import { describe, expect, test } from 'vitest';
import { claveDeChat, consultaDeChat, idDeChat } from '@/lib/client/chats';

const viaje = { chatId: 31, nombre: 'LUIS' };
const guardian = { guardianId: 77, nombre: 'MAMÁ' };

describe('chats de la pestaña Mensajes', () => {
  test('idDeChat: chatId para un viaje, guardianId para un guardián', () => {
    expect(idDeChat(viaje)).toEqual({ chatId: 31 });
    expect(idDeChat(guardian)).toEqual({ guardianId: 77 });
  });

  test('consultaDeChat arma la query del historial', () => {
    expect(consultaDeChat(viaje)).toBe('chatId=31');
    expect(consultaDeChat(guardian)).toBe('guardianId=77');
  });

  test('claveDeChat usa la clave de la API o la deduce del tipo', () => {
    expect(claveDeChat({ ...viaje, clave: 'viaje-31' })).toBe('viaje-31');
    expect(claveDeChat(viaje)).toBe('viaje-31');
    expect(claveDeChat(guardian)).toBe('guardian-77');
  });
});
