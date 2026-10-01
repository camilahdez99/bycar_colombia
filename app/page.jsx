import { LandingNav } from '@/components/landing/LandingNav';
import { HeroTexto } from '@/components/landing/HeroTexto';
import { PasosAnimados } from '@/components/landing/PasosAnimados';
import { GuardianesAnimados } from '@/components/landing/GuardianesAnimados';
import { CtaFinal } from '@/components/landing/CtaFinal';

/*
 * Server component: los estilos y el contenido estático se renderizan en el servidor.
 * Solo son de cliente las partes con estado: el nav (scroll), la entrada del hero
 * y las secciones que se animan al entrar en pantalla (BACKLOG DT-45).
 */
export default function LandingPage() {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        :root {
          --red: #E52222;
          --red-dark: #c01a1a;
          --bg: #0d0d0d;
          --card: rgba(255,255,255,0.05);
          --border: rgba(255,255,255,0.1);
          --text: #ffffff;
          --muted: rgba(255,255,255,0.6);
        }
        html { scroll-behavior: smooth; }
        body { font-family: 'DM Sans', sans-serif; background: var(--bg); color: var(--text); min-height: 100vh; overflow-x: hidden; }

        /* ═══════════════════════════════════
           KEYFRAMES
        ═══════════════════════════════════ */

        /* slide-up fade-in — used for hero elements */
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(28px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        /* fade-in only */
        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }

        /* subtle horizontal drift for hero bg */
        @keyframes bgDrift {
          0%   { transform: scale(1.04) translateX(0); }
          50%  { transform: scale(1.04) translateX(-12px); }
          100% { transform: scale(1.04) translateX(0); }
        }

        /* red underline expand */
        @keyframes underlineExpand {
          from { transform: scaleX(0); }
          to   { transform: scaleX(1); }
        }

        /* pulse ring on CTA button */
        @keyframes ring {
          0%   { box-shadow: 0 0 0 0 rgba(229,34,34,.45); }
          70%  { box-shadow: 0 0 0 14px rgba(229,34,34,0); }
          100% { box-shadow: 0 0 0 0   rgba(229,34,34,0); }
        }

        /* floating dots in hero */
        @keyframes floatDot {
          0%, 100% { transform: translateY(0)   opacity(.35); }
          50%       { transform: translateY(-18px); opacity:.6; }
        }

        /* card reveal from below */
        @keyframes cardReveal {
          from { opacity: 0; transform: translateY(40px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        /* shimmer sweep on nav */
        @keyframes shimmer {
          from { background-position: -200% center; }
          to   { background-position:  200% center; }
        }

        /* ═══════════════════════════════════
           NAV
        ═══════════════════════════════════ */
        nav {
          position: fixed; top: 0; left: 0; right: 0; z-index: 100;
          display: flex; align-items: center; justify-content: space-between;
          padding: 0 2.5rem; height: 64px;
          background: rgba(10,10,10,0.95);
          border-bottom: 1px solid var(--border);
          backdrop-filter: blur(12px);
          transition: box-shadow .4s, background .4s;
        }
        nav.scrolled {
          box-shadow: 0 4px 40px rgba(0,0,0,.6);
          background: rgba(8,8,8,0.98);
        }
        .nav-logo { display: flex; align-items: center; gap: 10px; text-decoration: none; cursor: pointer; }
        .nav-logo span { font-family: 'Syne', sans-serif; font-weight: 800; font-size: 1.3rem; color: #fff; }
        .nav-links { display: flex; align-items: center; gap: 2rem; }
        .nav-links a {
          color: var(--muted); text-decoration: none; font-size: .9rem; font-weight: 500;
          position: relative; padding-bottom: 2px;
          transition: color .2s;
        }
        .nav-links a::after {
          content: ''; position: absolute; bottom: -2px; left: 0; right: 0;
          height: 1px; background: var(--red);
          transform: scaleX(0); transform-origin: left;
          transition: transform .25s ease;
        }
        .nav-links a:hover { color: #fff; }
        .nav-links a:hover::after { transform: scaleX(1); }
        .nav-actions { display: flex; align-items: center; gap: 1rem; }
        .btn-ghost {
          background: none; border: none; color: #fff;
          font-family: 'DM Sans', sans-serif; font-weight: 600; font-size: .9rem;
          cursor: pointer; padding: .5rem 1rem;
          transition: color .2s;
        }
        .btn-ghost:hover { color: var(--red); }
        .btn-red {
          background: var(--red); color: #fff; border: none;
          font-family: 'DM Sans', sans-serif; font-weight: 700; font-size: .9rem;
          padding: .55rem 1.3rem; border-radius: 8px; cursor: pointer;
          transition: background .2s, transform .15s, box-shadow .2s;
          position: relative; overflow: hidden;
        }
        .btn-red::before {
          content: ''; position: absolute; inset: 0;
          background: linear-gradient(120deg, transparent 30%, rgba(255,255,255,.15) 50%, transparent 70%);
          background-size: 200% auto;
          opacity: 0; transition: opacity .2s;
        }
        .btn-red:hover { background: var(--red-dark); transform: translateY(-2px); box-shadow: 0 6px 24px rgba(229,34,34,.35); }
        .btn-red:hover::before { opacity: 1; animation: shimmer .6s linear; }
        .btn-red:active { transform: translateY(0); }

        /* ═══════════════════════════════════
           HERO
        ═══════════════════════════════════ */
        .hero {
          position: relative; min-height: 90vh;
          display: flex; flex-direction: column; justify-content: center;
          align-items: center; text-align: center;
          padding: 120px 2.5rem 4rem;
          background: #0d0d0d;
          overflow: hidden;
        }
        .hero-bg {
          position: absolute; inset: 0; z-index: 0;
          background: url('https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1600&q=80') center/cover no-repeat;
          opacity: 0.25;
          animation: bgDrift 20s ease-in-out infinite;
        }
        .hero-bg::after {
          content: ''; position: absolute; inset: 0;
          background: radial-gradient(circle, rgba(13,13,13,0.4) 0%, rgba(13,13,13,1) 80%);
        }

        /* floating ambient dots */
        .hero-dot {
          position: absolute; border-radius: 50%;
          background: var(--red); pointer-events: none; z-index: 0;
          animation: floatDot var(--dur, 6s) ease-in-out infinite;
          animation-delay: var(--delay, 0s);
          opacity: .18;
          filter: blur(1px);
        }

        .hero-content { position: relative; z-index: 1; max-width: 850px; }

        /* staggered entrance */
        .hero-badge {
          display: inline-flex; align-items: center; gap: 6px;
          border: 1px solid rgba(229,34,34,0.3); color: var(--red);
          background: rgba(229,34,34,0.1);
          font-size: .75rem; font-weight: 700; text-transform: uppercase;
          padding: .4rem 1rem; border-radius: 999px; margin-bottom: 1.5rem;
          opacity: 0;
        }
        .hero-badge.ready {
          animation: slideUp .6s cubic-bezier(.22,1,.36,1) .1s forwards;
        }

        .hero-title {
          font-family: 'Syne', sans-serif;
          font-size: clamp(2.5rem, 6vw, 4.2rem); font-weight: 800; line-height: 1.1; margin-bottom: 1.5rem;
          opacity: 0;
        }
        .hero-title.ready {
          animation: slideUp .7s cubic-bezier(.22,1,.36,1) .25s forwards;
        }
        .hero-title .accent { color: var(--red); }

        /* underline on accent */
        .hero-title .accent-wrap {
          position: relative; display: inline-block;
        }
        .hero-title .accent-wrap::after {
          content: ''; position: absolute; bottom: -4px; left: 0; right: 0; height: 3px;
          background: var(--red); border-radius: 2px;
          transform: scaleX(0); transform-origin: left;
        }
        .hero-title.ready .accent-wrap::after {
          animation: underlineExpand .5s cubic-bezier(.22,1,.36,1) .95s forwards;
        }

        .hero-sub {
          color: var(--muted); font-size: 1.1rem; line-height: 1.6;
          margin: 0 auto 2.5rem; max-width: 600px;
          opacity: 0;
        }
        .hero-sub.ready {
          animation: slideUp .65s cubic-bezier(.22,1,.36,1) .4s forwards;
        }

        .hero-cta {
          opacity: 0;
        }
        .hero-cta.ready {
          animation: slideUp .6s cubic-bezier(.22,1,.36,1) .55s forwards;
        }
        .hero-cta .btn-red {
          padding: 1rem 2.5rem; font-size: 1rem;
          animation: ring 2.4s ease-in-out 1.8s infinite;
        }

        /* ═══════════════════════════════════
           SECTIONS
        ═══════════════════════════════════ */
        section { padding: 8rem 2.5rem; max-width: 1200px; margin: 0 auto; }
        .section-label { color: var(--red); font-size: .75rem; font-weight: 700; text-transform: uppercase; margin-bottom: 1rem; display: block; }
        .section-title { font-family: 'Syne', sans-serif; font-size: clamp(2rem, 4vw, 3rem); font-weight: 800; margin-bottom: 3rem; }

        /* ─── STEPS ─── */
        .steps { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1.5rem; }
        @media (max-width: 1024px) { .steps { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 560px)  { .steps { grid-template-columns: 1fr; } }

        .step-card {
          background: var(--card); border: 1px solid var(--border);
          border-radius: 16px; padding: 2.5rem;
          opacity: 0; transform: translateY(40px);
          transition:
            border-color .25s,
            box-shadow .25s,
            transform .25s cubic-bezier(.22,1,.36,1);
        }
        .step-card.visible {
          animation: cardReveal .55s cubic-bezier(.22,1,.36,1) var(--delay, 0s) forwards;
        }
        .step-card:hover {
          border-color: rgba(229,34,34,.5);
          box-shadow: 0 8px 32px rgba(229,34,34,.1);
          transform: translateY(-4px);
        }

        .step-num {
          width: 42px; height: 42px; border-radius: 12px;
          background: rgba(229,34,34,0.15); border: 1px solid rgba(229,34,34,0.3);
          display: flex; align-items: center; justify-content: center;
          color: var(--red); font-family: 'Syne', sans-serif; font-weight: 800; font-size: 1.1rem;
          margin-bottom: 1.5rem;
          transition: background .25s, transform .25s;
        }
        .step-card:hover .step-num {
          background: rgba(229,34,34,.28);
          transform: rotate(-6deg) scale(1.08);
        }
        .step-card h3 { font-family: 'Syne', sans-serif; font-size: 1.1rem; font-weight: 700; margin-bottom: .75rem; }
        .step-card p { color: var(--muted); font-size: .9rem; line-height: 1.6; }

        /* ─── GUARDIANES ─── */
        .guardianes-container {
          display: grid; grid-template-columns: 1fr 1fr; gap: 4rem; align-items: center; margin-top: 1rem;
        }
        .feature-item {
          display: flex; gap: 1.5rem; margin-bottom: 2rem;
          opacity: 0; transform: translateX(-24px);
          transition: opacity .5s, transform .5s cubic-bezier(.22,1,.36,1);
        }
        .feature-item.visible {
          opacity: 1; transform: translateX(0);
          transition-delay: var(--delay, 0s);
        }
        .feature-icon {
          width: 48px; height: 48px; background: rgba(229,34,34,0.1);
          border-radius: 12px; display: flex; align-items: center; justify-content: center;
          color: var(--red); flex-shrink: 0;
          transition: background .25s, transform .3s cubic-bezier(.34,1.56,.64,1);
        }
        .feature-item:hover .feature-icon {
          background: rgba(229,34,34,.22);
          transform: scale(1.12) rotate(-4deg);
        }
        .feature-text h4 { font-family: 'Syne', sans-serif; font-size: 1.1rem; margin-bottom: .4rem; }
        .feature-text p { color: var(--muted); font-size: .9rem; line-height: 1.5; }

        .route-visual {
          border: 1px solid var(--border); border-radius: 24px; padding: 2rem;
          background: rgba(255,255,255,0.02);
          opacity: 0; transform: translateX(24px);
          transition: opacity .6s .2s, transform .6s .2s cubic-bezier(.22,1,.36,1);
        }
        .route-visual.visible { opacity: 1; transform: translateX(0); }

        .timeline { position: relative; padding-left: 2rem; border-left: 2px dashed var(--border); }
        .timeline-point {
          position: absolute; left: -7px; width: 12px; height: 12px;
          background: var(--red); border-radius: 50%;
          box-shadow: 0 0 0 0 rgba(229,34,34,.5);
          animation: ring 2s ease-in-out 1s infinite;
        }

        /* ─── CTA ─── */
        .cta-section {
          text-align: center;
          background: linear-gradient(135deg, rgba(229,34,34,0.1), rgba(229,34,34,0.03));
          border: 1px solid rgba(229,34,34,0.2); border-radius: 24px;
          padding: 5rem 2.5rem; max-width: 1200px; margin: 0 auto 6rem;
          opacity: 0; transform: translateY(30px);
          transition: opacity .65s, transform .65s cubic-bezier(.22,1,.36,1);
        }
        .cta-section.visible { opacity: 1; transform: translateY(0); }

        /* ─── FOOTER ─── */
        footer { border-top: 1px solid var(--border); padding: 2.5rem; display: flex; justify-content: space-between; align-items: center; }

        /* ─── RESPONSIVE ─── */
        @media (max-width: 900px) {
          .guardianes-container { grid-template-columns: 1fr; gap: 3rem; }
          .hero h1 { font-size: 2.8rem; }
          footer { flex-direction: column; gap: 1.5rem; text-align: center; }
        }
      ` }} />

      {/* ── NAV ── */}
      <LandingNav />

      {/* ── HERO ── */}
      <div className="hero">
        <div className="hero-bg" />

        {/* ambient dots */}
        {[
          { size: 6,  top: '22%', left: '12%', dur: '7s',  delay: '0s'   },
          { size: 4,  top: '65%', left: '8%',  dur: '9s',  delay: '1.2s' },
          { size: 8,  top: '35%', left: '88%', dur: '6s',  delay: '0.5s' },
          { size: 5,  top: '75%', left: '82%', dur: '8s',  delay: '2s'   },
          { size: 3,  top: '15%', left: '60%', dur: '11s', delay: '0.8s' },
        ].map((d, i) => (
          <div
            key={i}
            className="hero-dot"
            style={{
              width: d.size, height: d.size,
              top: d.top, left: d.left,
              '--dur': d.dur, '--delay': d.delay,
            }}
          />
        ))}

        <HeroTexto />
      </div>

      {/* ── CÓMO FUNCIONA ── */}
      <section id="como-funciona">
        <span className="section-label">Proceso</span>
        <h2 className="section-title">¿Cómo funciona Bycar?</h2>
        <PasosAnimados />
      </section>

      {/* ── SEGURIDAD ── */}
      <section id="seguridad">
        <span className="section-label">Innovación en seguridad</span>
        <h2 className="section-title">
          Red de Guardianes <span style={{ color: 'var(--red)' }}>de Ruta</span>
        </h2>

        <GuardianesAnimados />
      </section>

      {/* ── CTA ── */}
      <CtaFinal />

      {/* ── FOOTER ── */}
      <footer>
        <p>© 2026 Bycar · Medellín, Colombia</p>
      </footer>
    </>
  );
}
