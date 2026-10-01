'use client';

import React from 'react';

/** Pestaña "Buscar": resultados de la búsqueda, con detalle y solicitud de cupo. */
export default function BuscarTab({ resultados, solicitados, onVolver, onVerDetalles, onSolicitar }) {
  return (
    <section>
      <div className="page-header">
        <div><h1>Resultados de búsqueda</h1><p style={{ color: 'var(--muted)' }}>Viajes disponibles para tu ruta</p></div>
        <button className="btn-red" onClick={onVolver}>Volver</button>
      </div>
      <div className="resultados-lista">
        {resultados.length > 0 ? resultados.map(viaje => (
          <div className="route-card" key={viaje.id}>
            <div>
              <strong>{viaje.origen} → {viaje.destino}</strong>
              <p style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>Conductor: {viaje.conductor} • {viaje.hora}</p>
              <button style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', fontSize: '0.8rem', padding: '5px 0', fontWeight: 'bold' }} onClick={() => onVerDetalles(viaje)}>Ver Detalles</button>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ color: 'var(--red)', fontWeight: '800' }}>${viaje.valor}</span><br/>
              <button className="btn-red" style={{ padding: '6px 15px', fontSize: '0.8rem', marginTop: '8px' }} onClick={() => onSolicitar(viaje.id)} disabled={solicitados.includes(viaje.id)}>{solicitados.includes(viaje.id) ? 'Pendiente' : 'Solicitar'}</button>
            </div>
          </div>
        )) : <p style={{ color: 'var(--muted)' }}>No se encontraron viajes con esos criterios.</p>}
      </div>
    </section>
  );
}
