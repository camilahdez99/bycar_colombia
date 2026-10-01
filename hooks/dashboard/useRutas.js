'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { fetchConSesion } from '@/lib/client/sessionFetch';
import { formatCurrency } from '@/lib/client/formato';
import { getUserId, MENSAJE_SIN_SESION } from '@/lib/client/usuario';

const RUTA_VACIA = { origen: '', destino: '', marca: '', carro: '', placa: '', fecha: '', puestos: '', valor: '', comentarios: '' };

/** Lista de `mis-rutas` ordenada de la más nueva a la más vieja. */
const porIdDescendente = (lista) => (Array.isArray(lista) ? lista : []).sort((a, b) => b.id - a.id);

/**
 * Rutas del usuario: las que publicó y las que solicitó (con cuáles ya vio, para el badge),
 * y el formulario para publicar una nueva.
 */
export function useRutas(currentUser, activePage) {
  const [rutasPublicadas, setRutasPublicadas] = useState([]);
  const [rutasSolicitadas, setRutasSolicitadas] = useState([]);
  const [rutasSolicitadasLeidas, setRutasSolicitadasLeidas] = useState({}); // { [routeId]: estado }
  const [publicarOpen, setPublicarOpen] = useState(false);
  const [nuevaRuta, setNuevaRuta] = useState(RUTA_VACIA);

  /** Aplica la respuesta de `GET /api/viajes/mis-rutas`. Estable: solo usa setters. */
  const aplicarMisRutas = useCallback((data) => {
    if (data && typeof data === 'object') {
      setRutasPublicadas(porIdDescendente(data.publicadas));
      setRutasSolicitadas(porIdDescendente(data.solicitadas));
    }
  }, []);

  // Cuando el usuario navega HACIA la pestaña de mis-rutas (o actualiza estando en ella), marcar todos como leídos
  useEffect(() => {
    if (activePage === 'mis-rutas' && rutasSolicitadas.length > 0) {
      const updated = {};
      rutasSolicitadas.forEach(r => {
        updated[r.id] = r.estado;
      });
      setRutasSolicitadasLeidas(prev => ({ ...prev, ...updated }));
    }
  }, [activePage, rutasSolicitadas]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (name === 'valor') {
      setNuevaRuta({ ...nuevaRuta, [name]: formatCurrency(value) });
    } else {
      setNuevaRuta({ ...nuevaRuta, [name]: value.toUpperCase() });
    }
  };

  const guardarRuta = async (e) => {
    e.preventDefault();
    // Sin usuario no se publica: antes se usaba el ID 1 (BUGS F1)
    const uId = getUserId(currentUser);
    if (!uId) {
      toast.error(MENSAJE_SIN_SESION);
      return;
    }
    const toastId = toast.loading('Publicando tu ruta...');

    try {
      const res = await fetchConSesion('/api/viajes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...nuevaRuta, usuarioId: uId })
      });
      
      const data = await res.json();
      
      if (res.ok) {
        const nueva = {
          id: data.id,
          ...nuevaRuta
        };
        // La lista va de la más nueva a la más vieja: la ruta publicada va primera (BUGS F30)
        setRutasPublicadas([nueva, ...rutasPublicadas]);
        setPublicarOpen(false);
        setNuevaRuta(RUTA_VACIA);
        toast.success('Ruta publicada correctamente', { id: toastId });
      } else {
        toast.error(data.error || 'Error al publicar', { id: toastId });
      }
    } catch (error) {
      toast.error('Error de conexión', { id: toastId });
    }
  };

  return {
    rutasPublicadas, rutasSolicitadas, rutasSolicitadasLeidas, aplicarMisRutas,
    nuevaRuta, setNuevaRuta, handleInputChange, guardarRuta,
    publicarOpen, abrirPublicar: () => setPublicarOpen(true), cerrarPublicar: () => setPublicarOpen(false),
  };
}
