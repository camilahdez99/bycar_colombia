'use client';

import React from 'react';

/** Modal con los datos de un viaje de la búsqueda y el botón para solicitar cupo. */
export default function DetallesViajeModal({ viaje, yaSolicitado, onCerrar, onSolicitar }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
      <div style={{ background: 'var(--surface)', width: '100%', maxWidth: '450px', borderRadius: '24px', border: '1px solid var(--border)', padding: '2.5rem', position: 'relative' }}>
        <button onClick={onCerrar} style={{ position: 'absolute', top: '20px', right: '20px', background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '1.2rem' }}>✕</button>
        <h2 style={{ fontFamily: 'Syne', marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '10px' }}>Detalles del Viaje</h2>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.95rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--muted)' }}>Ruta:</span> <strong>{viaje.origen} → {viaje.destino}</strong></div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--muted)' }}>Conductor:</span> <strong>{viaje.conductor}</strong></div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--muted)' }}>Vehículo:</span> <strong>{viaje.carro || 'N/A'}</strong></div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--muted)' }}>Fecha:</span> <strong>{viaje.hora}</strong></div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--muted)' }}>Puestos Disp:</span> <strong>{viaje.puestos}</strong></div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--muted)' }}>Valor:</span> <strong style={{ color: 'var(--red)' }}>${viaje.valor}</strong></div>
          
          <div style={{ marginTop: '1rem', background: 'rgba(255,255,255,0.03)', padding: '15px', borderRadius: '12px', border: '1px solid var(--border)' }}>
            <span style={{ color: 'var(--red)', fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>Comentarios del conductor:</span>
            <p style={{ color: '#fff', margin: 0, fontStyle: 'italic' }}>{viaje.comentarios || 'Sin comentarios adicionales.'}</p>
          </div>
        </div>

        <button className="btn-red" style={{ width: '100%', justifyContent: 'center', marginTop: '2rem' }} onClick={onSolicitar} disabled={yaSolicitado}>
          {yaSolicitado ? 'Solicitud Pendiente' : 'Solicitar Cupo'}
        </button>
      </div>
    </div>
  );
}
