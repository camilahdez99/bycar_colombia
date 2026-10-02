'use client';

import React, { useEffect, useState } from 'react';
import { finDelGuardian, segundosHasta } from '@/lib/client/cuentaRegresiva';
import { formatTiempo } from '@/lib/client/formato';
import { PRE_ALERTA_SEG } from '@/hooks/dashboard/useGuardian';

/**
 * Segundos que le quedan al guardián, recalculados cada segundo contra el reloj. Es la misma
 * cuenta que ve la persona protegida: inicio + minutos estimados (con extensiones), que llegan
 * actualizados en cada refresco de la pestaña Guardián.
 */
function useSegundosRestantes(inicio, tiempoMin) {
  const fin = finDelGuardian(inicio, tiempoMin);
  const [segundos, setSegundos] = useState(() => segundosHasta(fin, Date.now()));

  useEffect(() => {
    const timer = setInterval(() => setSegundos(segundosHasta(fin, Date.now())), 1000);
    return () => clearInterval(timer);
  }, [fin]);

  return segundos;
}

const dato = (etiqueta, valor) => (
  <div style={{ background: 'rgba(255,255,255,0.03)', padding: '0.75rem', borderRadius: '12px', border: '1px solid var(--border)' }}>
    <p style={{ color: 'var(--muted)', fontSize: '0.65rem', marginBottom: '2px', textTransform: 'uppercase' }}>{etiqueta}</p>
    <strong style={{ fontSize: '0.85rem' }}>{valor || 'N/A'}</strong>
  </div>
);

/** Lo que ve el contacto de confianza de un guardián activo: viaje, contador y chat. */
export default function DetalleGuardianContacto({ alerta, onEnviarMensaje }) {
  const segundos = useSegundosRestantes(alerta.inicio, alerta.tiempo);
  const enAlerta = alerta.estado?.toUpperCase() === 'ALERTA' || segundos <= 0;
  const porVencer = !enAlerta && segundos <= PRE_ALERTA_SEG;
  const color = enAlerta ? 'var(--red)' : porVencer ? '#facc15' : '#4ade80';

  return (
    <div className="route-card" style={{ display: 'block', border: enAlerta ? '1px solid var(--red)' : '1px solid var(--border)', background: enAlerta ? 'rgba(229,34,34,0.05)' : 'var(--card)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', gap: '8px' }}>
        <strong style={{ color: enAlerta ? 'var(--red)' : '#fff' }}>{enAlerta ? '⚠️ ALERTA: ' : '✅ EN RUTA: '}{alerta.pasajero}</strong>
        <span style={{ color, fontSize: '0.7rem', fontWeight: 'bold' }}>
          {enAlerta ? 'NO CONFIRMÓ SU LLEGADA' : porVencer ? 'POR EXPIRAR' : 'EN CAMINO'}
        </span>
      </div>

      <p style={{ fontSize: '0.95rem', marginBottom: '0.75rem' }}>{alerta.origen} → {alerta.destino}</p>

      <div style={{ textAlign: 'center', marginBottom: '0.75rem' }}>
        <p style={{ color: 'var(--muted)', fontSize: '0.7rem' }}>Tiempo restante para que confirme su llegada</p>
        <div style={{ fontFamily: 'Syne', fontSize: '2.2rem', fontWeight: 800, color, letterSpacing: '3px' }}>{formatTiempo(segundos)}</div>
        <p style={{ color: 'var(--muted)', fontSize: '0.7rem' }}>Inició: {alerta.inicio} · Tiempo estimado: {alerta.tiempo} min</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '1rem' }}>
        {dato('Conductor', alerta.conductor)}
        {dato('Placa', alerta.placa)}
        {dato('Vehículo', alerta.carro)}
        {dato('Salida programada', alerta.salida)}
      </div>

      {alerta.protegidoId ? (
        <button className="btn-red" onClick={() => onEnviarMensaje(alerta)} style={{ width: '100%', justifyContent: 'center' }}>
          💬 Enviar mensaje a {alerta.pasajero}
        </button>
      ) : (
        <p style={{ color: 'var(--muted)', fontSize: '0.75rem', textAlign: 'center' }}>Este guardián se activó antes de que existiera el chat.</p>
      )}
    </div>
  );
}
