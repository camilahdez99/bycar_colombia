"use client";
import React, { useState, useEffect } from 'react';
import PermisosManager from '@/app/components/admin/PermisosManager';
import DynamicForm from '@/components/DynamicForm';
import HydrationWrapper from '@/components/admin/HydrationWrapper';
import { Plus, Edit2, Trash2, Search, X } from 'lucide-react';
import { toast } from 'react-hot-toast';

/** Modal component used throughout the admin panel */
function Modal({ title, children, onClose }) {
  // Prevent closing when clicking inside the modal content
  const handleContentClick = (e) => {
    e.stopPropagation();
  };

  return (
    <div 
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto"
    >
      <div 
        onClick={handleContentClick}
        className="bg-[#1a1a1a] border border-white/10 rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh] my-auto"
      >
        <div className="flex items-center justify-between p-6 border-b border-white/10 flex-shrink-0">
          <h2 className="text-lg font-bold text-white">{title}</h2>
          <button onClick={onClose} className="text-white/40 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>
        <div className="p-6 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

/** Admin page that dynamically lists every table defined in the schema and provides generic CRUD */
export default function AdminPage() {
  // ==== Global state ==== 
  const [tablesList, setTablesList] = useState([]);
  const [activeTable, setActiveTable] = useState('');
  const [activeSection, setActiveSection] = useState('tablas'); // nuevo: controla sección del admin
  const [columnsInfo, setColumnsInfo] = useState([]);
  const [rowsData, setRowsData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [modalTipo, setModalTipo] = useState('create'); // 'create' | 'edit'
  const [editRow, setEditRow] = useState(null);
  const [guardando, setGuardando] = useState(false);

  // 1️⃣ Load table list on mount
  useEffect(() => {
    const fetchTables = async () => {
      try {
        const res = await fetch('/api/admin/tablas?list=1');
        const data = await res.json();
        setTablesList(data);
        if (data.length) setActiveTable(data[0]);
      } catch (e) {
        toast.error('Error al obtener lista de tablas');
      }
    };
    fetchTables();
  }, []);

  // 2️⃣ Load metadata & rows when active table changes
  useEffect(() => {
    if (!activeTable) return;
    const loadMetaAndData = async () => {
      setLoading(true);
      try {
        const metaRes = await fetch(`/api/admin/tablas?metadata=1&tabla=${activeTable}`);
        const cols = await metaRes.json();
        setColumnsInfo(cols);
        const dataRes = await fetch(`/api/admin/tablas?tabla=${activeTable}`);
        const rows = await dataRes.json();
        setRowsData(Array.isArray(rows) ? rows : []);
      } catch (e) {
        toast.error(`Error al cargar datos de ${activeTable}`);
      } finally {
        setLoading(false);
      }
    };
    loadMetaAndData();
  }, [activeTable]);

  // Helper to refresh rows after any mutation
  const refreshData = async () => {
    const dataRes = await fetch(`/api/admin/tablas?tabla=${activeTable}`);
    const rows = await dataRes.json();
    setRowsData(Array.isArray(rows) ? rows : []);
  };

  // ---------- CRUD ----------
  const handleCreate = async (formData) => {
    setGuardando(true);
    const t = toast.loading('Creando registro...');
    try {
      const r = await fetch(`/api/admin/tablas?tabla=${activeTable}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (r.ok) {
        toast.success('Registro creado', { id: t });
        await refreshData();
        cerrarModal();
      } else {
        const err = await r.json();
        toast.error(err.error || 'Error al crear', { id: t });
      }
    } catch (e) {
      toast.error('Error de red', { id: t });
    } finally {
      setGuardando(false);
    }
  };

  const handleUpdate = async (id, formData) => {
    setGuardando(true);
    const t = toast.loading('Actualizando registro...');
    try {
      const r = await fetch(`/api/admin/tablas?id=${id}&tabla=${activeTable}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (r.ok) {
        toast.success('Registro actualizado', { id: t });
        await refreshData();
        cerrarModal();
      } else {
        const err = await r.json();
        toast.error(err.error || 'Error al actualizar', { id: t });
      }
    } catch (e) {
      toast.error('Error de red', { id: t });
    } finally {
      setGuardando(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar este registro?')) return;
    const t = toast.loading('Eliminando...');
    try {
      const r = await fetch(`/api/admin/tablas?id=${id}&tabla=${activeTable}`, { method: 'DELETE' });
      if (r.ok) {
        toast.success('Eliminado', { id: t });
        await refreshData();
      } else {
        const err = await r.json();
        toast.error(err.error || 'Error al eliminar', { id: t });
      }
    } catch (e) {
      toast.error('Error de red', { id: t });
    }
  };

  // ---------- UI helpers ----------
  const abrirModal = (tipo, row = null) => {
    setModalTipo(tipo);
    setEditRow(row);
    setModalVisible(true);
  };
  const cerrarModal = () => {
    setModalVisible(false);
    setEditRow(null);
    setModalTipo('create');
  };

  const filtroRows = rowsData.filter(row => {
    if (!search) return true;
    return Object.values(row).some(v => String(v).toLowerCase().includes(search.toLowerCase()));
  });

  // ---------- Render helpers ----------
  const renderSidebar = () => (
    <aside className="w-64 bg-[#111] border-r border-white/10 p-6 hidden md:flex flex-col">
        <div className="mb-8 font-extrabold text-xl text-[#E52222]">Bycar ADMIN</div>
        <nav className="space-y-1 flex-1">
          {tablesList.map(tbl => (
            <button
              key={tbl}
              onClick={() => { setActiveTable(tbl); setActiveSection('tablas'); setSearch(''); }}
              className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors text-sm ${activeTable === tbl && activeSection === 'tablas' ? 'bg-[#E52222] text-white' : 'hover:bg-white/5 text-white/50'}`}
            >
              {tbl}
            </button>
          ))}
          {/* Botón de gestión de permisos */}
          <button
            onClick={() => { setActiveSection('permisos'); setSearch(''); }}
            className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors text-sm font-semibold tracking-widest ${activeSection === 'permisos' ? 'bg-[#E52222] text-white' : 'hover:bg-white/5 text-white/50'}`}
          >
            PERMISOS
          </button>
        </nav>
      </aside>
  );

  const renderHeaderActions = () => (
    <div className="flex gap-2">
      <button
        onClick={() => abrirModal('create')}
        className="flex items-center gap-2 bg-[#E52222] hover:bg-[#c71c1c] text-white px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors"
      >
        <Plus size={16} /> Nuevo {activeTable?.slice(0, -1) || ''}
      </button>
    </div>
  );

  const getRowId = (row) => {
    return row.ID_USU || row.ID_PER || row.ID_MUN || row.ID_DEP || row.PLACA_VEH || row.ID_VIA || row.ID_ENU || row.ID_GUA || row.ID_MAR || row.ID_MOD || row.ID_EST_SOL || row.ID_EST_GUA || row.ID_ROL || row.ID_MEN || row[columnsInfo[0]?.COLUMN_NAME];
  };

  const renderTable = () => {
    if (loading) return <div className="p-12 text-center text-white/30 text-sm">Cargando datos...</div>;
    if (!columnsInfo.length) return null;
    return (
      <div className="bg-white/5 border border-white/10 rounded-xl overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-white/5 text-[10px] uppercase text-white/40 tracking-wider">
            <tr>
              {columnsInfo.map(col => (
                <th key={col.COLUMN_NAME} className="p-4">{col.COLUMN_NAME}</th>
              ))}
              <th className="p-4 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtroRows.length === 0 ? (
              <tr>
                <td colSpan={columnsInfo.length + 1} className="p-8 text-center text-white/30 text-sm">No se encontraron registros</td>
              </tr>
            ) : (
              filtroRows.map(row => (
                <tr
                  key={getRowId(row) || Math.random()}
                  className="border-t border-white/5 hover:bg-white/[0.02] transition-colors"
                >
                  {columnsInfo.map(col => (
                    <td key={col.COLUMN_NAME} className="p-4 text-sm text-white/70">{row[col.COLUMN_NAME]}</td>
                  ))}
                  <td className="p-4">
                    <div className="flex justify-end gap-2">
                      <button
                        title="Editar"
                        className="p-2 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-colors"
                        onClick={() => abrirModal('edit', row)}
                      >
                        <Edit2 size={15} />
                      </button>
                      <button
                        title="Eliminar"
                        className="p-2 rounded-lg text-red-500/40 hover:text-red-500 hover:bg-red-500/5 transition-colors"
                        onClick={() => handleDelete(getRowId(row))}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    );
  };

  const renderModalContent = () => {
    if (!activeTable) return null;
    if (modalTipo === 'edit') {
      return (
        <DynamicForm
          table={activeTable}
          columns={columnsInfo}
          initialData={editRow}
          onSubmit={(data) => handleUpdate(getRowId(editRow), data)}
          onCancel={cerrarModal}
          loading={guardando}
        />
      );
    }
    return (
      <DynamicForm
        table={activeTable}
        columns={columnsInfo}
        onSubmit={handleCreate}
        onCancel={cerrarModal}
        loading={guardando}
      />
    );
  };

  return (
    <HydrationWrapper>
      {modalVisible && (
        <Modal title={modalTipo === 'edit' ? 'Editar registro' : 'Nuevo registro'} onClose={cerrarModal}>
          {renderModalContent()}
        </Modal>
      )}
      <div className="flex min-h-screen bg-[#0a0a0a] text-white">
        {renderSidebar()}
        <main className="flex-1 p-8 min-w-0 overflow-x-hidden">
          {/* Render según sección */}
          {activeSection === 'permisos' ? (
            <PermisosManager />
          ) : (
            <>
              <header className="flex justify-between items-center mb-6">
                <div>
                  <h1 className="text-2xl font-bold">{activeTable ? `${activeTable} – Gestión` : 'Admin'}</h1>
                  <p className="text-white/40 text-sm mt-1">{rowsData.length} registro(s)</p>
                </div>
                {activeTable && renderHeaderActions()}
              </header>
              {activeTable && (
                <div className="relative mb-4">
                  <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
                  <input
                    type="text"
                    placeholder="Buscar..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#E52220] transition-colors"
                  />
                </div>
              )}
              {activeTable && renderTable()}
            </>
          )}
        </main>
      </div>
    </HydrationWrapper>
  );
}