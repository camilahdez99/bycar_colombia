'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { fetchConSesion } from '@/lib/client/sessionFetch';
import { getUserId } from '@/lib/client/usuario';
import { crearCuentaRegresiva } from '@/lib/client/cuentaRegresiva';
import { TIEMPO_GUARDIAN_POR_DEFECTO_MIN } from '@/lib/domain/constantes';

export const PRE_ALERTA_SEG = 5 * 60;
export const EXTENSION_GUARDIAN_MIN = 15;

/** PUT de la alerta del guardián, sin esperar la respuesta. */
function registrarAlerta(id) {
  return fetchConSesion('/api/guardian', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, estado: 'Alerta' })
  });
}

/**
 * Guardián de ruta del usuario: viaje elegido, configuración, temporizador con pre-alerta
 * y alerta, y las acciones contra `/api/guardian` (iniciar, finalizar, extender, retomar).
 *
 * Los segundos restantes viven en `cuenta` y no en el estado (DT-35): el tick no vuelve a
 * renderizar a quien usa el hook. Para mostrarlos, suscribirse con `ContadorGuardian`.
 */
export function useGuardian(currentUser) {
  const [viaje, setViaje] = useState(null);
  const [config, setConfig] = useState({ email: '', tiempoMin: TIEMPO_GUARDIAN_POR_DEFECTO_MIN });
  const [activo, setActivo] = useState(false);
  const [cuenta] = useState(crearCuentaRegresiva);
  const [alertaEnviada, setAlertaEnviada] = useState(false);
  const [preAlerta, setPreAlerta] = useState(false);
  const [horaInicio, setHoraInicio] = useState(null);
  const [configOpen, setConfigOpen] = useState(false);
  const [showReadjustModal, setShowReadjustModal] = useState(false);
  const [guardianId, setGuardianId] = useState(null);

  // Refs para que el temporizador siempre lea los valores más recientes
  // sin reiniciarse en cada cambio de estado
  const preAlertaRef = useRef(false);
  const alertaEnviadaRef = useRef(false);
  const guardianIdRef = useRef(null);

  // Sincronizar refs con el estado
  useEffect(() => { preAlertaRef.current = preAlerta; }, [preAlerta]);
  useEffect(() => { alertaEnviadaRef.current = alertaEnviada; }, [alertaEnviada]);
  useEffect(() => { guardianIdRef.current = guardianId; }, [guardianId]);

  // Temporizador — SÓLO se reinicia cuando `activo` cambia
  useEffect(() => {
    if (!activo) return;

    // Descuenta 1 por tick, como antes (el desfase en segundo plano es BUGS F39, va aparte)
    const timer = setInterval(() => {
      const next = cuenta.leer() - 1;

      // PRE_ALERTA_SEG antes de terminar → pre-alerta. Con "<=" también sale si el viaje
      // arranca (o se retoma al recargar) con menos de ese tiempo (BUGS F35)
      if (next > 0 && next <= PRE_ALERTA_SEG && !preAlertaRef.current) {
        preAlertaRef.current = true;
        setPreAlerta(true);
        setShowReadjustModal(true);
        toast('⚠️ ¿Has llegado? Tu tiempo está por terminar.', { duration: 10000, icon: '🔔' });
      }

      // Tiempo agotado → alerta real
      if (next <= 0 && !alertaEnviadaRef.current) {
        alertaEnviadaRef.current = true;
        setAlertaEnviada(true);
        toast.error('🚨 TIEMPO AGOTADO. Alerta activada para tu contacto.', { duration: 15000 });
        // Sincronizar estado con la BD
        const gId = guardianIdRef.current;
        if (gId) registrarAlerta(gId);
        clearInterval(timer);
      }

      cuenta.fijar(Math.max(next, 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [activo, cuenta]); // ← `cuenta` es estable: solo se reinicia cuando cambia `activo`

  /**
   * Retoma el guardián activo que devolvió `GET /api/guardian?usuarioId` al cargar.
   * Estable (solo usa setters), para que el efecto de carga lo pueda declarar como dependencia.
   */
  const retomar = useCallback((guardado) => {
    const startTime = new Date(guardado.inicio.replace(' ', 'T'));
    const elapsed = Math.floor((Date.now() - startTime.getTime()) / 1000);
    const total = guardado.tiempoMin * 60;
    const remaining = Math.max(total - elapsed, 0);

    setGuardianId(guardado.id);
    setViaje({
      id: guardado.viajeId,
      origen: guardado.origen,
      destino: guardado.destino,
      conductor: guardado.conductor,
      placa: guardado.placa,
      carro: guardado.carro
    });
    setConfig({ email: guardado.email, tiempoMin: guardado.tiempoMin });
    setHoraInicio(startTime);
    cuenta.fijar(remaining);
    setActivo(true);
    // Vencido mientras la pestaña estaba cerrada: si la alerta no quedó registrada, se registra
    // ahora (antes solo se mostraba en pantalla, BUGS F28). Si ya estaba en Alerta, no se repite.
    if (remaining <= 0) {
      setAlertaEnviada(true);
      if (guardado.estado?.toUpperCase() !== 'ALERTA') {
        registrarAlerta(guardado.id)
          .catch(error => console.error('Error registrando la alerta del guardián:', error));
      }
    }
  }, [cuenta]);

  const elegirViaje = (viajeElegido) => {
    setViaje(viajeElegido);
    setConfigOpen(true);
  };

  const iniciar = async (viajeElegido) => {
    if (!config.email || !config.tiempoMin) {
      toast.error('Configura el correo y tiempo estimado');
      return;
    }

    const uId = getUserId(currentUser);
    const vId = viajeElegido.viajeId || viajeElegido.id;

    try {
      const res = await fetchConSesion('/api/guardian', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          viajeId: vId,
          usuarioId: uId,
          email: config.email.trim().toUpperCase(),
          tiempo: config.tiempoMin
        })
      });

      const data = await res.json();
      if (res.ok) {
        setGuardianId(data.id);
        setViaje(viajeElegido);
        setActivo(true);
        setAlertaEnviada(false);
        setPreAlerta(false);
        setHoraInicio(new Date());
        cuenta.fijar(config.tiempoMin * 60);
        setConfigOpen(false);
        toast.success('🛡️ Guardián activado en base de datos. ¡Buen viaje!');
      } else {
        toast.error(`Error (ID: ${vId}): ` + data.error);
      }
    } catch (e) {
      toast.error('Error de conexión con el servidor');
    }
  };

  // PUT al guardián; true si la API lo registró. Antes no se revisaba la respuesta (BUGS F38)
  const actualizar = async (cambios) => {
    try {
      const res = await fetchConSesion('/api/guardian', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: guardianId, ...cambios })
      });
      return res.ok;
    } catch (error) {
      console.error('Error actualizando el guardián:', error);
      return false;
    }
  };

  const finalizar = async () => {
    // Si la llegada no se registra, el guardián sigue activo para no dejar al contacto sin aviso
    if (guardianId && !(await actualizar({ estado: 'Inactivo' }))) {
      toast.error('No se pudo registrar tu llegada. Intenta de nuevo.');
      return;
    }
    setActivo(false);
    cuenta.fijar(0);
    setGuardianId(null);
    setShowReadjustModal(false);
    // Sin id no hubo PUT: la llegada no quedó registrada (BUGS F36)
    if (guardianId) {
      toast.success('✅ ¡Llegaste bien! Guardián desactivado.');
    } else {
      toast.error('El guardián se desactivó en este dispositivo, pero no se pudo registrar tu llegada.');
    }
  };

  const reajustarTiempo = async () => {
    if (guardianId) {
      if (!(await actualizar({ extraTiempo: EXTENSION_GUARDIAN_MIN }))) {
        toast.error('No se pudo extender el tiempo. Intenta de nuevo.');
        return;
      }

      cuenta.fijar(cuenta.leer() + (EXTENSION_GUARDIAN_MIN * 60));
      setPreAlerta(false);
      setShowReadjustModal(false);
      toast.success(`⏱️ Tiempo extendido ${EXTENSION_GUARDIAN_MIN} minutos`);
    }
  };

  return {
    viaje, config, setConfig, activo, cuenta, alertaEnviada, preAlerta, horaInicio,
    configOpen, setConfigOpen, showReadjustModal,
    retomar, elegirViaje, iniciar, finalizar, reajustarTiempo,
  };
}
