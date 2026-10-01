import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import AdminPage from '@/app/admin/page';
import { toast } from 'react-hot-toast';

vi.mock('react-hot-toast', () => ({
  toast: { error: vi.fn(), success: vi.fn(), loading: vi.fn(() => 'toast-id') },
}));

const jsonResponse = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const COLUMNAS = [
  { COLUMN_NAME: 'ID_MAR', DATA_TYPE: 'NUMBER', NULLABLE: 'N' },
  { COLUMN_NAME: 'NOMBRE_MAR', DATA_TYPE: 'VARCHAR2', NULLABLE: 'Y' },
];

let filas;
let mutacion; // respuesta de POST/PUT/DELETE
let recargaFalla;

function api(url, init = {}) {
  const method = init.method ?? 'GET';
  if (url === '/api/admin/tablas?list=1') return jsonResponse(['MARCAS']);
  if (url.startsWith('/api/admin/tablas?metadata=1')) return jsonResponse(COLUMNAS);
  if (method !== 'GET') return mutacion;
  if (recargaFalla && fetch.mock.calls.some(([, i]) => i?.method && i.method !== 'GET')) throw new TypeError('Failed to fetch');
  return jsonResponse(filas);
}

const mutaciones = () =>
  fetch.mock.calls
    .filter(([, init]) => init?.method && init.method !== 'GET')
    .map(([url, init]) => [url, init.method, init.body ? JSON.parse(init.body) : undefined]);

async function renderAdmin() {
  render(<AdminPage />);
  await screen.findByRole('columnheader', { name: 'ID_MAR' });
}

beforeEach(() => {
  filas = [{ ID_MAR: 1, NOMBRE_MAR: 'Mazda' }];
  mutacion = jsonResponse({ ok: true });
  recargaFalla = false;
  vi.stubGlobal('fetch', vi.fn(async (url, init) => api(url, init)));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe('AdminPage: alta (caracterización)', () => {
  test('POST con el formulario, toast de éxito, recarga filas y cierra el modal', async () => {
    await renderAdmin();
    fireEvent.click(screen.getByRole('button', { name: /Nuevo/ }));
    fireEvent.change(document.querySelector('input[name="ID_MAR"]'), { target: { value: '2' } });
    fireEvent.change(document.querySelector('input[name="NOMBRE_MAR"]'), { target: { value: 'Kia' } });
    filas = [...filas, { ID_MAR: 2, NOMBRE_MAR: 'Kia' }];
    fireEvent.click(screen.getByRole('button', { name: 'Crear' }));

    await screen.findByText('Kia');
    expect(mutaciones()).toEqual([['/api/admin/tablas?tabla=MARCAS', 'POST', { ID_MAR: '2', NOMBRE_MAR: 'Kia' }]]);
    expect(toast.loading).toHaveBeenCalledWith('Creando registro...');
    expect(toast.success).toHaveBeenCalledWith('Registro creado', { id: 'toast-id' });
    expect(screen.queryByText('Nuevo registro')).toBeNull();
  });

  test('error de la API: toast con el mensaje del body y el modal sigue abierto', async () => {
    mutacion = jsonResponse({ error: 'ORA-00001' }, 500);
    await renderAdmin();
    fireEvent.click(screen.getByRole('button', { name: /Nuevo/ }));
    fireEvent.change(document.querySelector('input[name="ID_MAR"]'), { target: { value: '1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Crear' }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('ORA-00001', { id: 'toast-id' }));
    expect(screen.getByText('Nuevo registro')).toBeTruthy();
  });

  test('error de la API sin mensaje: texto por defecto', async () => {
    mutacion = jsonResponse({}, 500);
    await renderAdmin();
    fireEvent.click(screen.getByRole('button', { name: /Nuevo/ }));
    fireEvent.change(document.querySelector('input[name="ID_MAR"]'), { target: { value: '1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Crear' }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Error al crear', { id: 'toast-id' }));
  });

  test('si falla la recarga posterior: avisa que se guardó pero no se recargó, y cierra el modal (E6)', async () => {
    recargaFalla = true;
    await renderAdmin();
    fireEvent.click(screen.getByRole('button', { name: /Nuevo/ }));
    fireEvent.change(document.querySelector('input[name="ID_MAR"]'), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Crear' }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Se guardó el cambio, pero no se pudo recargar la lista'));
    expect(toast.success).toHaveBeenCalledWith('Registro creado', { id: 'toast-id' });
    expect(toast.error).not.toHaveBeenCalledWith('Error de red', expect.anything());
    expect(screen.queryByText('Nuevo registro')).toBeNull();
  });

  test('si la recarga responde un error de la API: mismo aviso y se conservan las filas (E6)', async () => {
    await renderAdmin();
    fetch.mockImplementation(async (url, init) => {
      if (!init?.method && url === '/api/admin/tablas?tabla=MARCAS') return jsonResponse({ error: 'ORA' }, 500);
      return api(url, init);
    });
    fireEvent.click(screen.getByRole('button', { name: /Nuevo/ }));
    fireEvent.change(document.querySelector('input[name="ID_MAR"]'), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Crear' }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Se guardó el cambio, pero no se pudo recargar la lista'));
    expect(screen.getByText('Mazda')).toBeTruthy();
  });
});

describe('AdminPage: edición (caracterización)', () => {
  test('PUT con el id de la fila y el formulario completo', async () => {
    await renderAdmin();
    fireEvent.click(screen.getByTitle('Editar'));
    fireEvent.change(document.querySelector('input[name="NOMBRE_MAR"]'), { target: { value: 'Mazda 3' } });
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar' }));

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Registro actualizado', { id: 'toast-id' }));
    expect(mutaciones()).toEqual([['/api/admin/tablas?id=1&tabla=MARCAS', 'PUT', { ID_MAR: 1, NOMBRE_MAR: 'Mazda 3' }]]);
    expect(toast.loading).toHaveBeenCalledWith('Actualizando registro...');
    await waitFor(() => expect(screen.queryByText('Editar registro')).toBeNull());
  });

  test('error de red: toast "Error de red"', async () => {
    await renderAdmin();
    fetch.mockImplementation(async (url, init) => {
      if (init?.method === 'PUT') throw new TypeError('Failed to fetch');
      return api(url, init);
    });
    fireEvent.click(screen.getByTitle('Editar'));
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar' }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Error de red', { id: 'toast-id' }));
  });
});

describe('AdminPage: baja (caracterización)', () => {
  test('si no se confirma, no llama a la API', async () => {
    vi.stubGlobal('confirm', vi.fn(() => false));
    await renderAdmin();
    fireEvent.click(screen.getByTitle('Eliminar'));
    expect(confirm).toHaveBeenCalledWith('¿Eliminar este registro?');
    expect(mutaciones()).toEqual([]);
  });

  test('confirmado: DELETE con el id, toast y recarga', async () => {
    vi.stubGlobal('confirm', vi.fn(() => true));
    await renderAdmin();
    filas = [];
    fireEvent.click(screen.getByTitle('Eliminar'));

    await screen.findByText('No se encontraron registros');
    expect(mutaciones()).toEqual([['/api/admin/tablas?id=1&tabla=MARCAS', 'DELETE', undefined]]);
    expect(toast.loading).toHaveBeenCalledWith('Eliminando...');
    expect(toast.success).toHaveBeenCalledWith('Eliminado', { id: 'toast-id' });
  });

  test('error de la API: toast con el mensaje o el texto por defecto', async () => {
    vi.stubGlobal('confirm', vi.fn(() => true));
    mutacion = jsonResponse({}, 400);
    await renderAdmin();
    fireEvent.click(screen.getByTitle('Eliminar'));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Error al eliminar', { id: 'toast-id' }));
  });
});

describe('AdminPage: filas', () => {
  test('filas sin id reconocible se muestran igual (key de respaldo)', async () => {
    filas = [{ NOMBRE_MAR: 'Sin id' }, { NOMBRE_MAR: 'Otra' }];
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await renderAdmin();
    expect(await screen.findByText('Sin id')).toBeTruthy();
    expect(screen.getByText('Otra')).toBeTruthy();
  });
});
