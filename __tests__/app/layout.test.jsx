import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import RootLayout, { metadata } from '@/app/layout';

vi.mock('next/font/google', () => ({ Inter: () => ({ variable: 'fuente-inter' }) }));
vi.mock('react-hot-toast', () => ({ Toaster: ({ position }) => <div data-toaster={position} /> }));

const URL_FUENTES = 'https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:wght@300;400;500;600&display=swap';
const globalsCss = readFileSync(join(process.cwd(), 'app', 'globals.css'), 'utf8');
const html = renderToStaticMarkup(<RootLayout><main>contenido</main></RootLayout>);

const apariciones = (texto, buscado) => texto.split(buscado).length - 1;

describe('RootLayout (caracterización)', () => {
  test('envuelve la página en html lang="es" con la variable de Inter, y suma el Toaster abajo a la derecha', () => {
    expect(html).toMatch(/<html lang="es" class="fuente-inter h-full antialiased">/);
    expect(html).toContain('<main>contenido</main>');
    expect(html).toContain('data-toaster="bottom-right"');
  });

  test('metadata de la app', () => {
    expect(metadata).toEqual({
      title: 'Bycar - Carpooling Intermunicipal',
      description: 'Viaja seguro y económico por Colombia con Bycar.',
    });
  });

  test('Syne y DM Sans se piden una sola vez, con las mismas familias y pesos', () => {
    const enLayout = apariciones(html.replace(/&amp;/g, '&'), URL_FUENTES);
    const enCss = apariciones(globalsCss, URL_FUENTES);
    expect(enLayout + enCss).toBe(1);
  });
});
