'use client';

import { useEffect, useState } from 'react';

export function HeroTexto() {
  const [heroReady, setHeroReady] = useState(false);

  /* hero entrance — tiny delay so CSS is painted */
  useEffect(() => {
    const t = setTimeout(() => setHeroReady(true), 80);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="hero-content">
      <div className={`hero-badge${heroReady ? ' ready' : ''}`}>
        Carpooling intermunicipal en Colombia
      </div>
      <h1 className={`hero-title${heroReady ? ' ready' : ''}`}>
        Viaja entre ciudades.<br />
        <span className="accent">
          <span className="accent-wrap">Comparte el camino.</span>
        </span>
      </h1>
      <p className={`hero-sub${heroReady ? ' ready' : ''}`}>
        Conectamos conductores y viajeros en rutas intermunicipales.<br />
        Más económico, más cómodo y más seguro.
      </p>
    </div>
  );
}
