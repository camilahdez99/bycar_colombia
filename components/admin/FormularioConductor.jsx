"use client";
import React, { useState, useEffect } from 'react';

export default function FormularioConductor({ onGuardar, onCerrar, cargando }) {
  const [usuarios, setUsuarios] = useState([]);
  const [idUsuario, setIdUsuario] = useState('');

  useEffect(() => {
    fetch('/api/admin/usuarios')
      .then(r => r.json())
      .then(data => setUsuarios(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    onGuardar({ idUsuario: parseInt(idUsuario) });
  };

  const inputClass = "w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-[#E52222] transition-colors";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs text-white/50 mb-1 font-medium">Seleccionar Usuario</label>
        <select name="idUsuario" value={idUsuario} onChange={(e) => setIdUsuario(e.target.value)} required className={inputClass}>
          <option value="">-- Seleccione un usuario --</option>
          {usuarios.map(u => (
            <option key={u.id} value={u.id}>{u.nombre} {u.apellido} ({u.correo})</option>
          ))}
        </select>
      </div>
      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onCerrar} className="flex-1 py-2.5 rounded-lg border border-white/10 text-white/60 hover:bg-white/5 text-sm transition-colors">Cancelar</button>
        <button type="submit" disabled={cargando} className="flex-1 py-2.5 rounded-lg bg-[#E52222] hover:bg-[#c71c1c] text-white text-sm font-semibold transition-colors disabled:opacity-50">
          {cargando ? 'Guardando...' : 'Registrar Conductor'}
        </button>
      </div>
    </form>
  );
}
