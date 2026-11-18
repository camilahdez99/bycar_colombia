'use client';

import React from 'react';

// Estados de viaje (ESTADOS_VIA) desde los que el conductor puede iniciar el viaje
const INICIABLES = ['Disponible', 'Lleno'];

/** Pestaña "Mis rutas": viajes publicados y solicitudes enviadas con su estado. */
export default function MisRutasTab({ rutasPublicadas, rutasSolicitadas, onIniciarViaje }) {
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {r.estado && <span className={`badge-status ${r.estado?.replace(/\s/g, '')}`}>{r.estado}</span>}
                {onIniciarViaje && INICIABLES.includes(r.estado) && (
                  <button className="btn-red" style={{ padding: '6px 14px', fontSize: '0.8rem' }} onClick={() => onIniciarViaje(r.id)}>
                    🛡️ Iniciar viaje
                  </button>
                )}
                {r.estado === 'En Curso' && <span style={{ color: '#4ade80', fontSize: '0.75rem', fontWeight: 'bold' }}>En curso</span>}
              </div>
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
