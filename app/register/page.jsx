'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';

export default function RegisterPage() {
  const router = useRouter();
  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!nombre || !apellido || !email || !password) {
      toast.error('Completa todos los campos');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre,
          apellido,
          correo: email,
          contrasena: password
        })
      });

      const data = await res.json();

      if (res.ok) {
        toast.success('¡Registro exitoso! Ya puedes iniciar sesión.');
        router.push('/login');
      } else {
        toast.error(data.error || 'Error al registrarse');
      }
    } catch (error) {
      toast.error('Error de conexión');
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
          --border:rgba(255,255,255,.1);
          --muted:rgba(255,255,255,.55)
        }
        body {
          font-family: 'DM Sans', sans-serif;
          background: var(--bg);
          color: #fff;
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 2rem 1rem;
          margin: 0;
        }
        .card{width:100%;max-width:500px;background:#111;border:1px solid var(--border);border-radius:20px;padding:2.5rem}
        .logo-link{display:flex;align-items:center;gap:8px;text-decoration:none;margin-bottom:2rem; cursor:pointer;}
        .logo-link svg{width:32px;height:22px}
        .logo-link span{font-family:'Syne',sans-serif;font-weight:800;font-size:1.2rem;color:#fff}
        h1{font-family:'Syne',sans-serif;font-size:1.8rem;font-weight:800;margin-bottom:.3rem}
        .sub{color:var(--muted);font-size:.9rem;margin-bottom:2rem}
        .row{display:grid;grid-template-columns:1fr 1fr;gap:1rem}
        .form-group{margin-bottom:1.2rem}
        label{display:block;font-size:.82rem;font-weight:600;color:rgba(255,255,255,.75);margin-bottom:.45rem}
        .input-wrap{position:relative}
        .input-wrap svg{position:absolute;left:.9rem;top:50%;transform:translateY(-50%);opacity:.5;pointer-events:none;color:var(--red)}
        input{width:100%;background:rgba(255,255,255,.06);border:1px solid var(--border);border-radius:10px;padding:.75rem 1rem .75rem 2.6rem;color:#fff;font-family:'DM Sans',sans-serif;font-size:.9rem;outline:none;transition:border-color .2s}
        input:focus{border-color:var(--red)}
        input::placeholder{color:var(--muted)}
        .terms{display:flex;gap:.75rem;align-items:flex-start;margin:1.5rem 0;font-size:.82rem;color:var(--muted)}
        .terms input[type=checkbox]{width:16px;height:16px;min-width:16px;accent-color:var(--red);cursor:pointer;margin-top:2px}
        .terms a{color:var(--red);text-decoration:none}
        .btn-full{width:100%;background:var(--red);color:#fff;border:none;font-family:'DM Sans',sans-serif;font-weight:700;font-size:1rem;padding:.9rem;border-radius:10px;cursor:pointer;transition:background .2s;margin-top:.5rem}
        .btn-full:hover{background:var(--red-dark)}
        .bottom{text-align:center;color:var(--muted);font-size:.87rem;margin-top:1.5rem}
        .bottom a{color:var(--red);text-decoration:none;font-weight:600; cursor:pointer;}
        @media(max-width:500px){.row{grid-template-columns:1fr}}
      `}</style>

      <div className="card">
        <div onClick={() => router.push('/')} className="logo-link">
          <svg viewBox="0 0 40 26" fill="none">
            <rect x="2" y="10" width="36" height="12" rx="3" fill="#E52222" />
            <rect x="8" y="4" width="20" height="10" rx="2" fill="#E52222" opacity=".7" />
            <circle cx="10" cy="22" r="4" fill="#0d0d0d" stroke="#fff" strokeWidth="1.5" />
            <circle cx="30" cy="22" r="4" fill="#0d0d0d" stroke="#fff" strokeWidth="1.5" />
          </svg>
          <span>Bycar</span>
        </div>

        <h1>Únete a Bycar</h1>
        <p className="sub">Crea tu cuenta para viajar por Colombia</p>

        <div className="row">
          <div className="form-group">
            <label>Nombre</label>
            <div className="input-wrap">
              <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
              </svg>
              <input 
                type="text" 
                placeholder="" 
                value={nombre}
                onChange={(e) => setNombre(e.target.value.toUpperCase())}
              />
            </div>
          </div>
          <div className="form-group">
            <label>Apellido</label>
            <div className="input-wrap">
              <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
              </svg>
              <input 
                type="text" 
                placeholder="" 
                value={apellido}
                onChange={(e) => setApellido(e.target.value.toUpperCase())}
              />
            </div>
          </div>
        </div>

        <div className="form-group">
          <label>Correo electrónico</label>
          <div className="input-wrap">
            <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
            </svg>
            <input 
              type="email" 
              placeholder="tu@correo.com" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
        </div>

        <div className="form-group">
          <label>Contraseña</label>
          <div className="input-wrap">
            <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            <input 
              type="password" 
              placeholder="••••••••" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
        </div>

        <button 
          className="btn-full" 
          onClick={handleRegister}
          disabled={loading}
        >
          {loading ? 'Creando cuenta...' : 'Crear cuenta gratis'}
        </button>
        
        <div className="bottom">
          ¿Ya tienes cuenta? <a onClick={() => router.push('/login')}>Inicia sesión</a>
        </div>
      </div>
    </>
  );
}