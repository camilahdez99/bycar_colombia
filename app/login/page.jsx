'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      toast.error('Completa todos los campos');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ correo: email, contrasena: password })
      });

      const data = await res.json();

      if (res.ok) {
        if (typeof window !== 'undefined' && data.user) {
          localStorage.setItem('user', JSON.stringify(data.user));
        }
        toast.success('¡Bienvenido!');
        router.push(data.redirect);
      } else {
        toast.error(data.error || 'Error al iniciar sesión');
      }
    } catch (error) {
      toast.error('Error de conexión con el servidor');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style jsx global>{`
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        :root{
          --red:#E52222;
          --red-dark:#c01a1a;
          --bg:#0d0d0d;
          --card:rgba(255,255,255,.05);
          --border:rgba(255,255,255,.1);
          --text:#fff;
          --muted:rgba(255,255,255,.55)
        }
        body{
          font-family:'DM Sans',sans-serif;
          background:var(--bg);
          color:var(--text);
          min-height:100vh;
          display:flex;
          margin: 0;
        }
        .login-container { display: flex; width: 100%; min-height: 100vh; }
        .left{flex:1;display:flex;flex-direction:column;justify-content:center;align-items:center;padding:3rem 2rem;position:relative;overflow:hidden}
        .left-bg{position:absolute;inset:0;background:url('https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=900&q=70') center/cover;opacity:.2}
        .left-bg::after{content:'';position:absolute;inset:0;background:linear-gradient(135deg,rgba(229,34,34,.15),rgba(10,10,10,.8))}
        .left-content{position:relative;z-index:1;display:flex;flex-direction:column;align-items:center;text-align:center;max-width:380px}
        .left-content h2{font-family:'Syne',sans-serif;font-size:2.2rem;font-weight:800;margin:1.2rem 0 .75rem;text-align:center}
        .left-content p{color:var(--muted);font-size:.95rem;line-height:1.65;text-align:center}
        .right{width:500px;background:#111;display:flex;flex-direction:column;justify-content:center;padding:3rem;border-left:1px solid var(--border)}
        .logo-link{display:flex;align-items:center;gap:8px;text-decoration:none;margin-bottom:2.5rem; cursor: pointer;}
        .logo-link svg{width:32px;height:22px}
        .logo-link span{font-family:'Syne',sans-serif;font-weight:800;font-size:1.2rem;color:#fff}
        h1{font-family:'Syne',sans-serif;font-size:1.8rem;font-weight:800;margin-bottom:.4rem}
        .sub{color:var(--muted);font-size:.9rem;margin-bottom:2rem}
        .form-group{margin-bottom:1.25rem}
        label{display:block;font-size:.82rem;font-weight:600;color:rgba(255,255,255,.75);margin-bottom:.5rem;letter-spacing:.02em}
        .input-wrap{position:relative}
        .input-wrap svg{position:absolute;left:.9rem;top:50%;transform:translateY(-50%);opacity:.5;pointer-events:none}
        input[type=email],input[type=password],input[type=text]{width:100%;background:rgba(255,255,255,.06);border:1px solid var(--border);border-radius:10px;padding:.75rem 1rem .75rem 2.6rem;color:#fff;font-family:'DM Sans',sans-serif;font-size:.92rem;outline:none;transition:border-color .2s}
        input:focus{border-color:var(--red)}
        input::placeholder{color:var(--muted)}
        .forgot{text-align:right;margin-top:.4rem}
        .forgot a{color:var(--red);font-size:.8rem;text-decoration:none}
        .btn-full{width:100%;background:var(--red);color:#fff;border:none;font-family:'DM Sans',sans-serif;font-weight:700;font-size:1rem;padding:.85rem;border-radius:10px;cursor:pointer;margin-top:.5rem;transition:background .2s}
        .btn-full:hover{background:var(--red-dark)}
        .divider{display:flex;align-items:center;gap:1rem;margin:1.5rem 0;color:var(--muted);font-size:.82rem}
        .divider::before,.divider::after{content:'';flex:1;height:1px;background:var(--border)}
        .bottom{text-align:center;color:var(--muted);font-size:.87rem;margin-top:1.5rem}
        .bottom a{color:var(--red);text-decoration:none;font-weight:600; cursor: pointer;}
        @media(max-width:768px){.left{display:none}.right{width:100%;padding:2rem 1.5rem}}
      `}</style>

      <div className="login-container">
        <div className="left">
          <div className="left-bg"></div>
          <div className="left-content">
            <svg width="60" height="40" viewBox="0 0 40 26" fill="none">
              <rect x="2" y="10" width="36" height="12" rx="3" fill="#E52222" />
              <rect x="8" y="4" width="20" height="10" rx="2" fill="#E52222" opacity=".7" />
              <circle cx="10" cy="22" r="4" fill="#0d0d0d" stroke="#fff" strokeWidth="1.5" />
              <circle cx="30" cy="22" r="4" fill="#0d0d0d" stroke="#fff" strokeWidth="1.5" />
            </svg>
            <h2>Viaja diferente.<br />Viaja con Bycar.</h2>
            <p>Conectamos conductores y pasajeros en rutas intermunicipales de Colombia.<br /> Económico, seguro y cómodo.</p>
          </div>
        </div>

        <div className="right">
          <div onClick={() => router.push('/')} className="logo-link">
            <svg viewBox="0 0 40 26" fill="none">
              <rect x="2" y="10" width="36" height="12" rx="3" fill="#E52222" />
              <rect x="8" y="4" width="20" height="10" rx="2" fill="#E52222" opacity=".7" />
              <circle cx="10" cy="22" r="4" fill="#0d0d0d" stroke="#fff" strokeWidth="1.5" />
              <circle cx="30" cy="22" r="4" fill="#0d0d0d" stroke="#fff" strokeWidth="1.5" />
            </svg>
            <span>Bycar</span>
          </div>

          <h1>Bienvenido de nuevo</h1>
          <p className="sub">Inicia sesión en tu cuenta de Bycar</p>

          <div className="form-group">
            <label>Correo electrónico</label>
            <div className="input-wrap">
              <svg width="16" height="16" fill="none" stroke="var(--red)" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                <polyline points="22,6 12,13 2,6" />
              </svg>
              <input
                type="email"
                id="email"
                placeholder="tu@correo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div className="form-group">
            <label>Contraseña</label>
            <div className="input-wrap">
              <svg width="16" height="16" fill="none" stroke="var(--red)" strokeWidth="2" viewBox="0 0 24 24">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <input
                type="password"
                id="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <button
            className="btn-full"
            onClick={handleLogin}
            disabled={loading}
          >
            {loading ? 'Iniciando...' : 'Iniciar sesión'}
          </button>

          <div className="divider">o</div>
          <div className="bottom">
            ¿No tienes cuenta? <a onClick={() => router.push('/register')}>Regístrate gratis</a>
          </div>
        </div>
      </div>
    </>
  );
}