'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { fetchConSesion } from '@/lib/client/sessionFetch';
import { getUserId, MENSAJE_SIN_SESION } from '@/lib/client/usuario';
import { iniciarIntervaloVisible } from '@/lib/client/intervaloVisible';

const REFRESCO_XPRESS_MS = 10000;

export const VISTAS_XPRESS = ['enviados', 'recibidos', 'conductor'];

const FORM_VACIO = { viajeId: '', receptor: null, descripcion: '', peso: '' };
const SIN_CARGAS = { enviados: [], recibidos: [], conductor: [] };

const JSON_HEADERS = { 'Content-Type': 'application/json' };

/**
 * Encomiendas Xpress del usuario: lo que envió, lo que va a recibir y las cargas de los viajes que
 * conduce (con refresco cada 10 s mientras la pestaña está abierta). Incluye el formulario de
 * registro y edición, y las acciones sobre cada carga. Cada acción pide a la API y, si sale bien, recarga.
 */
export function useXpress(currentUser, activePage) {
  const userId = getUserId(currentUser);
  const [vista, setVista] = useState('enviados');
  const [cargas, setCargas] = useState(SIN_CARGAS);
  const [viajes, setViajes] = useState([]);
  const [formAbierto, setFormAbierto] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [form, setForm] = useState(FORM_VACIO);
  const [guardando, setGuardando] = useState(false);

  // Con .then (y no await) el setState queda en un callback: así el efecto de abajo no lo dispara en cascada
  const refrescar = useCallback(() => {
    if (!userId) return Promise.resolve();
    return Promise.all(
      VISTAS_XPRESS.map((v) =>
        fetchConSesion(`/api/xpress?usuarioId=${userId}&vista=${v}`)
          .then((res) => (res.ok ? res.json() : []))
          .then((data) => [v, Array.isArray(data) ? data : []])
      )
    )
      .then((listas) => setCargas(Object.fromEntries(listas)))
      .catch((error) => console.error('Error cargando encomiendas', error));
  }, [userId]);

  // Se refresca solo con la pestaña Xpress abierta
  useEffect(() => {
    if (activePage !== 'xpress' || !userId) return;
    refrescar();
    return iniciarIntervaloVisible(refrescar, REFRESCO_XPRESS_MS);
  }, [activePage, userId, refrescar]);

  const cargarViajes = async () => {
    try {
      const res = await fetchConSesion('/api/viajes');
      const data = res.ok ? await res.json() : [];
      setViajes(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error cargando viajes', error);
      setViajes([]);
    }
  };

  const abrirNueva = () => {
    setEditandoId(null);
    setForm(FORM_VACIO);
    setFormAbierto(true);
    cargarViajes();
  };

  const abrirEdicion = (carga) => {
    setEditandoId(carga.id);
    setForm({ viajeId: carga.viajeId, receptor: null, descripcion: carga.descripcion, peso: carga.peso ?? '' });
    setFormAbierto(true);
  };

  const cerrarForm = () => setFormAbierto(false);

  /** Llama a la API; con éxito muestra `mensajeOk` y recarga las listas. Devuelve true si salió bien. */
  const pedir = async (url, init, mensajeOk, mensajeError) => {
    const toastId = toast.loading('Procesando...');
    try {
      const res = await fetchConSesion(url, init);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || mensajeError, { id: toastId });
        return false;
      }
      toast.success(mensajeOk, { id: toastId });
      await refrescar();
      return true;
    } catch (error) {
      console.error('Error en Xpress', error);
      toast.error('Error de conexión', { id: toastId });
      return false;
    }
  };

  const guardar = async () => {
    if (!userId) return toast.error(MENSAJE_SIN_SESION);
    const descripcion = form.descripcion.trim();
    if (!editandoId && !form.viajeId) return toast.error('Elige el viaje en el que va la encomienda');
    if (!editandoId && !form.receptor) return toast.error('Elige quién la va a recibir');
    if (!descripcion) return toast.error('Describe lo que vas a enviar');

    setGuardando(true);
    const peso = form.peso === '' ? null : form.peso;
    const ok = editandoId
      ? await pedir(
          '/api/xpress',
          { method: 'PUT', headers: JSON_HEADERS, body: JSON.stringify({ id: editandoId, descripcion, peso }) },
          'Encomienda actualizada',
          'No se pudo actualizar la encomienda'
        )
      : await pedir(
          '/api/xpress',
          {
            method: 'POST',
            headers: JSON_HEADERS,
            body: JSON.stringify({
              viajeId: form.viajeId,
              usuarioId: userId,
              receptorEmail: form.receptor.correo,
              descripcion,
              peso,
            }),
          },
          'Encomienda registrada',
          'No se pudo registrar la encomienda'
        );
    setGuardando(false);
    if (ok) setFormAbierto(false);
  };

  /** El conductor cambia el estado de una carga de su viaje (Aceptada, Rechazada, En camino, Entregada). */
  const cambiarEstado = (carga, estado) =>
    pedir(
      '/api/xpress',
      { method: 'PUT', headers: JSON_HEADERS, body: JSON.stringify({ id: carga.id, estado }) },
      'Estado actualizado',
      'No se pudo actualizar el estado'
    );

  /** El remitente cancela: la carga queda en el historial como Cancelada. */
  const cancelar = (carga) =>
    pedir(`/api/xpress?id=${carga.id}`, { method: 'DELETE' }, 'Encomienda cancelada', 'No se pudo cancelar la encomienda');

  return {
    userId, vista, setVista, cargas, viajes, form, setForm, formAbierto, editandoId, guardando,
    abrirNueva, abrirEdicion, cerrarForm, guardar, cambiarEstado, cancelar,
  };
}
