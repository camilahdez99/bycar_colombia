import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { toast } from 'react-hot-toast';
import DashboardPage from '@/app/dashboard/page';
import { clickNav, iniciarSesion, llamadas, stubApi } from '../helpers/dashboard';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));
vi.mock('react-hot-toast', () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), loading: vi.fn(() => 'toast-id') }),
}));

const VIAJES = [
  { id: 9, origen: 'BOGOTA', destino: 'TUNJA', conductor: 'LUIS', hora: '2026-10-01', valor: 25000, puestos: 3, carro: 'MAZDA', comentarios: '' },
];
const PUBLICADAS = {
  publicadas: [{ id: 50, origen: 'BELLO', destino: 'ENVIGADO', placa: 'ABC123', fecha: '2026-11-18', estado: 'Disponible' }],
  solicitadas: [],
};

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

describe('Dashboard · elegir guardián al solicitar cupo', () => {
  async function buscar() {
    await screen.findAllByPlaceholderText('Origen');
    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/municipios'));
    fireEvent.click(screen.getByText('Buscar rutas disponibles'));
    await screen.findByText('Resultados de búsqueda');
  }

  test('elige un contacto en el detalle y lo envía como contactoGuardianEmail', async () => {
    stubApi({
      '/api/viajes$': VIAJES,
      '/api/usuarios/buscar': [{ id: 55, nombre: 'MAMÁ PÉREZ', correo: 'mama@x.co' }],
      'POST /api/solicitudes': { message: 'ok' },
    });
    render(<DashboardPage />);
    await buscar();

    fireEvent.click(await screen.findByText('Ver Detalles'));
    await screen.findByText('Detalles del Viaje');

    fireEvent.change(screen.getByPlaceholderText('Busca por nombre o correo'), { target: { value: 'mama' } });
    fireEvent.mouseDown(await screen.findByText(/MAMÁ PÉREZ/));
    // Elegido: aparece el chip con el correo
    await screen.findByText(/mama@x.co/);

    fireEvent.click(screen.getByText('Solicitar Cupo'));

    await waitFor(() => expect(llamadas('POST', '/api/solicitudes')).toHaveLength(1));
    expect(llamadas('POST', '/api/solicitudes')[0].body).toMatchObject({
      viajeId: 9, usuarioId: 7, contactoGuardianEmail: 'mama@x.co', tiempoGuardian: 30,
    });
  });

  test('sin elegir contacto, solicita sin datos de guardián', async () => {
    stubApi({ '/api/viajes$': VIAJES, 'POST /api/solicitudes': { message: 'ok' } });
    render(<DashboardPage />);
    await buscar();
    fireEvent.click(await screen.findByText('Ver Detalles'));
    await screen.findByText('Detalles del Viaje');
    fireEvent.click(screen.getByText('Solicitar Cupo'));

    await waitFor(() => expect(llamadas('POST', '/api/solicitudes')).toHaveLength(1));
    expect(llamadas('POST', '/api/solicitudes')[0].body).toEqual({ viajeId: 9, usuarioId: 7 });
  });
});

describe('Dashboard · iniciar viaje (conductor)', () => {
  test('el botón inicia el viaje y avisa cuántos guardianes se activaron', async () => {
    stubApi({
      '/api/viajes/mis-rutas': PUBLICADAS,
      'POST /api/viajes/iniciar': { message: 'Viaje iniciado', guardianesActivados: 2 },
    });
    render(<DashboardPage />);
    clickNav('Mis Rutas');

    fireEvent.click(await screen.findByText('🛡️ Iniciar viaje'));
    await waitFor(() => expect(llamadas('POST', '/api/viajes/iniciar')).toHaveLength(1));
    expect(llamadas('POST', '/api/viajes/iniciar')[0].body).toEqual({ viajeId: 50 });
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Viaje iniciado. Se avisó a 2 contacto(s) de confianza.', { id: 'toast-id' }));
  });

  test('un viaje En Curso no muestra el botón de iniciar', async () => {
    stubApi({
      '/api/viajes/mis-rutas': { publicadas: [{ id: 51, origen: 'A', destino: 'B', placa: 'X', fecha: '2026-11-18', estado: 'En Curso' }], solicitadas: [] },
    });
    render(<DashboardPage />);
    clickNav('Mis Rutas');
    await screen.findByText('A → B');
    expect(screen.queryByText('🛡️ Iniciar viaje')).toBeNull();
  });
});

describe('Dashboard · guardián precarga el último contacto', () => {
  const VIAJES = [{ id: 9, origen: 'BOGOTA', destino: 'TUNJA', conductor: 'LUIS', hora: '2026-10-01', valor: 25000, puestos: 3, carro: 'MAZDA', comentarios: '' }];

  async function buscar() {
    await screen.findAllByPlaceholderText('Origen');
    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/municipios'));
    fireEvent.click(screen.getByText('Buscar rutas disponibles'));
    await screen.findByText('Resultados de búsqueda');
  }

  test('el detalle del viaje precarga el contacto usado antes, y se puede quitar para elegir otro', async () => {
    stubApi({
      '/api/viajes$': VIAJES,
      '/api/guardian/ultimo-contacto': { id: 55, nombre: 'MAMÁ PÉREZ', correo: 'mama@x.co' },
    });
    render(<DashboardPage />);
    await buscar();
    fireEvent.click(await screen.findByText('Ver Detalles'));
    await screen.findByText('Detalles del Viaje');

    // Aparece precargado como contacto elegido
    expect(await screen.findByText(/mama@x.co/)).toBeTruthy();
    // Se puede quitar para elegir otro (vuelve el buscador)
    fireEvent.click(screen.getByLabelText('Quitar contacto'));
    expect(screen.getByPlaceholderText('Busca por nombre o correo')).toBeTruthy();
  });

  test('sin historial, el detalle no precarga nada (muestra el buscador)', async () => {
    stubApi({ '/api/viajes$': VIAJES, '/api/guardian/ultimo-contacto': null });
    render(<DashboardPage />);
    await buscar();
    fireEvent.click(await screen.findByText('Ver Detalles'));
    await screen.findByText('Detalles del Viaje');
    expect(screen.getByPlaceholderText('Busca por nombre o correo')).toBeTruthy();
  });
});
