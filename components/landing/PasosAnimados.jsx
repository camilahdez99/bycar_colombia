'use client';

import { useInView } from './useInView';

const PASOS = [
  { n: '01', title: 'Regístrate gratis', body: 'Crea tu cuenta y verifica tu identidad para una comunidad más segura.' },
  { n: '02', title: 'Publica o busca',   body: 'Como conductor ofrece tus puestos; como viajero busca tu ruta ideal.' },
  { n: '03', title: 'Viaja seguro',       body: 'Coordina el punto de encuentro y disfruta de un viaje cómodo y directo.' },
  { n: '04', title: 'Comparte tu viaje',  body: 'Califica la experiencia y ayúdanos a construir una comunidad confiable.' },
];

export function PasosAnimados() {
  const [stepsRef, stepsVisible] = useInView();

  return (
    <div className="steps" ref={stepsRef}>
      {PASOS.map((s, i) => (
        <div
          key={i}
          className={`step-card${stepsVisible ? ' visible' : ''}`}
          style={{ '--delay': `${i * 0.1}s` }}
        >
          <div className="step-num">{s.n}</div>
          <h3>{s.title}</h3>
          <p>{s.body}</p>
        </div>
      ))}
    </div>
  );
}
