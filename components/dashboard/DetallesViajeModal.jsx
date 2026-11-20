'use client';

import React, { useState } from 'react';
import SelectorUsuario from './SelectorUsuario';
import { TIEMPO_GUARDIAN_POR_DEFECTO_MIN } from '@/lib/domain/constantes';

/**
 * Modal con los datos de un viaje de la búsqueda y el botón para solicitar cupo.
 * Opcionalmente, el pasajero elige de antemano su contacto de confianza (guardián): se guarda
 * en la solicitud y se activa solo cuando el conductor inicia el viaje.
 */
export default function DetallesViajeModal({ viaje, yaSolicitado, contactoInicial, tiempoEstimado, onCerrar, onSolicitar }) {
  // Precargado con el último contacto usado (si hay); se puede quitar con la ✕ y elegir otro (task 3)
  const [contacto, setContacto] = useState(contactoInicial ?? null); // { correo, nombre } o null
  // Tiempo estimado automático por la ruta (editable); si no se pudo estimar, el valor por defecto
  const [tiempo, setTiempo] = useState(tiempoEstimado || TIEMPO_GUARDIAN_POR_DEFECTO_MIN);

  const solicitar = () => {
    const extras = contacto?.correo
      ? { contactoGuardianEmail: contacto.correo, tiempoGuardian: tiempo || undefined }
      : {};
    onSolicitar(extras);
  };
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

        <div style={{ marginTop: '1.25rem', background: 'rgba(229,34,34,0.04)', border: '1px solid rgba(229,34,34,0.12)', borderRadius: '14px', padding: '1rem' }}>
          <span style={{ color: '#fff', fontWeight: 'bold', fontSize: '0.85rem', display: 'block', marginBottom: '4px' }}>🛡️ Contacto de confianza (opcional)</span>
          <p style={{ color: 'var(--muted)', fontSize: '0.75rem', margin: '0 0 10px' }}>Elige un usuario de Bycar; si el conductor inicia el viaje, lo alertaremos cuando no confirmes tu llegada.</p>
          <SelectorUsuario
            elegido={contacto}
            onSeleccionar={(correo, usuario) => setContacto(correo ? { correo, nombre: usuario?.nombre } : null)}
          />
          {contacto && (
            <div style={{ marginTop: '10px' }}>
              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--muted)', marginBottom: '6px' }}>⏱️ Tiempo estimado del viaje (minutos)</label>
              <input className="search-input" type="number" min="5" max="600" value={tiempo} onChange={(e) => setTiempo(parseInt(e.target.value) || 0)} style={{ padding: '10px 14px' }} />
            </div>
          )}
        </div>

        <button className="btn-red" style={{ width: '100%', justifyContent: 'center', marginTop: '1.5rem' }} onClick={solicitar} disabled={yaSolicitado}>
          {yaSolicitado ? 'Solicitud Pendiente' : 'Solicitar Cupo'}
        </button>
      </div>
    </div>
  );
}
