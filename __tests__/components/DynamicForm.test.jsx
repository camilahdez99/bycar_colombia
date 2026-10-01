import { afterEach, describe, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import DynamicForm from '@/components/DynamicForm';

const COLUMNAS = [
  { COLUMN_NAME: 'ID_USU', DATA_TYPE: 'NUMBER', NULLABLE: 'N' },
  { COLUMN_NAME: 'NOMBRE_USU', DATA_TYPE: 'VARCHAR2', NULLABLE: 'N' },
  { COLUMN_NAME: 'FECHA_CREACION', DATA_TYPE: 'DATE', NULLABLE: 'Y' },
  { COLUMN_NAME: 'CREADO_EN', DATA_TYPE: 'TIMESTAMP(6)', NULLABLE: 'Y' },
  { COLUMN_NAME: 'CONTENIDO', DATA_TYPE: 'CLOB', NULLABLE: 'Y' },
  { COLUMN_NAME: 'FOTO', DATA_TYPE: 'BLOB', NULLABLE: 'Y' },
  { COLUMN_NAME: 'EDAD', DATA_TYPE: 'integer', NULLABLE: 'Y' },
];

const input = (name) => document.querySelector(`input[name="${name}"]`);

afterEach(cleanup);

describe('DynamicForm (caracterización)', () => {
  test('typeForColumn: el tipo de input sale del tipo de dato de Oracle', () => {
    render(<DynamicForm columns={COLUMNAS} onSubmit={vi.fn()} onCancel={vi.fn()} />);
    expect(input('ID_USU').type).toBe('number');
    expect(input('NOMBRE_USU').type).toBe('text');
    expect(input('FECHA_CREACION').type).toBe('date');
    expect(input('CREADO_EN').type).toBe('date');
    expect(input('CONTENIDO').type).toBe('text');
    expect(input('FOTO').type).toBe('text');
    expect(input('EDAD').type).toBe('number');
  });

  test('solo las columnas NOT NULL son obligatorias', () => {
    render(<DynamicForm columns={COLUMNAS} onSubmit={vi.fn()} onCancel={vi.fn()} />);
    expect(input('ID_USU').required).toBe(true);
    expect(input('FECHA_CREACION').required).toBe(false);
  });

  test('alta: arranca vacío y envía todas las columnas', () => {
    const onSubmit = vi.fn();
    render(<DynamicForm columns={COLUMNAS.slice(0, 2)} onSubmit={onSubmit} onCancel={vi.fn()} />);
    fireEvent.change(input('ID_USU'), { target: { value: '5' } });
    fireEvent.change(input('NOMBRE_USU'), { target: { value: 'ANA' } });
    fireEvent.click(screen.getByText('Crear'));
    expect(onSubmit).toHaveBeenCalledWith({ ID_USU: '5', NOMBRE_USU: 'ANA' });
  });

  test('edición: arranca con los datos y dice "Actualizar"', () => {
    const onSubmit = vi.fn();
    render(<DynamicForm columns={COLUMNAS.slice(0, 2)} initialData={{ ID_USU: 1, NOMBRE_USU: 'LUIS', EXTRA: 'x' }} onSubmit={onSubmit} onCancel={vi.fn()} />);
    expect(input('NOMBRE_USU').value).toBe('LUIS');
    fireEvent.click(screen.getByText('Actualizar'));
    expect(onSubmit).toHaveBeenCalledWith({ ID_USU: 1, NOMBRE_USU: 'LUIS', EXTRA: 'x' });
  });

  test('guardando: botones deshabilitados y texto "Guardando..."', () => {
    const onCancel = vi.fn();
    render(<DynamicForm columns={COLUMNAS.slice(0, 1)} loading onSubmit={vi.fn()} onCancel={onCancel} />);
    expect(screen.getByText('Guardando...').disabled).toBe(true);
    expect(screen.getByText('Cancelar').disabled).toBe(true);
  });

  test('si cambia el registro a editar, descarta lo tipeado y carga el nuevo', () => {
    const props = { columns: COLUMNAS.slice(0, 2), onSubmit: vi.fn(), onCancel: vi.fn() };
    const { rerender } = render(<DynamicForm {...props} initialData={{ ID_USU: 1, NOMBRE_USU: 'LUIS' }} />);
    fireEvent.change(input('NOMBRE_USU'), { target: { value: 'TIPEADO' } });
    rerender(<DynamicForm {...props} initialData={{ ID_USU: 2, NOMBRE_USU: 'ANA' }} />);
    expect(input('NOMBRE_USU').value).toBe('ANA');
    expect(input('ID_USU').value).toBe('2');
  });

  test('con las mismas props (misma referencia) conserva lo tipeado', () => {
    const props = { columns: COLUMNAS.slice(0, 2), initialData: { ID_USU: 1, NOMBRE_USU: 'LUIS' }, onSubmit: vi.fn(), onCancel: vi.fn() };
    const { rerender } = render(<DynamicForm {...props} />);
    fireEvent.change(input('NOMBRE_USU'), { target: { value: 'TIPEADO' } });
    rerender(<DynamicForm {...props} loading />);
    expect(input('NOMBRE_USU').value).toBe('TIPEADO');
  });

  test('alta: si cambian las columnas, arranca vacío con las nuevas', () => {
    const onSubmit = vi.fn();
    const { rerender } = render(<DynamicForm columns={COLUMNAS.slice(0, 1)} onSubmit={onSubmit} onCancel={vi.fn()} />);
    fireEvent.change(input('ID_USU'), { target: { value: '9' } });
    rerender(<DynamicForm columns={COLUMNAS.slice(1, 2)} onSubmit={onSubmit} onCancel={vi.fn()} />);
    fireEvent.submit(document.querySelector('form'));
    expect(onSubmit).toHaveBeenCalledWith({ NOMBRE_USU: '' });
  });

  test('Cancelar llama a onCancel', () => {
    const onCancel = vi.fn();
    render(<DynamicForm columns={COLUMNAS.slice(0, 1)} onSubmit={vi.fn()} onCancel={onCancel} />);
    fireEvent.click(screen.getByText('Cancelar'));
    expect(onCancel).toHaveBeenCalledOnce();
  });
});
