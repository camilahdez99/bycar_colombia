'use client';

import React from 'react';

/** Aviso antes de que venza el guardián: confirmar la llegada o pedir más tiempo. */
export default function PreAlertaGuardianModal({ minutosExtension, onLlegue, onReajustar }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: '20px' }}>
      <div style={{ background: 'var(--surface)', width: '100%', maxWidth: '400px', borderRadius: '24px', border: '1px solid var(--red)', padding: '2.5rem', textAlign: 'center' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</div>
        <h2 style={{ fontFamily: 'Syne', fontSize: '1.5rem', marginBottom: '1rem' }}>¿Has llegado a tu destino?</h2>
        <p style={{ color: 'var(--muted)', fontSize: '0.9rem', marginBottom: '2rem' }}>Tu tiempo está por terminar. Confirma tu llegada o solicita más tiempo si hay retrasos en la ruta.</p>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <button className="btn-red" onClick={onLlegue} style={{ width: '100%', justifyContent: 'center', padding: '1rem' }}>✅ Sí, he llegado</button>
          <button onClick={onReajustar} style={{ background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid var(--border)', width: '100%', padding: '1rem', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold' }}>🕒 No, hay retraso (+{minutosExtension} min)</button>
        </div>
      </div>
    </div>
  );
}
