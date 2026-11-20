'use client';

import React from 'react';
import SelectorUsuario from '@/components/dashboard/SelectorUsuario';
import Autocomplete from '@/components/dashboard/Autocomplete';
import { ESTADO_XPRESS } from '@/lib/domain/constantes';

const VISTAS = [
  { id: 'enviados', etiqueta: 'Mis envíos', vacio: 'Todavía no has enviado ninguna encomienda.' },
  { id: 'recibidos', etiqueta: 'Por recibir', vacio: 'No tienes encomienda por recibir.' },
  { id: 'conductor', etiqueta: 'En mis viajes', vacio: 'Nadie ha enviado encomiendas en tus viajes.' },
];

const COLOR_ESTADO = {
  [ESTADO_XPRESS.PENDIENTE]: '#facc15',
  [ESTADO_XPRESS.ACEPTADA]: '#4ade80',
  [ESTADO_XPRESS.RECHAZADA]: '#f87171',
  [ESTADO_XPRESS.EN_CAMINO]: '#60a5fa',
  [ESTADO_XPRESS.ENTREGADA]: '#4ade80',
  [ESTADO_XPRESS.CANCELADA]: '#9ca3af',
};

const estiloBoton = { background: 'rgba(255,255,255,0.1)', color: '#fff', border: 'none', padding: '8px 15px', borderRadius: '8px', cursor: 'pointer' };
const estiloBotonVerde = { background: '#4ade80', color: '#000', border: 'none', padding: '8px 15px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' };

/** Acciones que el rol de la vista puede hacer sobre la carga, según su estado. */
function Acciones({ vista, carga, onEditar, onCancelar, onEstado }) {
  const estado = Number(carga.estadoId);
  if (vista === 'enviados') {
    return (
      <>
        {estado === ESTADO_XPRESS.PENDIENTE && <button style={estiloBoton} onClick={() => onEditar(carga)}>Editar</button>}
        {(estado === ESTADO_XPRESS.PENDIENTE || estado === ESTADO_XPRESS.ACEPTADA) && (
          <button style={estiloBoton} onClick={() => onCancelar(carga)}>Cancelar envío</button>
        )}
      </>
    );
  }
  if (vista === 'conductor') {
    return (
      <>
        {estado === ESTADO_XPRESS.PENDIENTE && (
          <>
            <button style={estiloBotonVerde} onClick={() => onEstado(carga, ESTADO_XPRESS.ACEPTADA)}>Aceptar</button>
            <button style={estiloBoton} onClick={() => onEstado(carga, ESTADO_XPRESS.RECHAZADA)}>Rechazar</button>
          </>
        )}
        {estado === ESTADO_XPRESS.ACEPTADA && (
          <button style={estiloBotonVerde} onClick={() => onEstado(carga, ESTADO_XPRESS.EN_CAMINO)}>Marcar en camino</button>
        )}
        {estado === ESTADO_XPRESS.EN_CAMINO && (
          <button style={estiloBotonVerde} onClick={() => onEstado(carga, ESTADO_XPRESS.ENTREGADA)}>Marcar entregada</button>
        )}
      </>
    );
  }
  return null; // El receptor solo ve
}

function FormularioCarga({ form, setForm, viajes, municipios, buscando, editando, guardando, onBuscarViajes, onCambiarRuta, onGuardar, onCerrar }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
      <div style={{ background: 'var(--surface)', width: '100%', maxWidth: '520px', borderRadius: '24px', border: '1px solid var(--border)', padding: '2.5rem', position: 'relative' }}>
        <button onClick={onCerrar} aria-label="Cerrar" style={{ position: 'absolute', top: '20px', right: '20px', background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '1.2rem' }}>✕</button>
        <h2 style={{ fontFamily: 'Syne', fontSize: '1.5rem', fontWeight: 800, marginBottom: '1.5rem', color: 'var(--red)' }}>
          {editando ? 'Editar encomienda' : 'Nueva encomienda'}
        </h2>
        <form onSubmit={(e) => { e.preventDefault(); onGuardar(); }} style={{ display: 'grid', gap: '1rem' }}>
          {!editando && (
            <>
              <Autocomplete placeholder="Origen" value={form.origen} opciones={municipios} onChange={(val) => onCambiarRuta('origen', val.toUpperCase())} />
              <Autocomplete placeholder="Destino" value={form.destino} opciones={municipios} onChange={(val) => onCambiarRuta('destino', val.toUpperCase())} />
              <button type="button" className="btn-red" disabled={buscando} onClick={onBuscarViajes} style={{ justifyContent: 'center' }}>
                {buscando ? 'Buscando...' : 'Buscar viajes'}
              </button>
              {viajes && viajes.length === 0 && (
                <p role="alert" style={{ color: 'var(--muted)' }}>No hay viajes para esa ruta; no se puede crear la encomienda.</p>
              )}
              {viajes && viajes.length > 0 && (
                <div role="radiogroup" aria-label="Viaje" style={{ display: 'grid', gap: '8px', maxHeight: '200px', overflowY: 'auto' }}>
                  {viajes.map((v) => {
                    const elegido = String(form.viajeId) === String(v.id);
                    return (
                      <button
                        key={v.id}
                        type="button"
                        role="radio"
                        aria-checked={elegido}
                        onClick={() => setForm({ ...form, viajeId: String(v.id) })}
                        style={{ ...estiloBoton, textAlign: 'left', border: `1px solid ${elegido ? 'var(--red)' : 'transparent'}` }}
                      >
                        {v.origen} → {v.destino} · {v.hora} · {v.conductor}
                      </button>
                    );
                  })}
                </div>
              )}
              <SelectorUsuario
                placeholder="Receptor: busca por nombre o correo"
                elegido={form.receptor}
                onSeleccionar={(_correo, usuario) => setForm({ ...form, receptor: usuario })}
              />
            </>
          )}
          <textarea
            className="search-input"
            aria-label="Descripción"
            placeholder="¿Qué vas a enviar?"
            maxLength={300}
            rows={3}
            value={form.descripcion}
            onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
            style={{ textTransform: 'none', resize: 'vertical' }}
          />
          <input
            type="number"
            className="search-input"
            aria-label="Peso en kg"
            placeholder="Peso aproximado en kg (opcional)"
            min="0"
            step="any"
            value={form.peso}
            onChange={(e) => setForm({ ...form, peso: e.target.value })}
          />
          <button type="submit" className="btn-red" disabled={guardando || (!editando && !form.viajeId)} style={{ justifyContent: 'center' }}>
            {editando ? 'Guardar cambios' : 'Registrar encomienda'}
          </button>
        </form>
      </div>
    </div>
  );
}

/**
 * Pestaña "Xpress": encomiendas enviadas, por recibir y de los viajes que el usuario conduce, con el
 * formulario para registrar o editar. Es de presentación: el estado y las acciones vienen de useXpress.
 */
export default function XpressTab({
  vista, onVista, cargas, form, setForm, viajes, municipios, buscando, formAbierto, editandoId, guardando,
  onBuscarViajes, onCambiarRuta, onNueva, onEditar, onCancelar, onEstado, onGuardar, onCerrarForm,
}) {
  const actual = VISTAS.find((v) => v.id === vista) ?? VISTAS[0];
  const lista = cargas[actual.id] ?? [];

  return (
    <section>
      <div className="page-header">
        <div>
          <h1 style={{ fontFamily: 'Syne', fontWeight: 800 }}>📦 Xpress</h1>
          <p style={{ color: 'var(--muted)' }}>Envía encomiendas con quienes ya viajan a tu destino, y gestiona las de tus viajes</p>
        </div>
        <button className="btn-red" onClick={onNueva}>+ Nueva encomienda</button>
      </div>

      <div style={{ display: 'flex', gap: '8px', margin: '1.5rem 0', flexWrap: 'wrap' }}>
        {VISTAS.map((v) => (
          <button
            key={v.id}
            onClick={() => onVista(v.id)}
            aria-pressed={v.id === actual.id}
            style={{ ...estiloBoton, background: v.id === actual.id ? 'var(--red)' : 'rgba(255,255,255,0.1)', fontWeight: v.id === actual.id ? 'bold' : 'normal' }}
          >
            {v.etiqueta} ({(cargas[v.id] ?? []).length})
          </button>
        ))}
      </div>

      {lista.length === 0 && <p style={{ color: 'var(--muted)' }}>{actual.vacio}</p>}

      {lista.map((c) => (
        <div key={c.id} className="route-card">
          <div>
            <strong>{c.descripcion}</strong>
            <p style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
              {c.origen} → {c.destino} • sale {c.salida}{c.peso ? ` • ${Number(c.peso)} kg` : ''}
            </p>
            <p style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
              De {c.emisor} para {c.receptor} • Conductor: {c.conductor}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <span className="badge-status" style={{ color: COLOR_ESTADO[c.estadoId], border: `1px solid ${COLOR_ESTADO[c.estadoId]}` }}>
              {c.estado}
            </span>
            <Acciones vista={actual.id} carga={c} onEditar={onEditar} onCancelar={onCancelar} onEstado={onEstado} />
          </div>
        </div>
      ))}

      {formAbierto && (
        <FormularioCarga
          form={form}
          setForm={setForm}
          viajes={viajes}
          municipios={municipios}
          buscando={buscando}
          onBuscarViajes={onBuscarViajes}
          onCambiarRuta={onCambiarRuta}
          editando={Boolean(editandoId)}
          guardando={guardando}
          onGuardar={onGuardar}
          onCerrar={onCerrarForm}
        />
      )}
    </section>
  );
}
