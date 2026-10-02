'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import HydrationWrapper from '@/components/HydrationWrapper';
import DetallesViajeModal from '@/components/dashboard/DetallesViajeModal';
import PreAlertaGuardianModal from '@/components/dashboard/PreAlertaGuardianModal';
import PublicarViajeModal from '@/components/dashboard/PublicarViajeModal';
import MisRutasTab from '@/components/dashboard/MisRutasTab';
import SolicitudesTab from '@/components/dashboard/SolicitudesTab';
import MensajesTab from '@/components/dashboard/MensajesTab';
import InicioTab from '@/components/dashboard/InicioTab';
import BuscarTab from '@/components/dashboard/BuscarTab';
import GuardianEnCurso from '@/components/dashboard/GuardianEnCurso';
import ContadorGuardian from '@/components/dashboard/ContadorGuardian';
import GuardianInicio from '@/components/dashboard/GuardianInicio';
import ConfigurarGuardianModal from '@/components/dashboard/ConfigurarGuardianModal';
import { fetchConSesion } from '@/lib/client/sessionFetch';
import { logout } from '@/lib/client/logout';
import { getUserId, MENSAJE_SIN_SESION } from '@/lib/client/usuario';
import { getBadgeCount } from '@/lib/client/badges';
import { iniciarIntervaloVisible } from '@/lib/client/intervaloVisible';
import { MENU_INICIO_ID } from '@/lib/domain/constantes';
import { useChat } from '@/hooks/dashboard/useChat';
import { useRutas } from '@/hooks/dashboard/useRutas';
import { useGuardian, PRE_ALERTA_SEG, EXTENSION_GUARDIAN_MIN } from '@/hooks/dashboard/useGuardian';

// Refresco en segundo plano
const REFRESCO_MS = 10000;


// Iconos para los menús según la URL
const MENU_ICONS = {
  '/inicio':      'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
  '/mis-rutas':   'M3 12h18M3 6h18M3 18h18',
  '/solicitudes': 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 7a4 4 0 100-8 4 4 0 000 8z',
  '/mensajes':    'M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z',
  '/guardian':    'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
};

export default function DashboardPage() {
  const router = useRouter();
  const [activePage, setActivePage] = useState('inicio');
  const [detallesModalOpen, setDetallesModalOpen] = useState(false);
  const [viajeDetalle, setViajeDetalle] = useState(null);
  
  const [currentUser, setCurrentUser] = useState(null);
  const chat = useChat(currentUser);
  const [mensajes, setMensajes] = useState([]);
  const [mensajesLeidos, setMensajesLeidos] = useState(0); // cuántos chats vio el usuario la última vez
  const [userPermisos, setUserPermisos] = useState(null); // null = cargando, [] = sin permisos

  // --- CATÁLOGOS DINÁMICOS ---
  const [menuItems, setMenuItems] = useState([]);
  const [marcas, setMarcas] = useState([]);
  const [municipiosDB, setMunicipiosDB] = useState([]);

  // --- ESTADO PARA BÚSQUEDA ---
  const [searchParams, setSearchParams] = useState({ origen: '', destino: '' });
  const [resultados, setResultados] = useState([]);
  const [solicitados, setSolicitados] = useState([]);

  // --- RUTAS Y SOLICITUDES ---
  const rutas = useRutas(currentUser, activePage);
  const { rutasSolicitadas, aplicarMisRutas } = rutas;
  const [solicitudesRecibidas, setSolicitudesRecibidas] = useState([]);

  // --- GUARDIÁN ---
  const guardian = useGuardian(currentUser);
  const retomarGuardian = guardian.retomar;
  const [alertasRecibidas, setAlertasRecibidas] = useState([]);

  // Cargar catálogos dinámicos (menús, marcas, municipios)
  useEffect(() => {
    Promise.all([
      fetchConSesion('/api/menus').then(r => r.ok ? r.json() : []),
      fetchConSesion('/api/marcas').then(r => r.ok ? r.json() : []),
      fetchConSesion('/api/municipios').then(r => r.ok ? r.json() : []),
    ]).then(([menus, marcasData, municipiosData]) => {
      setMenuItems(menus);
      setMarcas(marcasData);
      setMunicipiosDB(municipiosData.map(m => ({ id: m.id || m.ID_MUN, nombre: m.nombre || m.NOMBRE_MUN || '' })));
    }).catch(err => console.error('Error cargando catálogos:', err));
  }, []);

  useEffect(() => {
    const fetchDashboardData = async () => {
      let storedUser = null;
      try {
        const userStr = localStorage.getItem('user');
        if (userStr) storedUser = JSON.parse(userStr);
        setCurrentUser(storedUser);
      } catch (error) {
        // JSON corrupto en localStorage: se sigue como si no hubiera usuario
        console.error('Usuario guardado inválido en localStorage:', error);
      }

      try {
        const uIdChat = getUserId(storedUser);
        
        if (!uIdChat) return;

        // Mis rutas y chats no se piden acá: los trae el efecto de refresco apenas hay currentUser
        const [resSol, resGuardian, resPermisos] = await Promise.all([
          fetchConSesion(`/api/solicitudes/recibidas?usuarioId=${uIdChat}`),
          fetchConSesion(`/api/guardian?usuarioId=${uIdChat}`),
          fetchConSesion(`/api/admin/permisos?usuarioId=${uIdChat}`)
        ]);
        if (resSol.ok) {
          const dataSol = await resSol.json();
          setSolicitudesRecibidas(Array.isArray(dataSol) ? dataSol : []);
        }
        if (resGuardian && resGuardian.ok) {
          const dataGuardian = await resGuardian.json();
          if (dataGuardian && dataGuardian.id) retomarGuardian(dataGuardian);
        }
        if (resPermisos && resPermisos.ok) {
          const dataPermisos = await resPermisos.json();
          setUserPermisos(dataPermisos.map(p => p.menuUrl));
        } else if (resPermisos) {
          setUserPermisos([]);
        }
      } catch (error) {
        console.error('Error al cargar datos del dashboard', error);
      }
    };
    fetchDashboardData();
  }, [retomarGuardian]);

  // Re-fetch data when opening tabs or periodically
  useEffect(() => {
    if (!currentUser) return;
    const uId = getUserId(currentUser);

    const refreshTabs = () => {
      // Refresh solicitudes
      if (activePage === 'solicitudes') {
        fetchConSesion(`/api/solicitudes/recibidas?usuarioId=${uId}`)
          .then(res => res.json())
          .then(data => setSolicitudesRecibidas(Array.isArray(data) ? data : []))
          .catch(err => console.error(err));
      }
      
      // Refresh mis rutas SIEMPRE en background para detectar cambios de estado y activar el badge
      fetchConSesion(`/api/viajes/mis-rutas?usuarioId=${uId}`)
        .then(res => res.json())
        .then(aplicarMisRutas)
        .catch(err => console.error(err));

      // Refresh chat list SIEMPRE (en background) para detectar nuevos chats tanto
      // para el conductor que acepta como para el pasajero cuya solicitud fue aceptada
      fetchConSesion(`/api/mensajes/chats?usuarioId=${uId}`)
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) {
            // Si el usuario está en la pestaña mensajes, marcar como leídos automáticamente
            if (activePage === 'mensajes') {
              setMensajesLeidos(data.length);
            }
            setMensajes(data);
          }
        })
        .catch(err => console.error(err));

      // Refresh guardian alerts
      if (activePage === 'guardian') {
        if (currentUser?.CORREO_USU || currentUser?.correo_usu) {
          const email = currentUser.CORREO_USU || currentUser.correo_usu;
          fetchConSesion(`/api/guardian?email=${encodeURIComponent(email)}`)
            .then(res => res.json())
            .then(data => setAlertasRecibidas(Array.isArray(data) ? data : []))
            .catch(err => console.error(err));
        }
      }
    };


    refreshTabs();

    return iniciarIntervaloVisible(refreshTabs, REFRESCO_MS);
  }, [activePage, currentUser, aplicarMisRutas]);

  // Al navegar HACIA Mensajes o Mis Rutas se marca todo como visto. Va en el evento y no en un
  // efecto sobre activePage, que volvía a renderizar en cascada (DT-38)
  const navegar = (pagina) => {
    setActivePage(pagina);
    if (pagina === 'mensajes') setMensajesLeidos(mensajes.length);
    if (pagina === 'mis-rutas') rutas.marcarSolicitadasLeidas();
  };

  // Abre el chat de un guardián en la pestaña Mensajes. Si la lista todavía no lo trae (recién
  // activado), se abre igual con el nombre que se conoce
  const abrirChatGuardian = (guardianId, nombre) => {
    const enLista = mensajes.find((c) => c.guardianId === guardianId);
    navegar('mensajes');
    chat.abrirChat(enLista ?? { guardianId, nombre });
  };



  const buscarViajes = async () => {
    const toastId = toast.loading('Buscando viajes...');
    try {
      const url = new URL('/api/viajes', window.location.origin);
      if (searchParams.origen) url.searchParams.append('origen', searchParams.origen);
      if (searchParams.destino) url.searchParams.append('destino', searchParams.destino);
      
      const res = await fetchConSesion(url);
      const data = await res.json();
      
      if (res.ok) {
        setResultados(data);
        toast.success(`Se encontraron ${data.length} viajes`, { id: toastId });
      } else {
        toast.error('Error al buscar viajes', { id: toastId });
        setResultados([]);
      }
    } catch (error) {
      toast.error('Error de conexión', { id: toastId });
      setResultados([]);
    }
  };

  const solicitarViaje = async (id) => {
    // Sin usuario no se envía nada: antes se usaba el ID 1 (BUGS F1)
    const uId = getUserId(currentUser);
    if (!uId) {
      toast.error(MENSAJE_SIN_SESION);
      return;
    }
    const toastId = toast.loading('Enviando solicitud...');
    try {
      const res = await fetchConSesion('/api/solicitudes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ viajeId: id, usuarioId: uId })
      });
      if (res.ok) {
        setSolicitados([...solicitados, id]);
        toast.success('Solicitud enviada al conductor', { id: toastId });
      } else {
        toast.error('Error al enviar solicitud', { id: toastId });
      }
    } catch (error) {
      toast.error('Error de conexión', { id: toastId });
    }
  };

  const gestionarSolicitud = async (id, estado) => {
    const toastId = toast.loading(estado === 'Aceptado' ? 'Aceptando solicitud...' : 'Rechazando solicitud...');
    try {
      const res = await fetchConSesion('/api/solicitudes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ solicitudId: id, estado })
      });
      if (res.ok) {
        setSolicitudesRecibidas(solicitudesRecibidas.filter(s => s.id !== id));
        toast.success(estado === 'Aceptado' ? 'Solicitud aceptada' : 'Solicitud rechazada', { id: toastId });
        
        // Refresh chat list immediately if accepted
        if (estado === 'Aceptado') {
          const uId = getUserId(currentUser);
          if (uId) {
            fetchConSesion(`/api/mensajes/chats?usuarioId=${uId}`)
              .then(r => r.json())
              .then(data => setMensajes(data || []));
          }
        }
      } else {
        toast.error('Error al actualizar solicitud', { id: toastId });
      }
    } catch (error) {
      toast.error('Error de conexión', { id: toastId });
    }
  };

  const aceptarSolicitud = (id) => gestionarSolicitud(id, 'Aceptado');
  const rechazarSolicitud = (id) => gestionarSolicitud(id, 'Rechazado');

  const badgeDe = (url) => getBadgeCount(url, {
    activePage,
    solicitudesRecibidas,
    rutasSolicitadas,
    rutasSolicitadasLeidas: rutas.rutasSolicitadasLeidas,
    mensajes,
    mensajesLeidos,
    alertasRecibidas,
  });

  // Construir navItems dinámicamente desde la BD (MENUS)
  const navItems = menuItems.length > 0 && userPermisos !== null
    ? menuItems
        .filter(m => {
          if (!m.parentId && m.id !== MENU_INICIO_ID) return userPermisos.includes(m.url);
          if (m.id === MENU_INICIO_ID) return userPermisos.includes('/inicio/crear') || userPermisos.includes('/inicio/buscar') || userPermisos.includes('/inicio');
          return false;
        })
        .map(m => ({
          id: m.url ? m.url.replace('/', '') : m.id,
          label: m.label,
          icon: MENU_ICONS[m.url] || 'M3 12h18M3 6h18M3 18h18',
          badge: badgeDe(m.url),
        }))
    : [
        { id: 'inicio',      label: 'Inicio',      icon: MENU_ICONS['/inicio'],      badge: 0 },
        { id: 'mis-rutas',   label: 'Mis Rutas',   icon: MENU_ICONS['/mis-rutas'],   badge: badgeDe('/mis-rutas') },
        { id: 'solicitudes', label: 'Solicitudes',  icon: MENU_ICONS['/solicitudes'], badge: badgeDe('/solicitudes') },
        { id: 'mensajes',    label: 'Mensajes',     icon: MENU_ICONS['/mensajes'],    badge: badgeDe('/mensajes') },
        { id: 'guardian',    label: 'Guardian',     icon: MENU_ICONS['/guardian'],    badge: badgeDe('/guardian') },
      ];

  return (
    <HydrationWrapper>
      <style jsx global>{`
        :root {
          --red: #E52222;
          --red-dark: #c01a1a;
          --bg: #0d0d0d;
          --surface: #111;
          --card: rgba(255,255,255,.04);
          --border: rgba(255,255,255,.08);
          --text: #fff;
          --muted: rgba(255,255,255,.5);
        }
        body { margin: 0; background: var(--bg); color: var(--text); font-family: 'DM Sans', sans-serif; }
        .dashboard-container { display: flex; min-height: 100vh; flex-direction: row; }
        .sidebar { width: 260px; background: var(--surface); border-right: 1px solid var(--border); display: flex; flex-direction: column; position: sticky; top: 0; height: 100vh; }
        .mobile-nav { display: none; position: fixed; bottom: 0; left: 0; right: 0; background: var(--surface); border-top: 1px solid var(--border); height: 65px; z-index: 1000; justify-content: space-around; align-items: center; padding: 0 10px; }
        .mobile-item { display: flex; flex-direction: column; align-items: center; color: var(--muted); gap: 4px; font-size: 0.65rem; cursor: pointer; flex: 1; }
        .mobile-item.active { color: var(--red); }
        .s-logo { display: flex; align-items: center; gap: 8px; padding: 1.5rem; border-bottom: 1px solid var(--border); margin-bottom: 1rem; }
        .nav-item { display: flex; align-items: center; gap: .75rem; padding: .75rem 1.5rem; color: var(--muted); cursor: pointer; border-left: 3px solid transparent; transition: 0.2s; }
        .nav-item:hover, .nav-item.active { color: #fff; background: rgba(255,255,255,.04); border-left-color: var(--red); }
        .nav-item.active { color: var(--red); }
        main { flex: 1; padding: 2.5rem; max-width: 1200px; margin: 0 auto; width: 100%; box-sizing: border-box; }
        .page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 2rem; }
        .page-header h1 { font-family: 'Syne', sans-serif; font-size: 1.8rem; margin: 0; }
        .route-card { background: var(--card); border: 1px solid var(--border); border-radius: 16px; padding: 1.25rem; display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem; transition: 0.2s; }
        .btn-red { background: var(--red); color: #fff; border: none; padding: 0.7rem 1.4rem; border-radius: 10px; font-weight: 700; cursor: pointer; transition: 0.2s; display: flex; align-items: center; gap: 8px; }
        .btn-red:disabled { background: #333; color: var(--muted); cursor: not-allowed; }
        .badge-status { padding: 4px 10px; border-radius: 20px; font-size: 0.7rem; font-weight: bold; }
        .Aceptado, .Aceptada { background: rgba(74, 222, 128, 0.1); color: #4ade80; }
        .Pendiente { background: rgba(250, 204, 21, 0.1); color: #facc15; }
        .Rechazado, .Rechazada { background: rgba(239, 68, 68, 0.1); color: #ef4444; }
        .Cancelado, .Cancelada { background: rgba(156, 163, 175, 0.1); color: #9ca3af; }
        .search-input { width: 100%; padding: 10px 14px; background: rgba(255,255,255,0.05); border: 1px solid var(--border); border-radius: 12px; color: #fff; outline: none; text-transform: uppercase; font-size: 0.85rem; transition: all 0.2s; box-sizing: border-box; }
        .search-input:focus { border-color: var(--red); background: rgba(255,255,255,0.08); box-shadow: 0 0 0 2px rgba(229,34,34,0.1); }
        .uppercase-input { text-transform: uppercase; }
        select.search-input { appearance: none; -webkit-appearance: none; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='rgba(255,255,255,0.4)' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 14px center; padding-right: 36px; text-transform: none; }
        select.search-input option { background: #1a1a1a; color: #fff; text-transform: none; }
        .nav-skeleton { height: 44px; background: rgba(255,255,255,0.04); border-radius: 8px; margin: 4px 16px; animation: pulse 1.5s ease-in-out infinite; }
        @keyframes pulse { 0%,100% { opacity: 0.4; } 50% { opacity: 0.8; } }
        
        @media (max-width: 768px) {
          .sidebar { display: none; }
          .mobile-nav { display: flex; }
          main { padding: 1.5rem 1rem 5rem 1rem; }
          .page-header { flex-direction: column; gap: 1rem; }
          .grid-2 { grid-template-columns: 1fr !important; }
          .route-card { flex-direction: column; align-items: flex-start; gap: 1rem; }
          .route-card div:last-child { width: 100%; display: flex; justify-content: flex-end; }
        }
      `}</style>
      <div className="dashboard-container">
      
      <div className="mobile-nav">
        {navItems.map((item) => (
          <div key={item.id} className={`mobile-item ${activePage === item.id ? 'active' : ''}`} onClick={() => navegar(item.id)}>
            <div style={{ position: 'relative' }}>
              <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d={item.icon} /></svg>
              {item.badge > 0 && <span style={{ position: 'absolute', top: '-5px', right: '-8px', background: 'var(--red)', color: '#fff', borderRadius: '10px', padding: '1px 5px', fontSize: '0.6rem' }}>{item.badge}</span>}
            </div>
            <span>{item.label}</span>
          </div>
        ))}
      </div>

      <aside className="sidebar">
        <div className="s-logo" onClick={() => router.push('/dashboard')} style={{ cursor: 'pointer' }}>
          <svg width="28" height="20" viewBox="0 0 40 26" fill="none"><rect x="2" y="10" width="36" height="12" rx="3" fill="#E52222"/><circle cx="10" cy="22" r="4" fill="#0d0d0d" stroke="#fff" strokeWidth="1.5"/><circle cx="30" cy="22" r="4" fill="#0d0d0d" stroke="#fff" strokeWidth="1.5"/></svg>
          <span style={{ fontFamily: 'Syne', fontWeight: 800 }}>Bycar</span>
        </div>
        <nav style={{ flex: 1 }}>
          {menuItems.length === 0 ? (
            // Skeleton de carga mientras llegan los menús de la BD
            [1,2,3,4,5].map(i => <div key={i} className="nav-skeleton" />)
          ) : (
            navItems.map((item) => (
              <div key={item.id} className={`nav-item ${activePage === item.id ? 'active' : ''}`} onClick={() => navegar(item.id)}>
                <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d={item.icon} /></svg>
                {item.label}
                {item.badge > 0 && <span style={{ background: 'var(--red)', color: '#fff', borderRadius: '10px', padding: '1px 6px', fontSize: '0.7rem', marginLeft: 'auto' }}>{item.badge}</span>}
              </div>
            ))
          )}
        </nav>

        <div style={{ padding: '1.5rem', borderTop: '1px solid var(--border)' }}>
          <button 
            onClick={logout}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', background: 'transparent', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '0.9rem', padding: '10px' }}
            onMouseEnter={(e) => e.target.style.color = '#fff'}
            onMouseLeave={(e) => e.target.style.color = 'var(--muted)'}
          >
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Cerrar Sesión
          </button>
        </div>
      </aside>

      <main>
        {activePage === 'inicio' && (
          <InicioTab
            nombreUsuario={currentUser?.NOMBRE_USU || currentUser?.nombre_usu || 'Pasajero'}
            puedeCrear={userPermisos === null || userPermisos.includes('/inicio/crear')}
            puedeBuscar={userPermisos === null || userPermisos.includes('/inicio/buscar')}
            searchParams={searchParams}
            setSearchParams={setSearchParams}
            municipios={municipiosDB}
            onCrear={rutas.abrirPublicar}
            onBuscar={() => { buscarViajes(); navegar('buscar'); }}
          />
        )}

        {activePage === 'buscar' && (
          <BuscarTab
            resultados={resultados}
            solicitados={solicitados}
            onVolver={() => navegar('inicio')}
            onVerDetalles={(viaje) => { setViajeDetalle(viaje); setDetallesModalOpen(true); }}
            onSolicitar={solicitarViaje}
          />
        )}

        {activePage === 'mis-rutas' && (
          <MisRutasTab rutasPublicadas={rutas.rutasPublicadas} rutasSolicitadas={rutasSolicitadas} />
        )}

        {activePage === 'solicitudes' && (
          <SolicitudesTab
            solicitudesRecibidas={solicitudesRecibidas}
            onAceptar={aceptarSolicitud}
            onRechazar={rechazarSolicitud}
          />
        )}

        {activePage === 'mensajes' && (
          <MensajesTab
            mensajes={mensajes}
            chatOpen={chat.chatOpen}
            chatData={chat.chatData}
            currentChatMsgs={chat.currentChatMsgs}
            msgInput={chat.msgInput}
            onAbrirChat={chat.abrirChat}
            onCerrarChat={chat.cerrarChat}
            onMsgInputChange={chat.setMsgInput}
            onEnviar={chat.enviarMensaje}
          />
        )}

        {activePage === 'guardian' && (
          <section>
            <div className="page-header">
              <div>
                <h1 style={{ fontFamily: 'Syne', fontWeight: 800 }}>🛡️ Guardián de Ruta</h1>
                <p style={{ color: 'var(--muted)' }}>Protege tu viaje. Tu contacto de confianza será alertado si no confirmas tu llegada.</p>
              </div>
            </div>

            {guardian.activo && guardian.viaje && (
              <ContadorGuardian cuenta={guardian.cuenta}>
                {(tiempoRestante) => (
                  <GuardianEnCurso
                    viaje={guardian.viaje}
                    contactoEmail={guardian.config.email}
                    tiempoRestante={tiempoRestante}
                    segundosPreAlerta={PRE_ALERTA_SEG}
                    horaInicio={guardian.horaInicio}
                    alertaEnviada={guardian.alertaEnviada}
                    preAlerta={guardian.preAlerta}
                    onLlegue={guardian.finalizar}
                    onChatear={guardian.guardianId
                      ? () => abrirChatGuardian(guardian.guardianId, guardian.config.email)
                      : undefined}
                  />
                )}
              </ContadorGuardian>
            )}

            {!guardian.activo && (
              <GuardianInicio
                rutasSolicitadas={rutasSolicitadas}
                alertasRecibidas={alertasRecibidas}
                onElegirViaje={guardian.elegirViaje}
                onEnviarMensaje={(alerta) => abrirChatGuardian(alerta.id, alerta.pasajero)}
              />
            )}


            {guardian.configOpen && guardian.viaje && (
              <ConfigurarGuardianModal
                viaje={guardian.viaje}
                config={guardian.config}
                setConfig={guardian.setConfig}
                errorContacto={guardian.errorContacto}
                onCerrar={() => guardian.setConfigOpen(false)}
                onIniciar={() => guardian.iniciar(guardian.viaje)}
              />
            )}
          </section>
        )}

        {/* VISTA DINÁMICA DE FALLBACK PARA NUEVOS MENÚS CREADOS POR EL ADMINISTRADOR */}
        {!['inicio', 'buscar', 'mis-rutas', 'solicitudes', 'mensajes', 'guardian'].includes(activePage) && (
          <section style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', textAlign: 'center', padding: '2rem' }}>
            <div style={{ width: '80px', height: '80px', background: 'rgba(255,255,255,0.05)', borderRadius: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--red)', marginBottom: '1.5rem', border: '1px solid var(--border)' }}>
              <svg width="40" height="40" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                <path d="M12 3v13.5M3 18.75h18" />
              </svg>
            </div>
            <h1 style={{ fontFamily: 'Syne', fontWeight: 800, fontSize: '2.2rem', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '1px' }}>
              {navItems.find(item => item.id === activePage)?.label || activePage.replace(/-/g, ' ')}
            </h1>
            <p style={{ color: 'var(--muted)', fontSize: '0.95rem', maxWidth: '450px', lineHeight: '1.6', marginBottom: '2rem' }}>
              Este módulo se ha detectado y cargado de manera dinámica. Su acceso ya está protegido y configurado bajo el esquema de permisos de Bycar.
            </p>
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: '16px', padding: '12px 24px', fontSize: '0.8rem', color: 'var(--muted)', fontFamily: 'monospace' }}>
              Identificador del Módulo: <span style={{ color: 'var(--red)', fontWeight: 'bold' }}>{activePage}</span>
            </div>
          </section>
        )}

        {rutas.publicarOpen && (
          <PublicarViajeModal
            nuevaRuta={rutas.nuevaRuta}
            setNuevaRuta={rutas.setNuevaRuta}
            municipios={municipiosDB}
            marcas={marcas}
            onInputChange={rutas.handleInputChange}
            onSubmit={rutas.guardarRuta}
            onCerrar={rutas.cerrarPublicar}
          />
        )}

        {detallesModalOpen && viajeDetalle && (
          <DetallesViajeModal
            viaje={viajeDetalle}
            yaSolicitado={solicitados.includes(viajeDetalle.id)}
            onCerrar={() => setDetallesModalOpen(false)}
            onSolicitar={() => { setDetallesModalOpen(false); solicitarViaje(viajeDetalle.id); }}
          />
        )}
        {guardian.showReadjustModal && (
          <PreAlertaGuardianModal
            minutosExtension={EXTENSION_GUARDIAN_MIN}
            onLlegue={guardian.finalizar}
            onReajustar={guardian.reajustarTiempo}
          />
        )}
      </main>
      </div>
    </HydrationWrapper>
  );
}
