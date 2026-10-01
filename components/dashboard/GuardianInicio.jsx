'use client';

import React from 'react';

/** Guardián sin activar: viajes aceptados de hoy para protegerlos y alertas de los contactos. */
export default function GuardianInicio({ rutasSolicitadas, alertasRecibidas, onElegirViaje }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
      <div>
        <h3 style={{ color: 'var(--muted)', fontSize: '0.85rem', marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '1px' }}>🛡️ Proteger mi viaje (Hoy)</h3>
        {(() => {
          const d = new Date();
          const todayStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          const viajesHoy = rutasSolicitadas.filter(r => (r.estado?.toUpperCase().startsWith('ACEPTAD')) && r.fecha === todayStr);
          
          return viajesHoy.length === 0 ? (
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '20px', padding: '2rem', textAlign: 'center' }}>
            <p style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>No tienes viajes aceptados para el día de hoy.</p>
          </div>
        ) : (
          viajesHoy.map(viaje => (


            <div key={viaje.id} className="route-card" style={{ cursor: 'pointer' }} onClick={() => onElegirViaje(viaje)}>
              <div>
                <strong>{viaje.origen} → {viaje.destino}</strong>
                <p style={{ color: 'var(--muted)', fontSize: '0.75rem' }}>{viaje.conductor} • {viaje.placa}</p>
              </div>
              <div style={{ background: 'rgba(229,34,34,0.1)', color: 'var(--red)', padding: '6px 12px', borderRadius: '8px', fontWeight: 'bold', fontSize: '0.75rem' }}>Activar</div>
            </div>
          ))
        ); })()}
      </div>

      <div>
        <h3 style={{ color: 'var(--muted)', fontSize: '0.85rem', marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '1px' }}>🚨 Alertas de Seguridad (Soy Guardián)</h3>
        {alertasRecibidas.length === 0 ? (
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '20px', padding: '2rem', textAlign: 'center' }}>
            <p style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>No tienes alertas de seguridad activas de tus contactos.</p>
          </div>
        ) : (
          alertasRecibidas.map(alerta => (
            <div key={alerta.id} className="route-card" style={{ border: alerta.estado?.toUpperCase() === 'ALERTA' ? '1px solid var(--red)' : '1px solid var(--border)', background: alerta.estado?.toUpperCase() === 'ALERTA' ? 'rgba(229,34,34,0.05)' : 'var(--card)' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                   <strong style={{ color: alerta.estado?.toUpperCase() === 'ALERTA' ? 'var(--red)' : '#fff' }}>{alerta.estado?.toUpperCase() === 'ALERTA' ? '⚠️ ALERTA: ' : '✅ EN RUTA: '}{alerta.pasajero}</strong>
                   <span style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>{alerta.inicio}</span>
                </div>
                <p style={{ fontSize: '0.85rem', margin: '4px 0' }}>{alerta.origen} → {alerta.destino}</p>
                <div style={{ fontSize: '0.75rem', color: 'var(--muted)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px' }}>
                  <span>🚗 {alerta.carro}</span>
                  <span>🔢 {alerta.placa}</span>
                  <span>👤 Cond: {alerta.conductor}</span>
                  <span>⏱️ Tiempo: {alerta.tiempo} min</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
