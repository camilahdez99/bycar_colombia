'use client';

import React, { useState, useEffect, useRef } from 'react';
import { nombreDeOpcion, normalizar } from '@/lib/client/formato';

/** Input con sugerencias de municipios del dashboard (`opciones` es [{ id, nombre }] o strings). */
export default function Autocomplete({ placeholder, value, onChange, opciones = [] }) {
  const [show, setShow] = useState(false);
  const wrapperRef = useRef(null);

  // Derivar opciones filtradas dinámicamente (opciones es [{id, nombre}])
  const valNorm = normalizar(value || "");
  const filtered = valNorm.length > 0 
    ? opciones.filter(m => normalizar(nombreDeOpcion(m)).includes(valNorm))
    : [];

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setShow(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleChange = (e) => {
    const val = normalizar(e.target.value);
    onChange(val);
    if (val.trim().length > 0) {
      setShow(true);
    } else {
      setShow(false);
    }
  };

  const handleSelect = (m) => {
    onChange(m);
    setShow(false);
  };

  return (
    <div ref={wrapperRef} style={{ position: 'relative', width: '100%' }}>
      <input 
        type="text" 
        placeholder={placeholder} 
        className="search-input" 
        value={value} 
        onChange={handleChange} 
        onFocus={() => { if(value) setShow(true) }}
        onBlur={() => { setTimeout(() => setShow(false), 200); }}
        required
      />
      {show && filtered.length > 0 && (
        <ul style={{ 
          position: 'absolute', top: 'calc(100% + 8px)', left: 0, right: 0, 
          background: '#1a1a1a', border: '1px solid var(--border)', 
          borderRadius: '14px', zIndex: 100, listStyle: 'none', 
          padding: '8px', margin: 0, maxHeight: '200px', 
          overflowY: 'auto', boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
          backdropFilter: 'blur(10px)'
        }}>
          {filtered.map(m => (
            <li 
              key={m.id || m} 
              onMouseDown={() => handleSelect(nombreDeOpcion(m))} 
              style={{ 
                padding: '10px 14px', cursor: 'pointer', borderRadius: '8px',
                fontSize: '0.85rem', color: 'rgba(255,255,255,0.8)',
                transition: 'all 0.2s'
              }} 
              onMouseEnter={(e) => {
                e.target.style.background = 'rgba(229,34,34,0.1)';
                e.target.style.color = 'var(--red)';
              }} 
              onMouseLeave={(e) => {
                e.target.style.background = 'transparent';
                e.target.style.color = 'rgba(255,255,255,0.8)';
              }}
            >
              {nombreDeOpcion(m)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
