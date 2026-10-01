'use client';

import { useRouter } from 'next/navigation';
import { useInView } from './useInView';

export function CtaFinal() {
  const router = useRouter();
  const [ctaRef, ctaVisible] = useInView();

  return (
    <div
      ref={ctaRef}
      className={`cta-section${ctaVisible ? ' visible' : ''}`}
    >
      <h2>Únete a la comunidad<br />de viajeros Bycar</h2>
      <p style={{ color: 'var(--muted)', marginTop: '1rem', marginBottom: '2.5rem' }}>
        La forma más inteligente de moverte por Colombia.
      </p>
      <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
        <button className="btn-red" style={{ padding: '1rem 2.5rem' }} onClick={() => router.push('/register')}>
          Crear cuenta gratis
        </button>
        <button
          className="btn-ghost"
          style={{ border: '1px solid var(--border)', borderRadius: '8px', transition: 'border-color .2s, color .2s' }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,.4)'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; }}
          onClick={() => router.push('/login')}
        >
          Ya tengo cuenta
        </button>
      </div>
    </div>
  );
}
