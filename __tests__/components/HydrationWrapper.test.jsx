import { afterEach, describe, expect, test } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import HydrationWrapper from '@/components/HydrationWrapper';

afterEach(cleanup);

describe('HydrationWrapper (caracterización)', () => {
  test('en el servidor no renderiza los hijos, solo el contenedor', () => {
    const html = renderToString(<HydrationWrapper><p>contenido</p></HydrationWrapper>);
    expect(html).not.toContain('contenido');
    expect(html).toContain('display:contents');
  });

  test('en el cliente renderiza los hijos dentro de un div con display: contents', () => {
    render(<HydrationWrapper><p>contenido</p></HydrationWrapper>);
    const hijo = screen.getByText('contenido');
    expect(hijo.parentElement.style.display).toBe('contents');
  });
});
