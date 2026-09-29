import { afterEach, beforeAll, describe, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import LandingPage from '@/app/page';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

beforeAll(() => {
  // jsdom no implementa IntersectionObserver
  globalThis.IntersectionObserver = class {
    observe() {}
    disconnect() {}
  };
});

afterEach(() => {
  cleanup();
  push.mockClear();
});

describe('LandingPage (caracterización)', () => {
  test('muestra el título principal', () => {
    render(<LandingPage />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
      'Viaja entre ciudades.Comparte el camino.'
    );
  });

  test.each([
    ['Iniciar sesión', '/login'],
    ['Registrarse', '/register'],
    ['Crear cuenta gratis', '/register'],
    ['Ya tengo cuenta', '/login'],
  ])('el botón "%s" navega a %s', (label, ruta) => {
    render(<LandingPage />);
    fireEvent.click(screen.getByRole('button', { name: label }));
    expect(push).toHaveBeenCalledWith(ruta);
  });
});
