import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { toast } from 'react-hot-toast';
import DashboardPage from '@/app/dashboard/page';
import { clickNav, iniciarSesion, jsonResponse, llamadas, stubApi } from '../helpers/dashboard';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));
vi.mock('react-hot-toast', () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), loading: vi.fn(() => 'toast-id') }),
}));

const MENUS = [
  { id: 1, label: 'Inicio', url: '/inicio', parentId: null },
  { id: 8, label: 'Xpress', url: '/xpress', parentId: null },
];
const PERMISOS = [{ menuUrl: '/inicio' }, { menuUrl: '/xpress' }];

const carga = (extra) => ({
  id: 301,
  descripcion: 'Caja con libros',
  peso: '2.5',
  estadoId: 1,
  estado: 'Pendiente',
  viajeId: 5,
  origen: 'BOGOTA',
  destino: 'TUNJA',
  salida: '2026-11-20 08:00',
  emisorId: 7,
  emisor: 'ANA PEREZ',
  receptorId: 12,
  receptor: 'LUIS ROJAS',
  conductorId: 9,
  conductor: 'EVA SOTO',
  ...extra,
});

/** Responde /api/xpress según la vista pedida. */
const xpressPorVista = (listas) => (url) => {
  const vista = new URL(url, 'http://localhost').searchParams.get('vista');
  return listas[vista] ?? [];
};

function montar(rutas = {}) {
  stubApi({ '/api/menus': MENUS, '/api/admin/permisos': PERMISOS, ...rutas });
  render(<DashboardPage />);
}

async function abrirXpress() {
  fireEvent.click(await screen.findAllByText('Xpress').then((els) => els[0]));
  await screen.findByText('📦 Xpress');
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  localStorage.clear();
  iniciarSesion();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe('Dashboard · Xpress', () => {
  test('el menú Xpress aparece y pide las tres listas del usuario', async () => {
    montar();
    await abrirXpress();

    await waitFor(() => expect(llamadas('GET', '/api/xpress?').map((c) => c.url).sort()).toEqual([
      '/api/xpress?usuarioId=7&vista=conductor',
      '/api/xpress?usuarioId=7&vista=enviados',
      '/api/xpress?usuarioId=7&vista=recibidos',
    ]));
    expect(await screen.findByText('Todavía no has enviado ninguna encomienda.')).toBeTruthy();
  });

  test('Mis envíos: una carga Pendiente se puede editar y cancelar; muestra su estado y su ruta', async () => {
    montar({ '/api/xpress': xpressPorVista({ enviados: [carga()] }) });
    await abrirXpress();

    expect(await screen.findByText('Caja con libros')).toBeTruthy();
    expect(screen.getByText(/BOGOTA → TUNJA/)).toBeTruthy();
    expect(screen.getByText('Pendiente')).toBeTruthy();
    expect(screen.getByText('Editar')).toBeTruthy();
    expect(screen.getByText('Cancelar envío')).toBeTruthy();
    expect(screen.queryByText('Aceptar')).toBeNull();
  });

  test('una carga En camino ya no se puede editar ni cancelar', async () => {
    montar({ '/api/xpress': xpressPorVista({ enviados: [carga({ estadoId: 4, estado: 'En camino' })] }) });
    await abrirXpress();

    await screen.findByText('En camino');
    expect(screen.queryByText('Editar')).toBeNull();
    expect(screen.queryByText('Cancelar envío')).toBeNull();
  });

  test('cancelar pide DELETE a la API (cancelación lógica)', async () => {
    montar({
      '/api/xpress': xpressPorVista({ enviados: [carga()] }),
      'DELETE /api/xpress': { message: 'Encomienda cancelada' },
    });
    await abrirXpress();

    fireEvent.click(await screen.findByText('Cancelar envío'));

    await waitFor(() => expect(llamadas('DELETE', '/api/xpress')).toHaveLength(1));
    expect(llamadas('DELETE', '/api/xpress')[0].url).toBe('/api/xpress?id=301');
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Encomienda cancelada', { id: 'toast-id' }));
  });

  test('editar abre el formulario con los datos y guarda con PUT', async () => {
    montar({
      '/api/xpress': xpressPorVista({ enviados: [carga()] }),
      'PUT /api/xpress': { message: 'Encomienda actualizada' },
    });
    await abrirXpress();

    fireEvent.click(await screen.findByText('Editar'));
    const descripcion = await screen.findByLabelText('Descripción');
    expect(descripcion.value).toBe('Caja con libros');
    fireEvent.change(descripcion, { target: { value: 'Sobre con papeles' } });
    fireEvent.change(screen.getByLabelText('Peso en kg'), { target: { value: '1' } });
    fireEvent.click(screen.getByText('Guardar cambios'));

    await waitFor(() => expect(llamadas('PUT', '/api/xpress')).toHaveLength(1));
    expect(llamadas('PUT', '/api/xpress')[0].body).toEqual({ id: 301, descripcion: 'Sobre con papeles', peso: '1' });
    await waitFor(() => expect(screen.queryByText('Guardar cambios')).toBeNull());
  });

  test('En mis viajes: el conductor acepta una carga Pendiente con PUT', async () => {
    montar({
      '/api/xpress': xpressPorVista({ conductor: [carga({ emisorId: 12, conductorId: 7 })] }),
      'PUT /api/xpress': { message: 'Estado actualizado' },
    });
    await abrirXpress();

    fireEvent.click(await screen.findByText(/^En mis viajes/));
    fireEvent.click(await screen.findByText('Aceptar'));

    await waitFor(() => expect(llamadas('PUT', '/api/xpress')).toHaveLength(1));
    expect(llamadas('PUT', '/api/xpress')[0].body).toEqual({ id: 301, estado: 2 });
    expect(screen.getByText('Rechazar')).toBeTruthy();
    expect(screen.queryByText('Editar')).toBeNull();
  });

  test.each([
    [2, 'Aceptada', 'Marcar en camino', 4],
    [4, 'En camino', 'Marcar entregada', 5],
  ])('el conductor avanza una carga %i (%s) con "%s"', async (estadoId, estado, boton, esperado) => {
    montar({
      '/api/xpress': xpressPorVista({ conductor: [carga({ estadoId, estado })] }),
      'PUT /api/xpress': { message: 'Estado actualizado' },
    });
    await abrirXpress();

    fireEvent.click(await screen.findByText(/^En mis viajes/));
    fireEvent.click(await screen.findByText(boton));

    await waitFor(() => expect(llamadas('PUT', '/api/xpress')[0]?.body).toEqual({ id: 301, estado: esperado }));
  });

  test('Por recibir: el receptor solo ve la carga, sin acciones', async () => {
    montar({ '/api/xpress': xpressPorVista({ recibidos: [carga({ receptorId: 7, emisorId: 12 })] }) });
    await abrirXpress();

    fireEvent.click(await screen.findByText(/^Por recibir/));
    expect(await screen.findByText('Caja con libros')).toBeTruthy();
    for (const accion of ['Editar', 'Cancelar envío', 'Aceptar', 'Rechazar']) {
      expect(screen.queryByText(accion)).toBeNull();
    }
  });

  test('un error de la API al cambiar el estado se muestra tal cual', async () => {
    montar({
      '/api/xpress': xpressPorVista({ conductor: [carga()] }),
      'PUT /api/xpress': jsonResponse({ error: 'La encomienda ya cambió de estado. Actualiza la lista e intenta de nuevo.' }, 409),
    });
    await abrirXpress();

    fireEvent.click(await screen.findByText(/^En mis viajes/));
    fireEvent.click(await screen.findByText('Aceptar'));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(
      'La encomienda ya cambió de estado. Actualiza la lista e intenta de nuevo.',
      { id: 'toast-id' },
    ));
  });
});

const MUNICIPIOS = [{ id: 1, nombre: 'BOGOTA' }, { id: 2, nombre: 'TUNJA' }];
const VIAJE = { id: 5, origen: 'BOGOTA', destino: 'TUNJA', hora: '2026-11-20', conductor: 'EVA SOTO' };

/** Abre el formulario, busca BOGOTA → TUNJA y elige el primer viaje encontrado. */
async function buscarYElegirViaje() {
  fireEvent.click(screen.getByText('+ Nueva encomienda'));
  await screen.findByText('Nueva encomienda');
  fireEvent.change(screen.getByPlaceholderText('Origen'), { target: { value: 'BOGOTA' } });
  fireEvent.change(screen.getByPlaceholderText('Destino'), { target: { value: 'TUNJA' } });
  fireEvent.click(screen.getByText('Buscar viajes'));
  fireEvent.click(await screen.findByText(/BOGOTA → TUNJA · 2026-11-20 · EVA SOTO/));
}

async function elegirReceptor() {
  fireEvent.change(screen.getByPlaceholderText('Receptor: busca por nombre o correo'), { target: { value: 'luis' } });
  fireEvent.mouseDown(await screen.findByText(/LUIS ROJAS/));
  await screen.findByText(/luis@x.co/);
}

describe('Dashboard · Xpress · nueva encomienda por búsqueda de viaje', () => {
  const rutasBase = {
    '/api/municipios': MUNICIPIOS,
    '/api/usuarios/buscar': [{ id: 12, nombre: 'LUIS ROJAS', correo: 'luis@x.co' }],
  };

  test('busca por origen y destino con el mismo endpoint del pasajero, elige el viaje y manda POST con el remitente de la sesión', async () => {
    montar({ ...rutasBase, '/api/viajes': [VIAJE], 'POST /api/xpress': jsonResponse({ message: 'Encomienda registrada', id: 1 }, 201) });
    await abrirXpress();

    await buscarYElegirViaje();
    expect(llamadas('GET', '/api/viajes').at(-1).url).toBe('/api/viajes?origen=BOGOTA&destino=TUNJA');
    await elegirReceptor();
    fireEvent.change(screen.getByLabelText('Descripción'), { target: { value: '  Caja con libros ' } });
    fireEvent.click(screen.getByText('Registrar encomienda'));

    await waitFor(() => expect(llamadas('POST', '/api/xpress')).toHaveLength(1));
    expect(llamadas('POST', '/api/xpress')[0].body).toEqual({
      viajeId: '5',
      usuarioId: 7,
      receptorEmail: 'luis@x.co',
      descripcion: 'Caja con libros',
      peso: null,
    });
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Encomienda registrada', { id: 'toast-id' }));
  });

  test('no lista viajes hasta buscar, y buscar sin origen o destino avisa sin llamar a la API', async () => {
    montar({ ...rutasBase, '/api/viajes': [VIAJE] });
    await abrirXpress();

    fireEvent.click(screen.getByText('+ Nueva encomienda'));
    await screen.findByText('Nueva encomienda');
    expect(screen.queryByText(/EVA SOTO/)).toBeNull();
    const antes = llamadas('GET', '/api/viajes').length;
    fireEvent.click(screen.getByText('Buscar viajes'));
    expect(toast.error).toHaveBeenLastCalledWith('Indica el origen y el destino del viaje');
    expect(llamadas('GET', '/api/viajes')).toHaveLength(antes);
  });

  test('si no hay viajes para la ruta avisa y no deja crear la encomienda', async () => {
    montar({ ...rutasBase, '/api/viajes': [] });
    await abrirXpress();

    fireEvent.click(screen.getByText('+ Nueva encomienda'));
    await screen.findByText('Nueva encomienda');
    fireEvent.change(screen.getByPlaceholderText('Origen'), { target: { value: 'BOGOTA' } });
    fireEvent.change(screen.getByPlaceholderText('Destino'), { target: { value: 'TUNJA' } });
    fireEvent.click(screen.getByText('Buscar viajes'));

    expect(await screen.findByText('No hay viajes para esa ruta; no se puede crear la encomienda.')).toBeTruthy();
    expect(screen.getByText('Registrar encomienda').disabled).toBe(true);
    fireEvent.click(screen.getByText('Registrar encomienda'));
    expect(llamadas('POST', '/api/xpress')).toHaveLength(0);
  });

  test('cambiar el origen o el destino descarta los resultados y el viaje elegido', async () => {
    montar({ ...rutasBase, '/api/viajes': [VIAJE] });
    await abrirXpress();

    await buscarYElegirViaje();
    fireEvent.change(screen.getByPlaceholderText('Destino'), { target: { value: 'TUNJ' } });
    expect(screen.queryByText(/EVA SOTO/)).toBeNull();
    expect(screen.getByText('Registrar encomienda').disabled).toBe(true);
  });

  test('con viaje elegido pero sin receptor o sin descripción avisa y no llama a la API', async () => {
    montar({ ...rutasBase, '/api/viajes': [VIAJE] });
    await abrirXpress();

    await buscarYElegirViaje();
    fireEvent.click(screen.getByText('Registrar encomienda'));
    expect(toast.error).toHaveBeenLastCalledWith('Elige quién la va a recibir');
    await elegirReceptor();
    fireEvent.click(screen.getByText('Registrar encomienda'));
    expect(toast.error).toHaveBeenLastCalledWith('Describe lo que vas a enviar');
    expect(llamadas('POST', '/api/xpress')).toHaveLength(0);
  });

  test('si la API rechaza (receptor no registrado) muestra su mensaje y deja el formulario abierto', async () => {
    montar({
      ...rutasBase,
      '/api/viajes': [VIAJE],
      'POST /api/xpress': jsonResponse({ error: 'El receptor debe ser un usuario registrado en Bycar.' }, 404),
    });
    await abrirXpress();

    await buscarYElegirViaje();
    await elegirReceptor();
    fireEvent.change(screen.getByLabelText('Descripción'), { target: { value: 'Caja' } });
    fireEvent.click(screen.getByText('Registrar encomienda'));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('El receptor debe ser un usuario registrado en Bycar.', { id: 'toast-id' }));
    expect(screen.getByText('Registrar encomienda')).toBeTruthy();
  });
});
