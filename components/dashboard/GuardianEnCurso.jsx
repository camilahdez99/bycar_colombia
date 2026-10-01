'use client';

import React from 'react';
import { formatTiempo } from '@/lib/client/formato';

/** Guardián activo: datos del viaje, cuenta regresiva, avisos y botón de llegada. */
export default function GuardianEnCurso({
  viaje, contactoEmail, tiempoRestante, segundosPreAlerta, horaInicio, alertaEnviada, preAlerta, onLlegue,
}) {
  return (
    <div style={{ background: 'linear-gradient(135deg, rgba(229,34,34,0.08), rgba(229,34,34,0.02))', border: '2px solid rgba(229,34,34,0.3)', borderRadius: '24px', padding: '2rem', marginBottom: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h3 style={{ fontFamily: 'Syne', fontSize: '1.2rem' }}>Viaje en Curso</h3>
        <span style={{ background: tiempoRestante <= segundosPreAlerta ? 'rgba(255,50,50,0.2)' : 'rgba(74,222,128,0.1)', color: tiempoRestante <= segundosPreAlerta ? '#ff4444' : '#4ade80', padding: '6px 14px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 'bold' }}>
          {tiempoRestante <= 0 ? '⚠️ TIEMPO AGOTADO' : tiempoRestante <= segundosPreAlerta ? '⚠️ POR EXPIRAR' : '✅ EN CAMINO'}
        </span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
        <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '14px', border: '1px solid var(--border)' }}>
          <p style={{ color: 'var(--muted)', fontSize: '0.7rem', marginBottom: '4px' }}>RUTA</p>
          <strong>{viaje.origen} → {viaje.destino}</strong>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '14px', border: '1px solid var(--border)' }}>
          <p style={{ color: 'var(--muted)', fontSize: '0.7rem', marginBottom: '4px' }}>CONDUCTOR</p>
          <strong>{viaje.conductor}</strong>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '14px', border: '1px solid var(--border)' }}>
          <p style={{ color: 'var(--muted)', fontSize: '0.7rem', marginBottom: '4px' }}>PLACA</p>
          <strong style={{ color: 'var(--red)', letterSpacing: '2px' }}>{viaje.placa}</strong>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '14px', border: '1px solid var(--border)' }}>
          <p style={{ color: 'var(--muted)', fontSize: '0.7rem', marginBottom: '4px' }}>CONTACTO ALERTA</p>
          <strong style={{ fontSize: '0.85rem' }}>{contactoEmail}</strong>
        </div>
      </div>
      <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
        <p style={{ color: 'var(--muted)', fontSize: '0.8rem', marginBottom: '8px' }}>Tiempo restante para confirmar llegada</p>
        <div style={{ fontFamily: 'Syne', fontSize: '3.5rem', fontWeight: 800, color: tiempoRestante <= segundosPreAlerta ? '#ff4444' : '#fff', letterSpacing: '4px', textShadow: tiempoRestante <= segundosPreAlerta ? '0 0 20px rgba(255,50,50,0.4)' : 'none', transition: 'color 0.5s' }}>
          {formatTiempo(tiempoRestante)}
        </div>
        {horaInicio && <p style={{ color: 'var(--muted)', fontSize: '0.75rem', marginTop: '8px' }}>Iniciado: {horaInicio.toLocaleTimeString()}</p>}
      </div>
      {alertaEnviada && (
        <div style={{ background: 'rgba(255,50,50,0.1)', border: '1px solid rgba(255,50,50,0.3)', borderRadius: '14px', padding: '1rem', marginBottom: '1rem', textAlign: 'center' }}>
          <p style={{ color: '#ff4444', fontWeight: 'bold', fontSize: '0.9rem' }}>🚨 ALERTA ENVIADA</p>
          <p style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>Se envió una alerta a {contactoEmail} con los detalles: Ruta {viaje.origen} → {viaje.destino}, Placa {viaje.placa}, Conductor {viaje.conductor}, Inicio {horaInicio?.toLocaleTimeString()}</p>
        </div>
      )}
      {preAlerta && !alertaEnviada && (
        <div style={{ background: 'rgba(250,204,21,0.08)', border: '1px solid rgba(250,204,21,0.3)', borderRadius: '14px', padding: '1rem', marginBottom: '1rem', textAlign: 'center' }}>
          <p style={{ color: '#facc15', fontWeight: 'bold' }}>⚠️ Tu viaje está por finalizar</p>
          <p style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>Confirma tu llegada para evitar alertar a tu contacto de confianza.</p>
        </div>
      )}
      <button className="btn-red" onClick={onLlegue} style={{ width: '100%', justifyContent: 'center', padding: '1.2rem', fontSize: '1.1rem', borderRadius: '16px' }}>
        ✅ He llegado a mi destino
      </button>
    </div>
  );
}
