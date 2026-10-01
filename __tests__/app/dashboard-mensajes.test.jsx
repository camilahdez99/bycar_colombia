import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { toast } from 'react-hot-toast';
import DashboardPage from '@/app/dashboard/page';
import { clickNav, iniciarSesion, llamadas, stubApi } from '../helpers/dashboard';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));
vi.mock('react-hot-toast', () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), loading: vi.fn(() => 'toast-id') }),
}));

const CHATS = [
  { chatId: 31, nombre: 'LUIS ROJAS', ruta: 'BOGOTA → TUNJA', fecha: '2026-10-01' },
  { chatId: 32, nombre: 'EVA', ruta: 'CALI → PASTO', fecha: '2026-10-02' },
];

// senderId llega a veces como texto: la comparación con el ID propio es laxa (==)
const HISTORIAL = [
  { senderId: 7, text: 'Hola, ¿dónde nos vemos?' },
  { senderId: 12, text: 'En la terminal' },
  { senderId: '7', text: 'Listo' },
];

async function abrirChat(nombre = 'LUIS ROJAS') {
  render(<DashboardPage />);
  clickNav('Mensajes');
  fireEvent.click(await screen.findByText(nombre));
  await screen.findByText(`Chat con ${nombre}`);
}

const burbujas = () =>
  [...screen.getByPlaceholderText('Escribe...').parentElement.previousElementSibling.children].map((el) => ({
    texto: el.textContent,
    mio: el.style.alignSelf === 'flex-end',
  }));

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  localStorage.clear();
  iniciarSesion();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe('Dashboard · mensajes (caracterización)', () => {
  test('sin chats muestra el aviso; con chats lista nombre, inicial, ruta y fecha', async () => {
    stubApi({ '/api/mensajes/chats': CHATS });
    render(<DashboardPage />);
    clickNav('Mensajes');

    expect(await screen.findByText('LUIS ROJAS')).toBeTruthy();
    expect(screen.getByText('Viaje: BOGOTA → TUNJA (2026-10-01)')).toBeTruthy();
    expect(screen.getByText('L')).toBeTruthy();
    cleanup();

    stubApi();
    render(<DashboardPage />);
    clickNav('Mensajes');
    expect(await screen.findByText('No tienes chats activos de próximos viajes.')).toBeTruthy();
  });

  test('abrir un chat pide su historial y separa los mensajes propios de los ajenos', async () => {
    stubApi({ '/api/mensajes/chats': CHATS, '/api/mensajes?chatId=31': HISTORIAL });
    await abrirChat();

    await waitFor(() => expect(burbujas()).toEqual([
      { texto: 'Hola, ¿dónde nos vemos?', mio: true },
      { texto: 'En la terminal', mio: false },
      { texto: 'Listo', mio: true },
    ]));
    expect(llamadas('GET', '/api/mensajes?').map((c) => c.url)).toEqual(['/api/mensajes?chatId=31']);
  });

  test('historial vacío: invita a iniciar la conversación', async () => {
    stubApi({ '/api/mensajes/chats': CHATS, '/api/mensajes?chatId=31': [] });
    await abrirChat();

    expect(await screen.findByText('Inicia la conversación para acordar el punto de encuentro.')).toBeTruthy();
  });

  test('error al pedir el historial: no cambia la conversación', async () => {
    stubApi({ '/api/mensajes/chats': CHATS, '/api/mensajes?chatId=31': () => new Response('{}', { status: 403 }) });
    await abrirChat();

    await waitFor(() => expect(llamadas('GET', '/api/mensajes?')).toHaveLength(1));
    expect(screen.getByText('Inicia la conversación para acordar el punto de encuentro.')).toBeTruthy();
  });

  test('enviar: agrega el mensaje recortado antes de la respuesta y hace POST con chatId, senderId y texto', async () => {
    stubApi({ '/api/mensajes/chats': CHATS, '/api/mensajes?chatId=31': [], 'POST /api/mensajes': { message: 'ok' } });
    await abrirChat();
    const input = screen.getByPlaceholderText('Escribe...');

    fireEvent.change(input, { target: { value: '  Voy saliendo  ' } });
    fireEvent.click(screen.getByText('Enviar'));

    expect(burbujas()).toEqual([{ texto: 'Voy saliendo', mio: true }]);
    expect(input.value).toBe('');
    await waitFor(() => expect(llamadas('POST', '/api/mensajes').map((c) => c.body)).toEqual([
      { chatId: 31, senderId: 7, text: 'Voy saliendo' },
    ]));
  });

  test('Enter también envía; un texto vacío o de solo espacios no se envía', async () => {
    stubApi({ '/api/mensajes/chats': CHATS, '/api/mensajes?chatId=31': [], 'POST /api/mensajes': { message: 'ok' } });
    await abrirChat();
    const input = screen.getByPlaceholderText('Escribe...');

    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    fireEvent.click(screen.getByText('Enviar'));
    fireEvent.change(input, { target: { value: 'ok' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => expect(llamadas('POST', '/api/mensajes')).toHaveLength(1));
    expect(llamadas('POST', '/api/mensajes')[0].body.text).toBe('ok');
  });

  test('si el POST falla, el mensaje se saca, vuelve al input y se avisa (F29)', async () => {
    stubApi({
      '/api/mensajes/chats': CHATS,
      '/api/mensajes?chatId=31': [],
      'POST /api/mensajes': () => new Response('{"error":"Acceso denegado"}', { status: 403 }),
    });
    await abrirChat();
    fireEvent.change(screen.getByPlaceholderText('Escribe...'), { target: { value: 'hola' } });
    fireEvent.click(screen.getByText('Enviar'));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('No se pudo enviar el mensaje'));
    expect(burbujas().some((b) => b.texto === 'hola')).toBe(false);
    expect(screen.getByPlaceholderText('Escribe...').value).toBe('hola');
  });

  test('con falla de red pasa lo mismo y queda registrado en consola (F29)', async () => {
    stubApi({
      '/api/mensajes/chats': CHATS,
      '/api/mensajes?chatId=31': [],
      'POST /api/mensajes': () => { throw new TypeError('Failed to fetch'); },
    });
    await abrirChat();
    fireEvent.change(screen.getByPlaceholderText('Escribe...'), { target: { value: 'hola' } });
    fireEvent.click(screen.getByText('Enviar'));

    await waitFor(() => expect(console.error).toHaveBeenCalledWith('Error enviando mensaje', expect.any(TypeError)));
    await waitFor(() => expect(burbujas().some((b) => b.texto === 'hola')).toBe(false));
    expect(toast.error).toHaveBeenCalledWith('No se pudo enviar el mensaje');
    expect(screen.getByPlaceholderText('Escribe...').value).toBe('hola');
  });

  test('con el chat abierto repite el pedido del historial cada 3 s; al cerrarlo deja de pedir', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    stubApi({ '/api/mensajes/chats': CHATS, '/api/mensajes?chatId=31': HISTORIAL });
    await abrirChat();
    await waitFor(() => expect(llamadas('GET', '/api/mensajes?')).toHaveLength(1));

    vi.advanceTimersByTime(3000);
    vi.advanceTimersByTime(3000);
    await waitFor(() => expect(llamadas('GET', '/api/mensajes?')).toHaveLength(3));

    fireEvent.click(screen.getByText('✕'));
    vi.advanceTimersByTime(9000);
    expect(llamadas('GET', '/api/mensajes?')).toHaveLength(3);
    expect(screen.queryByText('Chat con LUIS ROJAS')).toBeNull();
  });

  test('cambiar de chat vacía la conversación y pide el historial del nuevo', async () => {
    stubApi({
      '/api/mensajes/chats': CHATS,
      '/api/mensajes?chatId=31': HISTORIAL,
      '/api/mensajes?chatId=32': [{ senderId: 12, text: 'Hola Ana' }],
    });
    await abrirChat();
    await waitFor(() => expect(burbujas()).toHaveLength(3));

    fireEvent.click(screen.getByText('EVA'));
    await screen.findByText('Chat con EVA');
    await waitFor(() => expect(burbujas()).toEqual([{ texto: 'Hola Ana', mio: false }]));
  });
});
