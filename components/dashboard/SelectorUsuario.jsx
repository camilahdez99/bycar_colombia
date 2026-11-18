'use client';

import React, { useState, useEffect, useRef } from 'react';
import { fetchConSesion } from '@/lib/client/sessionFetch';

const MIN_BUSQUEDA = 3;
const DEBOUNCE_MS = 300;

/**
 * Busca un usuario de Bycar (por nombre o correo) con `/api/usuarios/buscar` y lo elige como
 * contacto de confianza. Avisa el correo elegido por `onSeleccionar(correo, usuario)`.
 * Es de presentación: no guarda nada, solo busca y elige.
 */
export default function SelectorUsuario({ onSeleccionar, elegido, placeholder = 'Busca por nombre o correo' }) {
  const [texto, setTexto] = useState('');
  const [opciones, setOpciones] = useState([]);
  const [buscando, setBuscando] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) setOpciones([]);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Busca con un pequeño retraso para no pedir en cada tecla. El estado se toca dentro del
  // timeout (no en el cuerpo del efecto) para no disparar renders en cascada.
  useEffect(() => {
    const q = texto.trim();
    let cancelado = false;
    const id = setTimeout(() => {
      if (cancelado) return;
      if (q.length < MIN_BUSQUEDA) {
        setOpciones([]);
        setBuscando(false);
        return;
      }
      setBuscando(true);
      fetchConSesion(`/api/usuarios/buscar?q=${encodeURIComponent(q)}`)
        .then((res) => (res.ok ? res.json() : []))
        .then((data) => { if (!cancelado) setOpciones(Array.isArray(data) ? data : []); })
        .catch(() => { if (!cancelado) setOpciones([]); })
        .finally(() => { if (!cancelado) setBuscando(false); });
    }, DEBOUNCE_MS);
    return () => { cancelado = true; clearTimeout(id); };
  }, [texto]);

  const elegir = (usuario) => {
    onSeleccionar(usuario.correo, usuario);
    setTexto('');
    setOpciones([]);
  };

  return (
    <div ref={wrapperRef} style={{ position: 'relative', width: '100%' }}>
      {elegido ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.3)', borderRadius: '12px', padding: '10px 14px' }}>
          <span style={{ fontSize: '0.85rem' }}>🛡️ {elegido.nombre || elegido.correo} <span style={{ color: 'var(--muted)' }}>({elegido.correo})</span></span>
          <button type="button" onClick={() => onSeleccionar('', null)} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '1rem' }} aria-label="Quitar contacto">✕</button>
        </div>
      ) : (
        <>
          <input
            type="text"
            className="search-input"
            placeholder={placeholder}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            style={{ padding: '12px 16px', textTransform: 'none' }}
          />
          {texto.trim().length >= MIN_BUSQUEDA && (
            <ul style={{ position: 'absolute', top: 'calc(100% + 8px)', left: 0, right: 0, background: '#1a1a1a', border: '1px solid var(--border)', borderRadius: '14px', zIndex: 100, listStyle: 'none', padding: '8px', margin: 0, maxHeight: '220px', overflowY: 'auto', boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }}>
              {buscando && opciones.length === 0 && <li style={{ padding: '10px 14px', color: 'var(--muted)', fontSize: '0.8rem' }}>Buscando…</li>}
              {!buscando && opciones.length === 0 && <li style={{ padding: '10px 14px', color: 'var(--muted)', fontSize: '0.8rem' }}>Sin resultados. Debe ser un usuario registrado en Bycar.</li>}
              {opciones.map((u) => (
                <li
                  key={u.id}
                  onMouseDown={() => elegir(u)}
                  style={{ padding: '10px 14px', cursor: 'pointer', borderRadius: '8px', fontSize: '0.85rem', color: 'rgba(255,255,255,0.85)' }}
                >
                  {u.nombre} <span style={{ color: 'var(--muted)' }}>· {u.correo}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
