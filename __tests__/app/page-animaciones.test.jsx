import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import LandingPage from '@/app/page';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

// IntersectionObserver controlable: cada instancia se puede disparar a mano
let observers;
class FakeIntersectionObserver {
  constructor(callback) {
    this.callback = callback;
    this.elements = [];
    this.disconnected = false;
    observers.push(this);
  }
  observe(el) { this.elements.push(el); }
  disconnect() { this.disconnected = true; }
  intersect(isIntersecting = true) {
    act(() => this.callback([{ isIntersecting }]));
  }
}

const observerDe = (el) => observers.find((o) => o.elements.includes(el));

beforeEach(() => {
  observers = [];
  globalThis.IntersectionObserver = FakeIntersectionObserver;
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  push.mockClear();
  vi.useRealTimers();
  window.scrollY = 0;
});

describe('LandingPage · DOM (caracterización)', () => {
  test('el HTML renderizado no cambia', () => {
    const { container } = render(<LandingPage />);
    expect(container.innerHTML).toMatchSnapshot();
  });
});

describe('LandingPage · animaciones (caracterización)', () => {
  test('el hero entra a los 80 ms: badge, título y subtítulo pasan a "ready"', () => {
    const { container } = render(<LandingPage />);
    const animados = ['.hero-badge', '.hero-title', '.hero-sub'].map((s) => container.querySelector(s));
    animados.forEach((el) => expect(el.classList.contains('ready')).toBe(false));

    act(() => vi.advanceTimersByTime(79));
    animados.forEach((el) => expect(el.classList.contains('ready')).toBe(false));

    act(() => vi.advanceTimersByTime(1));
    animados.forEach((el) => expect(el.classList.contains('ready')).toBe(true));
  });

  test('el nav suma "scrolled" con más de 20 px de scroll y lo quita al volver', () => {
    const { container } = render(<LandingPage />);
    const nav = container.querySelector('nav');
    expect(nav.className).toBe('');

    window.scrollY = 20;
    fireEvent.scroll(window);
    expect(nav.className).toBe('');

    window.scrollY = 21;
    fireEvent.scroll(window);
    expect(nav.className).toBe('scrolled');

    window.scrollY = 0;
    fireEvent.scroll(window);
    expect(nav.className).toBe('');
  });

  test('cada sección se anima al entrar en pantalla, una sola vez', () => {
    const { container } = render(<LandingPage />);
    const steps = container.querySelector('.steps');
    const guardianes = container.querySelector('.guardianes-container');
    const cta = container.querySelector('.cta-section');

    const visibles = (selector) =>
      [...container.querySelectorAll(selector)].map((el) => el.classList.contains('visible'));

    expect(visibles('.step-card')).toEqual([false, false, false, false]);
    expect(visibles('.feature-item')).toEqual([false, false, false]);
    expect(visibles('.route-visual')).toEqual([false]);
    expect(cta.classList.contains('visible')).toBe(false);

    observerDe(steps).intersect(false);
    expect(visibles('.step-card')).toEqual([false, false, false, false]);

    observerDe(steps).intersect();
    expect(visibles('.step-card')).toEqual([true, true, true, true]);
    expect(observerDe(steps).disconnected).toBe(true);
    expect(visibles('.feature-item')).toEqual([false, false, false]);

    observerDe(guardianes).intersect();
    expect(visibles('.feature-item')).toEqual([true, true, true]);
    expect(visibles('.route-visual')).toEqual([true]);
    expect(cta.classList.contains('visible')).toBe(false);

    observerDe(cta).intersect();
    expect(cta.classList.contains('visible')).toBe(true);
  });

  test('se observan exactamente las tres secciones animadas', () => {
    const { container } = render(<LandingPage />);
    const observados = observers.flatMap((o) => o.elements);
    expect(observados).toEqual(expect.arrayContaining([
      container.querySelector('.steps'),
      container.querySelector('.guardianes-container'),
      container.querySelector('.cta-section'),
    ]));
    expect(observados).toHaveLength(3);
  });

  test('el logo lleva al inicio', () => {
    render(<LandingPage />);
    fireEvent.click(screen.getByText('Bycar', { selector: '.nav-logo span' }));
    expect(push).toHaveBeenCalledWith('/');
  });

  test('"Ya tengo cuenta" resalta el borde al pasar el mouse y lo restaura al salir', () => {
    render(<LandingPage />);
    const boton = screen.getByRole('button', { name: 'Ya tengo cuenta' });
    // jsdom no separa el `border` con var() en sus longhands: se lee del atributo
    expect(boton.getAttribute('style')).toContain('border: 1px solid var(--border)');

    fireEvent.mouseEnter(boton);
    expect(boton.style.borderColor).toMatch(/^rgba\(255,\s?255,\s?255,\s?0?\.4\)$/);

    fireEvent.mouseLeave(boton);
    expect(boton.style.borderColor).toBe('var(--border)');
  });
});
