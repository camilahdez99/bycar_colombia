"use client";
import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';

/**
 * PermisosManager
 * UI para asignar y revocar menús a usuarios mediante la tabla PERMISOS.
 */
export default function PermisosManager() {
  const [usuarioIdInput, setUsuarioIdInput] = useState('');
  const [selectedUsuario, setSelectedUsuario] = useState(null);
  const [menus, setMenus] = useState([]);
  const [asignados, setAsignados] = useState([]); // array de menuId
  const [loading, setLoading] = useState(false);

  // Cargar menús al montar
  useEffect(() => {
    fetch('/api/menus')
      .then(r => r.ok ? r.json() : [])
      .then(data => setMenus(data))
      .catch(() => toast.error('Error al cargar menús'));
  }, []);

  // Buscar permisos cuando se establece el usuario seleccionado
  useEffect(() => {
    if (!selectedUsuario) return;
    setLoading(true);
    fetch(`/api/admin/permisos?usuarioId=${selectedUsuario}`)
      .then(r => r.ok ? r.json() : [])
      .then(data => setAsignados(data.map(p => p.menuId)))
      .catch(() => toast.error('Error al cargar permisos del usuario'))
      .finally(() => setLoading(false));
  }, [selectedUsuario]);

  const handleBuscar = (e) => {
    e.preventDefault();
    if (!usuarioIdInput.trim()) return;
    setAsignados([]);
    setSelectedUsuario(usuarioIdInput.trim());
  };

  const toggleMenu = async (menuId) => {
    if (!selectedUsuario) return;
    const yaAsignado = asignados.includes(menuId);
    try {
      if (yaAsignado) {
        const res = await fetch(`/api/admin/permisos?usuarioId=${selectedUsuario}&menuId=${menuId}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Error al revocar permiso');
        setAsignados(prev => prev.filter(id => id !== menuId));
        toast.success('Permiso revocado');
      } else {
        const res = await fetch('/api/admin/permisos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ usuarioId: selectedUsuario, menuId }),
        });
        if (!res.ok) throw new Error('Error al asignar permiso');
        setAsignados(prev => [...prev, menuId]);
        toast.success('Permiso asignado');
      }
    } catch (e) {
      toast.error(e.message || 'Error de red');
    }
  };

  const menusPrincipales = menus.filter(m => !m.parentId && m.id !== 1);
  const subMenusInicio = menus.filter(m => m.parentId === 1);

  return (
    <div style={{ background: '#111', borderRadius: '16px', padding: '2rem', boxShadow: '0 4px 24px rgba(0,0,0,0.4)' }}>
      <h2 style={{ color: '#fff', fontSize: '1.3rem', fontWeight: 800, marginBottom: '1.5rem', fontFamily: 'Syne, sans-serif' }}>
        GESTIÓN DE PERMISOS POR USUARIO
      </h2>

      {/* Buscador */}
      <form onSubmit={handleBuscar} style={{ display: 'flex', gap: '12px', marginBottom: '1.5rem' }}>
        <input
          type="number"
          placeholder="Ingrese el ID del Usuario..."
          value={usuarioIdInput}
          onChange={(e) => setUsuarioIdInput(e.target.value)}
          required
          style={{
            flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '12px', padding: '10px 16px', color: '#fff', fontSize: '0.9rem', outline: 'none'
          }}
        />
        <button
          type="submit"
          style={{
            background: '#E52222', color: '#fff', border: 'none', borderRadius: '12px',
            padding: '10px 20px', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap'
          }}
        >
          Buscar
        </button>
      </form>

      {selectedUsuario && (
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
          Editando permisos para el usuario ID: <strong style={{ color: '#fff' }}>{selectedUsuario}</strong>
        </p>
      )}

      {loading && <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem' }}>Cargando permisos...</p>}

      {selectedUsuario && !loading && (
        <div>
          {/* Menús principales */}
          <h3 style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem', letterSpacing: '0.1em', marginBottom: '1rem' }}>
            MENÚS PRINCIPALES
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '2rem' }}>
            {menusPrincipales.map((m) => (
              <label
                key={m.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)',
                  borderRadius: '10px', padding: '12px', cursor: 'pointer',
                  transition: 'background 0.2s'
                }}
              >
                <input
                  type="checkbox"
                  checked={asignados.includes(m.id)}
                  onChange={() => toggleMenu(m.id)}
                  style={{ accentColor: '#E52222', width: '18px', height: '18px' }}
                />
                <span style={{ color: '#fff', fontSize: '0.9rem' }}>{m.label}</span>
              </label>
            ))}
          </div>

          {/* Sub-menús de Inicio */}
          {subMenusInicio.length > 0 && (
            <>
              <h3 style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem', letterSpacing: '0.1em', marginBottom: '1rem', borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: '1.5rem' }}>
                ACCIONES DE INICIO
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                {subMenusInicio.map((m) => (
                  <label
                    key={m.id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '12px',
                      background: 'rgba(229,34,34,0.06)', border: '1px solid rgba(229,34,34,0.15)',
                      borderRadius: '10px', padding: '12px', cursor: 'pointer',
                      transition: 'background 0.2s'
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={asignados.includes(m.id)}
                      onChange={() => toggleMenu(m.id)}
                      style={{ accentColor: '#E52222', width: '18px', height: '18px' }}
                    />
                    <span style={{ color: '#fff', fontSize: '0.9rem' }}>{m.label}</span>
                  </label>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
