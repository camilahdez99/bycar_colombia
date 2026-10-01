import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { toast } from 'react-hot-toast';
import DashboardPage from '@/app/dashboard/page';
import { clickNav, iniciarSesion, llamadas, stubApi } from '../helpers/dashboard';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));
vi.mock('react-hot-toast', () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), loading: vi.fn(() => 'toast-id') }),
}));

async function abrirFormulario() {
  fireEvent.click(await screen.findByText('Crear nueva ruta'));
  await screen.findByText('Publicar nuevo viaje');
  // Los municipios y marcas llegan en paralelo: el autocompletado y el select los necesitan
  await screen.findByRole('option', { name: 'MAZDA' });
}

const campo = (placeholder) => screen.getAllByPlaceholderText(placeholder).at(-1);
const formulario = () => screen.getByText('Publicar Viaje').closest('form');

function completarFormulario() {
  fireEvent.change(campo('Origen'), { target: { value: 'bogotá' } });
  fireEvent.change(campo('Destino'), { target: { value: 'medellin' } });
  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'MAZDA' } });
  fireEvent.change(campo('Placa (Ej: XYZ123)'), { target: { value: 'abc123' } });
  fireEvent.change(document.querySelector('input[name="fecha"]'), { target: { value: '2026-10-05' } });
  fireEvent.change(campo('Puestos'), { target: { value: '3' } });
  fireEvent.change(campo('Valor por persona'), { target: { value: '25000' } });
  fireEvent.change(campo('Comentarios extras (Ej: NO MASCOTAS, MALETA PEQUEÑA...)'), { target: { value: 'sin mascotas' } });
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe('Dashboard · publicar viaje (caracterización)', () => {
  test('envía el formulario tal como está en pantalla: valor con comas, puestos como texto y marca repetida en carro', async () => {
    iniciarSesion();
    stubApi({ 'POST /api/viajes': { id: 55 } });
    render(<DashboardPage />);
    await abrirFormulario();
    completarFormulario();
    fireEvent.submit(formulario());

    await waitFor(() => expect(llamadas('POST', '/api/viajes')).toHaveLength(1));
    expect(llamadas('POST', '/api/viajes')[0].body).toEqual({
      origen: 'BOGOTA',
      destino: 'MEDELLIN',
      marca: 'MAZDA',
      carro: 'MAZDA',
      placa: 'ABC123',
      fecha: '2026-10-05',
      puestos: '3',
      valor: '25,000',
      comentarios: 'SIN MASCOTAS',
      usuarioId: 7,
    });
  });

  test('el cliente no valida: un formulario vacío se envía igual si se dispara el submit', async () => {
    iniciarSesion();
    stubApi({ 'POST /api/viajes': { id: 55 } });
    render(<DashboardPage />);
    await abrirFormulario();
    fireEvent.submit(formulario());

    await waitFor(() => expect(llamadas('POST', '/api/viajes')).toHaveLength(1));
    expect(llamadas('POST', '/api/viajes')[0].body).toEqual({
      origen: '', destino: '', marca: '', carro: '', placa: '', fecha: '', puestos: '', valor: '', comentarios: '', usuarioId: 7,
    });
  });

  test('sin usuario en sesión no publica y avisa que hay que iniciar sesión (F1)', async () => {
    stubApi({ 'POST /api/viajes': { id: 55 } });
    render(<DashboardPage />);
    await abrirFormulario();
    fireEvent.submit(formulario());

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Inicia sesión para continuar'));
    expect(llamadas('POST', '/api/viajes')).toHaveLength(0);
    expect(toast.loading).not.toHaveBeenCalled();
  });

  test('publicación correcta: cierra el modal, avisa y agrega la ruta al FINAL de Mis Rutas con los datos del formulario (F30)', async () => {
    iniciarSesion();
    let pedidosMisRutas = 0;
    stubApi({
      // El refresco al cambiar de pestaña reemplaza la lista con la del servidor: se deja colgado
      // para observar la lista local, que es la que queda en pantalla hasta que responde
      '/api/viajes/mis-rutas': () => {
        pedidosMisRutas += 1;
        if (pedidosMisRutas > 1) return new Promise(() => {});
        return { publicadas: [{ id: 90, origen: 'CALI', destino: 'PASTO', placa: 'ZZZ999', fecha: '2026-09-01' }], solicitadas: [] };
      },
      'POST /api/viajes': { id: 55 },
    });
    render(<DashboardPage />);
    await abrirFormulario();
    completarFormulario();
    fireEvent.submit(formulario());

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Ruta publicada correctamente', { id: 'toast-id' }));
    expect(toast.loading).toHaveBeenCalledWith('Publicando tu ruta...');
    expect(screen.queryByText('Publicar nuevo viaje')).toBeNull();

    clickNav('Mis Rutas');
    const tarjetas = (await screen.findAllByText(/→/)).map((el) => el.textContent);
    expect(tarjetas).toEqual(['CALI → PASTO', 'BOGOTA → MEDELLIN']);
    expect(screen.getByText('Placa: ABC123 • 2026-10-05')).toBeTruthy();
  });

  test('comportamiento actual: el refresco de Mis Rutas reemplaza la lista local, así que la ruta recién publicada desaparece si el servidor no la devuelve', async () => {
    iniciarSesion();
    stubApi({
      '/api/viajes/mis-rutas': { publicadas: [{ id: 90, origen: 'CALI', destino: 'PASTO', placa: 'ZZZ999', fecha: '2026-09-01' }], solicitadas: [] },
      'POST /api/viajes': { id: 55 },
    });
    render(<DashboardPage />);
    await abrirFormulario();
    completarFormulario();
    fireEvent.submit(formulario());
    await waitFor(() => expect(toast.success).toHaveBeenCalled());

    clickNav('Mis Rutas');
    await waitFor(() => expect(screen.getAllByText(/→/).map((el) => el.textContent)).toEqual(['CALI → PASTO']));
  });

  test('tras publicar, el formulario se reabre vacío', async () => {
    iniciarSesion();
    stubApi({ 'POST /api/viajes': { id: 55 } });
    render(<DashboardPage />);
    await abrirFormulario();
    completarFormulario();
    fireEvent.submit(formulario());
    await waitFor(() => expect(screen.queryByText('Publicar nuevo viaje')).toBeNull());

    await abrirFormulario();
    expect(campo('Placa (Ej: XYZ123)').value).toBe('');
    expect(campo('Valor por persona').value).toBe('');
    expect(campo('Origen').value).toBe('');
  });

  test('error de la API: muestra su mensaje y deja el modal abierto con los datos', async () => {
    iniciarSesion();
    stubApi({ 'POST /api/viajes': () => new Response(JSON.stringify({ error: 'Faltan campos' }), { status: 400 }) });
    render(<DashboardPage />);
    await abrirFormulario();
    completarFormulario();
    fireEvent.submit(formulario());

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Faltan campos', { id: 'toast-id' }));
    expect(screen.getByText('Publicar nuevo viaje')).toBeTruthy();
    expect(campo('Placa (Ej: XYZ123)').value).toBe('ABC123');
  });

  test('error sin mensaje: "Error al publicar"; falla de red: "Error de conexión"', async () => {
    iniciarSesion();
    let intento = 0;
    stubApi({
      'POST /api/viajes': () => {
        intento += 1;
        if (intento === 1) return new Response('{}', { status: 500 });
        throw new TypeError('Failed to fetch');
      },
    });
    render(<DashboardPage />);
    await abrirFormulario();
    fireEvent.submit(formulario());
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Error al publicar', { id: 'toast-id' }));

    fireEvent.submit(formulario());
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Error de conexión', { id: 'toast-id' }));
  });

  test('el autocompletado del formulario completa el municipio al elegir una opción', async () => {
    iniciarSesion();
    stubApi();
    render(<DashboardPage />);
    await abrirFormulario();

    fireEvent.change(campo('Destino'), { target: { value: 'med' } });
    fireEvent.mouseDown(await screen.findByText('MEDELLIN', { selector: 'li' }));

    expect(campo('Destino').value).toBe('MEDELLIN');
    expect(screen.queryByText('MEDELLIN', { selector: 'li' })).toBeNull();
  });

  test('la ✕ cierra el modal sin publicar', async () => {
    iniciarSesion();
    stubApi();
    render(<DashboardPage />);
    await abrirFormulario();
    fireEvent.click(screen.getByText('Publicar nuevo viaje').parentElement.querySelector('button'));

    expect(screen.queryByText('Publicar nuevo viaje')).toBeNull();
    expect(llamadas('POST', '/api/viajes')).toEqual([]);
  });

  test('sin el permiso /inicio/crear el botón queda deshabilitado', async () => {
    iniciarSesion();
    stubApi({ '/api/admin/permisos': [{ menuUrl: '/inicio/buscar' }] });
    render(<DashboardPage />);

    await waitFor(() => expect(screen.getByText('Crear nueva ruta').disabled).toBe(true));
    expect(screen.getByText('Buscar rutas disponibles').disabled).toBe(false);
  });
});
