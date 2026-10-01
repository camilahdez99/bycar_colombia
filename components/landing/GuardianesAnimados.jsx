'use client';

import { useInView } from './useInView';

const FUNCIONES = [
  {
    icon: '🛡️',
    title: 'Temporizador de Vida',
    body: 'Al iniciar tu viaje, defines el tiempo estimado. Si no marcas tu llegada a tiempo, activamos el protocolo.',
    delay: '0s',
  },
  {
    icon: '🔔',
    title: 'Alertas Automáticas',
    body: 'Si el tiempo expira sin confirmación, enviamos una alerta inmediata a tu contacto de confianza.',
    delay: '.12s',
  },
  {
    icon: '👥',
    title: 'Contactos de Confianza',
    body: 'Tú eliges quién recibirá tus notificaciones de seguridad.',
    delay: '.24s',
  },
];

export function GuardianesAnimados() {
  const [featRef, featVisible] = useInView();

  return (
    <div className="guardianes-container" ref={featRef}>
      <div className="features-list">
        {FUNCIONES.map((f, i) => (
          <div
            key={i}
            className={`feature-item${featVisible ? ' visible' : ''}`}
            style={{ '--delay': f.delay }}
          >
            <div className="feature-icon">{f.icon}</div>
            <div className="feature-text">
              <h4>{f.title}</h4>
              <p>{f.body}</p>
            </div>
          </div>
        ))}
      </div>

      <div className={`route-visual${featVisible ? ' visible' : ''}`}>
        <h4 style={{ marginBottom: '1.5rem', fontFamily: 'Syne' }}>Bogotá → Villa de Leyva</h4>
        <div className="timeline">
          <div style={{ marginBottom: '2rem' }}>
            <div className="timeline-point" style={{ top: '5px' }} />
            <strong style={{ fontSize: '.9rem' }}>Salida — Portal Norte</strong>
            <p style={{ fontSize: '.75rem', color: 'var(--muted)' }}>6:00 AM · Confirmado</p>
          </div>
          <div style={{
            border: '1px solid var(--red)', padding: '1rem', borderRadius: '12px',
            background: 'rgba(229,34,34,0.05)',
          }}>
            <p style={{ fontSize: '.8rem', color: 'var(--red)', fontWeight: 'bold' }}>⚠️ Alerta de Tiempo</p>
            <p style={{ fontSize: '.7rem', color: 'var(--muted)' }}>
              ¿Has llegado a tu destino? Confirma para evitar alertar a tus contactos.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
