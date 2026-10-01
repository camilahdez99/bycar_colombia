'use client';

import React from 'react';

/** Pestaña "Solicitudes": pedidos de cupo recibidos, para aceptar o rechazar. */
export default function SolicitudesTab({ solicitudesRecibidas, onAceptar, onRechazar }) {
  return (
    <section>
      <div className="page-header">
        <div>
          <h1 style={{ fontFamily: 'Syne', fontWeight: 800 }}>Solicitudes Recibidas</h1>
          <p style={{ color: 'var(--muted)' }}>Gestiona quiénes viajarán contigo en tus próximas rutas</p>
        </div>
      </div>
      {solicitudesRecibidas.map(s => (
        <div key={s.id} className="route-card">
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <div style={{ width: 40, height: 40, background: 'var(--red)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{s.avatar}</div>
            <div><strong>{s.pasajero}</strong><p style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>Ruta: {s.ruta}</p></div>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={() => onAceptar(s.id)} style={{ background: '#4ade80', border: 'none', padding: '8px 15px', borderRadius: '8px', fontWeight: 'bold' }}>Aceptar</button>
            <button onClick={() => onRechazar(s.id)} style={{ background: 'rgba(255,255,255,0.1)', color: '#fff', border: 'none', padding: '8px 15px', borderRadius: '8px' }}>Rechazar</button>
          </div>
        </div>
      ))}
    </section>
  );
}
