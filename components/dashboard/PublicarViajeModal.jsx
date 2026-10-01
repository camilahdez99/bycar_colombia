'use client';

import React from 'react';
import Autocomplete from '@/components/dashboard/Autocomplete';

/** Formulario para publicar un viaje. El estado del formulario vive en la página. */
export default function PublicarViajeModal({ nuevaRuta, setNuevaRuta, municipios, marcas, onInputChange, onSubmit, onCerrar }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
      <div style={{ background: 'var(--surface)', width: '100%', maxWidth: '550px', borderRadius: '24px', border: '1px solid var(--border)', padding: '2.5rem', position: 'relative' }}>
        <button onClick={onCerrar} style={{ position: 'absolute', top: '20px', right: '20px', background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '1.2rem' }}>✕</button>
        <h2 style={{ fontFamily: 'Syne', fontSize: '1.6rem', fontWeight: 800, marginBottom: '1.5rem', color: 'var(--red)' }}>Publicar nuevo viaje</h2>
        <form onSubmit={onSubmit} style={{ display: 'grid', gap: '1rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <Autocomplete placeholder="Origen" value={nuevaRuta.origen} opciones={municipios} onChange={(val) => setNuevaRuta({...nuevaRuta, origen: val.toUpperCase()})} />
            <Autocomplete placeholder="Destino" value={nuevaRuta.destino} opciones={municipios} onChange={(val) => setNuevaRuta({...nuevaRuta, destino: val.toUpperCase()})} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <select
              name="marca"
              className="search-input"
              value={nuevaRuta.marca}
              onChange={(e) => setNuevaRuta({...nuevaRuta, marca: e.target.value, carro: e.target.value})}
              required
              style={{ cursor: 'pointer' }}
            >
              <option value="">Marca del vehículo</option>
              {marcas.map(m => (
                <option key={m.id || m.ID_MAR} value={m.nombre || m.NOMBRE_MAR}>
                  {m.nombre || m.NOMBRE_MAR}
                </option>
              ))}
            </select>
            <input name="placa" className="search-input" placeholder="Placa (Ej: XYZ123)" value={nuevaRuta.placa} onChange={onInputChange} required />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <input type="date" name="fecha" className="search-input" onChange={onInputChange} required />
            <input type="number" name="puestos" className="search-input" placeholder="Puestos" onChange={onInputChange} required />
          </div>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', fontSize: '0.85rem' }}>$</span>
            <input name="valor" className="search-input" placeholder="Valor por persona" value={nuevaRuta.valor} onChange={onInputChange} required style={{ paddingLeft: '25px' }} />
          </div>
          <textarea name="comentarios" className="search-input" placeholder="Comentarios extras (Ej: NO MASCOTAS, MALETA PEQUEÑA...)" value={nuevaRuta.comentarios} onChange={onInputChange} style={{ minHeight: '80px', fontFamily: 'inherit' }} />
          <button type="submit" className="btn-red" style={{ width: '100%', justifyContent: 'center', marginTop: '1rem', padding: '1rem' }}>Publicar Viaje</button>
        </form>
      </div>
    </div>
  );
}
