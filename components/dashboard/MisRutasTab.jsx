'use client';

import React from 'react';

/** Pestaña "Mis rutas": viajes publicados y solicitudes enviadas con su estado. */
export default function MisRutasTab({ rutasPublicadas, rutasSolicitadas }) {
  return (
    <section>
      <div className="page-header">
        <div>
          <h1 style={{ fontFamily: 'Syne', fontWeight: 800 }}>Mis Rutas</h1>
          <p style={{ color: 'var(--muted)' }}>Gestiona tus viajes publicados y solicitudes enviadas</p>
        </div>
      </div>
      <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginTop: '2rem' }}>
        <div>
          <h3 style={{ color: 'var(--muted)', fontSize: '0.9rem', marginBottom: '1rem' }}>RUTAS PUBLICADAS</h3>
          {rutasPublicadas.map(r => (
            <div key={r.id} className="route-card">
              <div><strong>{r.origen} → {r.destino}</strong><p style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>Placa: {r.placa} • {r.fecha}</p></div>
            </div>
          ))}
        </div>
        <div>
          <h3 style={{ color: 'var(--muted)', fontSize: '0.9rem', marginBottom: '1rem' }}>RUTAS SOLICITADAS</h3>
          {rutasSolicitadas.map(r => (
            <div key={r.id} className="route-card">
              <div><strong>{r.origen} → {r.destino}</strong><p style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>Conductor: {r.conductor} • {r.fecha}</p></div>
              <span className={`badge-status ${r.estado}`}>{r.estado}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
