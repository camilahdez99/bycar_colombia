'use client';

import React from 'react';

/** Modal para configurar el guardián (contacto y tiempo) antes de iniciar el viaje. */
export default function ConfigurarGuardianModal({ viaje, config, setConfig, onCerrar, onIniciar }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '20px' }}>
      <div style={{ 
        background: 'var(--surface)', 
        width: '100%', 
        maxWidth: '480px', 
        maxHeight: '90vh',
        overflowY: 'auto',
        borderRadius: '24px', 
        border: '1px solid var(--border)', 
        padding: '2rem', 
        position: 'relative',
        boxShadow: '0 20px 50px rgba(0,0,0,0.5)'
      }}>
        <button 
          onClick={onCerrar} 
          style={{ 
            position: 'absolute', top: '15px', right: '15px', 
            background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', 
            color: '#fff', cursor: 'pointer', fontSize: '1rem',
            width: '32px', height: '32px', borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 10
          }}
        >✕</button>
        <h2 style={{ fontFamily: 'Syne', fontSize: '1.4rem', fontWeight: 800, marginBottom: '0.5rem', color: 'var(--red)' }}>🛡️ Configurar Guardián</h2>
        <p style={{ color: 'var(--muted)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>Configura tu red de seguridad antes de iniciar el viaje.</p>


        <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '14px', border: '1px solid var(--border)', marginBottom: '1.5rem' }}>
          <p style={{ fontWeight: 'bold', marginBottom: '8px' }}>{viaje.origen} → {viaje.destino}</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.8rem', color: 'var(--muted)' }}>
            <span>🚗 Vehículo: <strong style={{ color: '#fff' }}>{viaje.carro || 'N/A'}</strong></span>
            <span>🔢 Placa: <strong style={{ color: '#fff' }}>{viaje.placa || 'N/A'}</strong></span>
            <span>👤 {viaje.conductor}</span>
            <span>📅 {viaje.fecha}</span>
          </div>
        </div>


        <div style={{ background: 'rgba(250,204,21,0.06)', border: '1px solid rgba(250,204,21,0.2)', borderRadius: '14px', padding: '1rem', marginBottom: '1.5rem' }}>
          <p style={{ color: '#facc15', fontWeight: 'bold', fontSize: '0.85rem', marginBottom: '4px' }}>⚠️ Verificación de Seguridad</p>
          <p style={{ color: 'var(--muted)', fontSize: '0.8rem', lineHeight: '1.5' }}>Solo aborda el vehículo si coincide con la placa <strong style={{ color: '#fff' }}>{viaje.placa}</strong> y la descripción <strong style={{ color: '#fff' }}>{viaje.carro || 'indicada'}</strong>.</p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--muted)', marginBottom: '8px' }}>📧 Correo del contacto de confianza</label>
            <input 
              className="search-input" 
              type="email" 
              placeholder="ejemplo@correo.com" 
              value={config.email} 
              onChange={(e) => setConfig({...config, email: e.target.value})} 
              style={{ padding: '12px 16px' }}
              required 
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--muted)', marginBottom: '8px' }}>⏱️ Tiempo estimado del viaje (minutos)</label>
            <input 
              className="search-input" 
              type="number" 
              min="5" 
              max="600" 
              placeholder="30" 
              value={config.tiempoMin} 
              onChange={(e) => setConfig({...config, tiempoMin: parseInt(e.target.value) || 0})} 
              style={{ padding: '12px 16px' }}
              required 
            />
          </div>
        </div>

        <div style={{ background: 'rgba(229,34,34,0.04)', border: '1px solid rgba(229,34,34,0.1)', borderRadius: '16px', padding: '1.2rem', marginTop: '1.5rem', fontSize: '0.8rem', color: 'var(--muted)', lineHeight: '1.6' }}>
          <strong style={{ color: '#fff', display: 'block', marginBottom: '8px', fontSize: '0.9rem' }}>¿Cómo funciona?</strong>
          <ul style={{ paddingLeft: '1.2rem', margin: 0 }}>
            <li>Al iniciar, se activa un temporizador en tiempo real.</li>
            <li>5 min antes de expirar: recibirás un aviso para confirmar tu llegada.</li>
            <li>Si no confirmas a tiempo: se envía una alerta a tu contacto con los detalles del vehículo y conductor.</li>
          </ul>
        </div>

        <button className="btn-red" onClick={onIniciar} style={{ width: '100%', justifyContent: 'center', marginTop: '1.5rem', padding: '1.2rem', fontSize: '1.1rem', borderRadius: '14px', boxShadow: '0 10px 20px rgba(229,34,34,0.2)' }}>
          🛡️ Iniciar Viaje Seguro
        </button>

      </div>
    </div>
  );
}
