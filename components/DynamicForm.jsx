"use client";
import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';

/**
 * DynamicForm renders inputs for any table based on its column metadata.
 * Props:
 *  - tabla: name of the table (string)
 *  - columnaMeta: array of {COLUMN_NAME, DATA_TYPE}
 *  - registroInicial: object with existing values (for edit) or null
 *  - onClose: function to close modal
 *  - onRefresh: function to reload data after successful save
 */
export default function DynamicForm({ table, columns, initialData, onSubmit, onCancel, loading }) {
  const [form, setForm] = useState({});

  useEffect(() => {
    if (initialData) {
      setForm(initialData);
    } else {
      const empty = {};
      if (columns) {
        columns.forEach(col => {
          empty[col.COLUMN_NAME] = '';
        });
      }
      setForm(empty);
    }
  }, [initialData, columns]);

  const handleChange = e => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmitInternal = async e => {
    e.preventDefault();
    if (onSubmit) {
      onSubmit(form);
    }
  };

  // Simple mapping of Oracle data types to HTML input types
  const typeForColumn = dataType => {
    const dt = dataType.toUpperCase();
    if (dt.includes('DATE') || dt.includes('TIMESTAMP')) return 'date';
    if (dt.includes('NUMBER') || dt.includes('INT')) return 'number';
    if (dt.includes('CHAR') || dt.includes('CLOB') || dt.includes('VARCHAR')) return 'text';
    return 'text';
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmitInternal}>
      {columns && columns.map(col => (
        <div key={col.COLUMN_NAME} className="grid grid-cols-1 gap-1">
          <label className="block text-xs text-white/50 font-medium">{col.COLUMN_NAME}</label>
          <input
            name={col.COLUMN_NAME}
            type={typeForColumn(col.DATA_TYPE)}
            value={form[col.COLUMN_NAME] ?? ''}
            onChange={handleChange}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-[#E52222] transition-colors"
            required={col.NULLABLE === 'N'}
          />
        </div>
      ))}
      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onCancel} disabled={loading} className="flex-1 py-2.5 rounded-lg border border-white/10 text-white/60 hover:bg-white/5 text-sm transition-colors">
          Cancelar
        </button>
        <button type="submit" disabled={loading} className="flex-1 py-2.5 rounded-lg bg-[#E52222] hover:bg-[#c71c1c] text-white text-sm font-semibold transition-colors disabled:opacity-50">
          {loading ? 'Guardando...' : (initialData ? 'Actualizar' : 'Crear')}
        </button>
      </div>
    </form>
  );
}
