'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export function LandingNav() {
  const router = useRouter();
  const [navScrolled, setNavScrolled] = useState(false);

  /* nav shadow on scroll */
  useEffect(() => {
    const onScroll = () => setNavScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <nav className={navScrolled ? 'scrolled' : ''}>
      <div onClick={() => router.push('/')} className="nav-logo">
        <svg width="36" height="24" viewBox="0 0 40 26" fill="none">
          <rect x="2" y="10" width="36" height="12" rx="3" fill="#E52222" />
          <circle cx="10" cy="22" r="4" fill="#0d0d0d" stroke="#fff" strokeWidth="1.5" />
          <circle cx="30" cy="22" r="4" fill="#0d0d0d" stroke="#fff" strokeWidth="1.5" />
        </svg>
        <span>Bycar</span>
      </div>
      <div className="nav-links">
        <a href="#como-funciona">Cómo funciona</a>
        <a href="#seguridad">Seguridad</a>
      </div>
      <div className="nav-actions">
        <button className="btn-ghost" onClick={() => router.push('/login')}>Iniciar sesión</button>
        <button className="btn-red" onClick={() => router.push('/register')}>Registrarse</button>
      </div>
    </nav>
  );
}
