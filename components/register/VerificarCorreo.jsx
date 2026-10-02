'use client';

import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { segundosHasta } from '@/lib/client/cuentaRegresiva';
import { formatTiempo } from '@/lib/client/formato';
import { VERIFICACION } from '@/lib/domain/verificacionRegistro';

// Respuestas de la API que terminan el registro pendiente: hay que volver al formulario
const FINALES = ['CODIGO_VENCIDO', 'REGISTRO_DESCARTADO', 'REGISTRO_NO_ENCONTRADO'];

// Rutas públicas, como /api/auth/register: usan fetch directo (sin sesión no hay 401 que manejar)
async function postJson(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { res, data: await res.json() };
}

/** Segundos que faltan hasta `fin` (ms), recalculados cada segundo contra el reloj. */
function useSegundosHasta(fin) {
  const [segundos, setSegundos] = useState(() => segundosHasta(fin, Date.now()));
  useEffect(() => {
    const timer = setInterval(() => setSegundos(segundosHasta(fin, Date.now())), 1000);
    return () => clearInterval(timer);
  }, [fin]);
  return segundos;
}

/**
 * Paso 2 del registro (EMAIL_VERIFICATION): ingresar el código que llegó al correo antes de
 * que venza, con 2 intentos. Si vence o se descarta, `onDescartado` vuelve al formulario.
 */
export default function VerificarCorreo({ correo, vigenciaSegundos, onVerificado, onDescartado }) {
  const [codigo, setCodigo] = useState('');
  const [aviso, setAviso] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [fin, setFin] = useState(() => Date.now() + vigenciaSegundos * 1000);
  const [reenvioDesde, setReenvioDesde] = useState(() => Date.now() + VERIFICACION.ESPERA_REENVIO_SEG * 1000);
  const restantes = useSegundosHasta(fin);
  const esperaReenvio = useSegundosHasta(reenvioDesde);

  const descartar = (mensaje) => {
    toast.error(mensaje);
    onDescartado();
  };

  useEffect(() => {
    if (restantes > 0) return;
    toast.error('El código venció y tu registro se descartó. Regístrate de nuevo.');
    onDescartado();
  }, [restantes, onDescartado]);

  const verificar = async () => {
    if (!/^\d{6}$/.test(codigo)) {
      setAviso('El código tiene 6 dígitos.');
      return;
    }
    setEnviando(true);
    try {
      const { res, data } = await postJson('/api/auth/register/verificar', { correo, codigo });
      if (res.ok) {
        toast.success('¡Correo verificado! Ya puedes iniciar sesión.');
        onVerificado();
      } else if (FINALES.includes(data.codigo) || res.status === 409) {
        descartar(data.error);
      } else {
        setAviso(data.error || 'No se pudo verificar el código');
        setCodigo('');
      }
    } catch {
      toast.error('Error de conexión');
    } finally {
      setEnviando(false);
    }
  };

  const reenviar = async () => {
    setEnviando(true);
    try {
      const { res, data } = await postJson('/api/auth/register/reenviar', { correo });
      if (res.ok) {
        setFin(Date.now() + data.vigenciaSegundos * 1000);
        setReenvioDesde(Date.now() + VERIFICACION.ESPERA_REENVIO_SEG * 1000);
        setAviso('');
        setCodigo('');
        toast.success(`Te enviamos un código nuevo. Te quedan ${data.reenviosRestantes} reenvíos.`);
      } else if (FINALES.includes(data.codigo)) {
        descartar(data.error);
      } else {
        toast.error(data.error || 'No se pudo reenviar el código');
      }
    } catch {
      toast.error('Error de conexión');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div>
      <h1>Verifica tu correo</h1>
      <p className="sub">
        Enviamos un código de {VERIFICACION.DIGITOS} dígitos a <strong style={{ color: '#fff' }}>{correo}</strong>.
        Si no lo ves, revisa la carpeta de spam.
      </p>

      <div style={{ textAlign: 'center', marginBottom: '1.2rem' }}>
        <p style={{ color: 'var(--muted)', fontSize: '.8rem' }}>El código vence en</p>
        <div style={{ fontFamily: 'Syne, sans-serif', fontSize: '2.4rem', fontWeight: 800, color: restantes <= 60 ? 'var(--red)' : '#fff' }}>
          {formatTiempo(restantes)}
        </div>
      </div>

      <div className="form-group">
        <label htmlFor="codigo-verificacion">Código de verificación</label>
        <input
          id="codigo-verificacion"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={VERIFICACION.DIGITOS}
          placeholder="000000"
          value={codigo}
          onChange={(e) => { setCodigo(e.target.value.replace(/\D/g, '')); setAviso(''); }}
          onKeyDown={(e) => { if (e.key === 'Enter') verificar(); }}
          style={{ paddingLeft: '1rem', textAlign: 'center', letterSpacing: '8px', fontSize: '1.3rem' }}
          aria-invalid={Boolean(aviso)}
          aria-describedby="codigo-aviso"
        />
        <p id="codigo-aviso" role={aviso ? 'alert' : undefined} style={{ color: aviso ? '#f87171' : 'var(--muted)', fontSize: '.78rem', marginTop: '.45rem' }}>
          {aviso || `Tienes ${VERIFICACION.MAX_INTENTOS} intentos. Si te equivocas ${VERIFICACION.MAX_INTENTOS} veces, el registro se descarta.`}
        </p>
      </div>

      <button className="btn-full" onClick={verificar} disabled={enviando}>
        {enviando ? 'Verificando...' : 'Verificar y crear cuenta'}
      </button>

      <div className="bottom">
        ¿No te llegó?{' '}
        {esperaReenvio > 0 ? (
          <span>Puedes pedir otro en {esperaReenvio} s</span>
        ) : (
          <a onClick={enviando ? undefined : reenviar}>Reenviar código</a>
        )}
        {' · '}
        <a onClick={onDescartado}>Cambiar correo</a>
      </div>
    </div>
  );
}
