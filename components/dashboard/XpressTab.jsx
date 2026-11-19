'use client';

import React from 'react';
import SelectorUsuario from '@/components/dashboard/SelectorUsuario';
import Autocomplete from '@/components/dashboard/Autocomplete';
import { ESTADO_XPRESS } from '@/lib/domain/constantes';

const VISTAS = [
  { id: 'enviados', etiqueta: 'Mis envíos', vacio: 'Todavía no has enviado ninguna encomienda.' },
  { id: 'recibidos', etiqueta: 'Por recibir', vacio: 'No tienes encomienda por recibir.' },
  { id: 'conductor', etiqueta: 'En mis viajes', vacio: 'Nadie ha enviado encomiendas en tus viajes.' },
  { id: 'disponibles', etiqueta: 'Encomiendas disponibles', vacio: 'No hay encomiendas buscando conductor por ahora.' },
];

const MODOS = [
  { id: 'viaje', etiqueta: 'En un viaje existente' },
  { id: 'ruta', etiqueta: 'Proponer una ruta nueva' },
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
function Acciones({ vista, carga, onEditar, onCancelar, onEstado, onAceptar }) {
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
  if (vista === 'disponibles') {
    return <button style={estiloBotonVerde} onClick={() => onAceptar(carga)}>Aceptar encomienda</button>;
  }
  return null; // El receptor solo ve
}

function FormularioCarga({ form, setForm, viajes, municipios, editando, guardando, onGuardar, onCerrar }) {
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
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {MODOS.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    aria-pressed={form.modo === m.id}
                    onClick={() => setForm({ ...form, modo: m.id })}
                    style={{ ...estiloBoton, background: form.modo === m.id ? 'var(--red)' : 'rgba(255,255,255,0.1)', fontWeight: form.modo === m.id ? 'bold' : 'normal' }}
                  >
                    {m.etiqueta}
                  </button>
                ))}
              </div>
              {form.modo === 'viaje' ? (
                <select
                  className="search-input"
                  aria-label="Viaje"
                  value={form.viajeId}
                  onChange={(e) => setForm({ ...form, viajeId: e.target.value })}
                  style={{ cursor: 'pointer' }}
                >
                  <option value="">Elige el viaje</option>
                  {viajes.map((v) => (
                    <option key={v.id} value={v.id}>{v.origen} → {v.destino} · {v.hora} · {v.conductor}</option>
                  ))}
                </select>
              ) : (
                <>
                  <Autocomplete placeholder="Origen" value={form.origen} opciones={municipios} onChange={(val) => setForm({ ...form, origen: val })} />
                  <Autocomplete placeholder="Destino" value={form.destino} opciones={municipios} onChange={(val) => setForm({ ...form, destino: val })} />
                  <input
                    type="date"
                    className="search-input"
                    aria-label="Fecha de envío"
                    value={form.fechaXp}
                    onChange={(e) => setForm({ ...form, fechaXp: e.target.value })}
                  />
                </>
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
          <button type="submit" className="btn-red" disabled={guardando} style={{ justifyContent: 'center' }}>
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
  vista, onVista, cargas, form, setForm, viajes, municipios = [], formAbierto, editandoId, guardando,
  onNueva, onEditar, onCancelar, onEstado, onAceptar, onGuardar, onCerrarForm,
}) {
  const actual = VISTAS.find((v) => v.id === vista) ?? VISTAS[0];
  const lista = cargas[actual.id] ?? [];

  return (
    <section>
      <div className="page-header">
        <div>
          <h1 style={{ fontFamily: 'Syne', fontWeight: 800 }}>📦 Xpress</h1>
          <p style={{ color: 'var(--muted)' }}>Envía encomiendas en un viaje que ya existe o propón tu propia ruta, y gestiona las de tus viajes</p>
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
              {c.origen} → {c.destino} • {c.viajeId ? `sale ${c.salida}` : `ruta propia${c.fechaXp ? ` • ${c.fechaXp}` : ''}`}{c.peso ? ` • ${Number(c.peso)} kg` : ''}
            </p>
            <p style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
              De {c.emisor} para {c.receptor} • Conductor: {c.conductor || 'buscando conductor'}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <span className="badge-status" style={{ color: COLOR_ESTADO[c.estadoId], border: `1px solid ${COLOR_ESTADO[c.estadoId]}` }}>
              {c.estado}
            </span>
            <Acciones vista={actual.id} carga={c} onEditar={onEditar} onCancelar={onCancelar} onEstado={onEstado} onAceptar={onAceptar} />
          </div>
        </div>
      ))}

      {formAbierto && (
        <FormularioCarga
          form={form}
          setForm={setForm}
          viajes={viajes}
          municipios={municipios}
          editando={Boolean(editandoId)}
          guardando={guardando}
          onGuardar={onGuardar}
          onCerrar={onCerrarForm}
        />
      )}
    </section>
  );
}
