'use client';

import React from 'react';
import Autocomplete from '@/components/dashboard/Autocomplete';

/** Pestaña "Inicio": saludo, acceso a publicar un viaje y buscador por origen y destino. */
export default function InicioTab({
  nombreUsuario, puedeCrear, puedeBuscar, searchParams, setSearchParams, municipios, onCrear, onBuscar,
}) {
  return (
    <section>
      <div className="page-header">
        <div><h1 style={{ fontFamily: 'Syne', fontWeight: 800 }}>¡Hola, {nombreUsuario}! 👋</h1><p style={{ color: 'var(--muted)' }}>Tu movilidad en Colombia simplificada</p></div>
      </div>

      
      <div className="grid-2" style={{ 
        display: 'grid', 
        gridTemplateColumns: '1fr 1fr', 
        gap: '2rem', 
        alignItems: 'stretch' 
      }}>
        {/* CREAR RUTA */}
        <div style={{ background: 'var(--surface)', padding: '2.5rem', borderRadius: '32px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: '1rem' }}>
          <div style={{ width: '64px', height: '64px', background: 'rgba(229,34,34,0.1)', borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--red)', marginBottom: '0.5rem' }}>
            <svg width="32" height="32" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>
          </div>
          <h3 style={{ fontFamily: 'Syne', fontSize: '1.4rem', fontWeight: 800 }}>¿Vas a conducir?</h3>
          <p style={{ color: 'var(--muted)', fontSize: '0.95rem', lineHeight: '1.6', maxWidth: '280px' }}>
            Publica tu viaje, ahorra en combustible y ayuda a otros a llegar a su destino.
          </p>
          <button 
            className="btn-red" 
            style={{ width: '100%', maxWidth: '240px', justifyContent: 'center', padding: '1rem', marginTop: '0.5rem' }} 
            onClick={onCrear}
            disabled={!puedeCrear}
          >
            Crear nueva ruta
          </button>
        </div>

        {/* BUSCAR RUTA */}
        <div style={{ background: 'var(--surface)', padding: '2.5rem', borderRadius: '32px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '0.2rem' }}>
            <div style={{ width: '40px', height: '40px', background: 'rgba(255,255,255,0.05)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--red)' }}>
              <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
            </div>
            <h3 style={{ fontFamily: 'Syne', fontSize: '1.4rem', fontWeight: 800 }}>¿Buscas un viaje?</h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <Autocomplete placeholder="Origen" value={searchParams.origen} opciones={municipios} onChange={(val) => setSearchParams({...searchParams, origen: val.toUpperCase()})} />
            <Autocomplete placeholder="Destino" value={searchParams.destino} opciones={municipios} onChange={(val) => setSearchParams({...searchParams, destino: val.toUpperCase()})} />
            <button 
              className="btn-red" 
              style={{ width: '100%', justifyContent: 'center', padding: '1rem', marginTop: '0.5rem' }} 
              onClick={onBuscar}
              disabled={!puedeBuscar}
            >
              Buscar rutas disponibles
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
