"use client";
import React, { useState, useEffect } from 'react';

export default function FormularioVehiculo({ vehiculoInicial, onGuardar, onCerrar, cargando }) {
  const [conductores, setConductores] = useState([]);
  const [form, setForm] = useState({
    placa: vehiculoInicial?.placa || '',
    marca: vehiculoInicial?.marca || '',
    modelo: vehiculoInicial?.modelo || '',
    color: vehiculoInicial?.color || '',
    capacidad: vehiculoInicial?.capacidad || 5,
    idConductor: vehiculoInicial?.idConductor || '',
  });

  useEffect(() => {
    fetch('/api/admin/conductores')
      .then(r => r.json())
      .then(data => setConductores(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = (e) => {
    e.preventDefault();
    onGuardar(form);
  };

  const inputClass = "w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-[#E52222] transition-colors";
  const labelClass = "block text-xs text-white/50 mb-1 font-medium";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Placa</label>
          <input name="placa" value={form.placa} onChange={handleChange} required maxLength={6} disabled={!!vehiculoInicial} className={inputClass} placeholder="ABC123" />
        </div>
        <div>
          <label className={labelClass}>Marca</label>
          <input name="marca" value={form.marca} onChange={handleChange} required className={inputClass} placeholder="Ej: MAZDA" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Modelo</label>
          <input name="modelo" value={form.modelo} onChange={handleChange} className={inputClass} placeholder="Ej: CX-5 2024" />
        </div>
        <div>
          <label className={labelClass}>Color</label>
          <input name="color" value={form.color} onChange={handleChange} required className={inputClass} placeholder="Ej: ROJO" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Capacidad</label>
          <input name="capacidad" type="number" min="1" max="50" value={form.capacidad} onChange={handleChange} required className={inputClass} />
        </div>
        {!vehiculoInicial && (
          <div>
            <label className={labelClass}>Conductor</label>
            <select name="idConductor" value={form.idConductor} onChange={handleChange} required className={inputClass}>
              <option value="">-- Seleccione --</option>
              {conductores.map(c => (
                <option key={c.id} value={c.id}>{c.nombre} {c.apellido}</option>
              ))}
            </select>
          </div>
        )}
      </div>
      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onCerrar} className="flex-1 py-2.5 rounded-lg border border-white/10 text-white/60 hover:bg-white/5 text-sm transition-colors">Cancelar</button>
        <button type="submit" disabled={cargando} className="flex-1 py-2.5 rounded-lg bg-[#E52222] hover:bg-[#c71c1c] text-white text-sm font-semibold transition-colors disabled:opacity-50">
          {cargando ? 'Guardando...' : (vehiculoInicial ? 'Actualizar' : 'Registrar Vehículo')}
        </button>
      </div>
    </form>
  );
}
