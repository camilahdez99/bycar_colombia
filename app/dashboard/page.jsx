'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import HydrationWrapper from '@/components/admin/HydrationWrapper';

const normalizar = (str) => {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
};

const Autocomplete = ({ placeholder, value, onChange, opciones = [] }) => {
  const [show, setShow] = useState(false);
  const wrapperRef = useRef(null);

  // Derivar opciones filtradas dinámicamente (opciones es [{id, nombre}])
  const valNorm = normalizar(value || "");
  const filtered = valNorm.length > 0 
    ? opciones.filter(m => normalizar(m.nombre || m).includes(valNorm))
    : [];

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setShow(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleChange = (e) => {
    const val = normalizar(e.target.value);
    onChange(val);
    if (val.trim().length > 0) {
      setShow(true);
    } else {
      setShow(false);
    }
  };

  const handleSelect = (m) => {
    onChange(m);
    setShow(false);
  };

  return (
    <div ref={wrapperRef} style={{ position: 'relative', width: '100%' }}>
      <input 
        type="text" 
        placeholder={placeholder} 
        className="search-input" 
        value={value} 
        onChange={handleChange} 
        onFocus={() => { if(value) setShow(true) }}
        onBlur={() => { setTimeout(() => setShow(false), 200); }}
        required
      />
      {show && filtered.length > 0 && (
        <ul style={{ 
          position: 'absolute', top: 'calc(100% + 8px)', left: 0, right: 0, 
          background: '#1a1a1a', border: '1px solid var(--border)', 
          borderRadius: '14px', zIndex: 100, listStyle: 'none', 
          padding: '8px', margin: 0, maxHeight: '200px', 
          overflowY: 'auto', boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
          backdropFilter: 'blur(10px)'
        }}>
          {filtered.map(m => (
            <li 
              key={m.id || m} 
              onMouseDown={() => handleSelect(m.nombre || m)} 
              style={{ 
                padding: '10px 14px', cursor: 'pointer', borderRadius: '8px',
                fontSize: '0.85rem', color: 'rgba(255,255,255,0.8)',
                transition: 'all 0.2s'
              }} 
              onMouseEnter={(e) => {
                e.target.style.background = 'rgba(229,34,34,0.1)';
                e.target.style.color = 'var(--red)';
              }} 
              onMouseLeave={(e) => {
                e.target.style.background = 'transparent';
                e.target.style.color = 'rgba(255,255,255,0.8)';
              }}
            >
              {m.nombre || m}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

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
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [detallesModalOpen, setDetallesModalOpen] = useState(false);
  const [viajeDetalle, setViajeDetalle] = useState(null);
  
  const [chatOpen, setChatOpen] = useState(false);
  const [chatData, setChatData] = useState({ name: '', avatar: '', chatId: null });
  const [currentChatMsgs, setCurrentChatMsgs] = useState([]);
  const [msgInput, setMsgInput] = useState('');

  const [currentUser, setCurrentUser] = useState(null);
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

  // --- ESTADO PARA GESTIÓN DE RUTAS Y SOLICITUDES ---
  const [rutasPublicadas, setRutasPublicadas] = useState([]);
  const [rutasSolicitadas, setRutasSolicitadas] = useState([]);
  const [rutasSolicitadasLeidas, setRutasSolicitadasLeidas] = useState({}); // { [routeId]: estado }
  const [solicitudesRecibidas, setSolicitudesRecibidas] = useState([]);

  // --- ESTADO PARA LA NUEVA RUTA ---
  const [nuevaRuta, setNuevaRuta] = useState({
    origen: '', destino: '', marca: '', carro: '', placa: '', fecha: '', puestos: '', valor: '', comentarios: ''
  });

  // --- ESTADO PARA GUARDIÁN ---
  const [guardianViaje, setGuardianViaje] = useState(null);
  const [guardianConfig, setGuardianConfig] = useState({ email: '', tiempoMin: 30 });
  const [guardianActivo, setGuardianActivo] = useState(false);
  const [guardianTiempoRestante, setGuardianTiempoRestante] = useState(0);
  const [guardianAlertaEnviada, setGuardianAlertaEnviada] = useState(false);
  const [guardianPreAlerta, setGuardianPreAlerta] = useState(false);
  const [guardianFinalizado, setGuardianFinalizado] = useState(false);
  const [guardianHoraInicio, setGuardianHoraInicio] = useState(null);
  const [guardianConfigOpen, setGuardianConfigOpen] = useState(false);
  const [alertasRecibidas, setAlertasRecibidas] = useState([]);
  const [showReadjustModal, setShowReadjustModal] = useState(false);
  const [guardianId, setGuardianId] = useState(null);

  // Refs para que el temporizador siempre lea los valores más recientes
  // sin reiniciarse en cada cambio de estado
  const guardianPreAlertaRef = useRef(false);
  const guardianAlertaEnviadaRef = useRef(false);
  const guardianIdRef = useRef(null);

  // Sincronizar refs con el estado
  useEffect(() => { guardianPreAlertaRef.current = guardianPreAlerta; }, [guardianPreAlerta]);
  useEffect(() => { guardianAlertaEnviadaRef.current = guardianAlertaEnviada; }, [guardianAlertaEnviada]);
  useEffect(() => { guardianIdRef.current = guardianId; }, [guardianId]);


  // Cargar catálogos dinámicos (menús, marcas, municipios)
  useEffect(() => {
    Promise.all([
      fetch('/api/menus').then(r => r.ok ? r.json() : []),
      fetch('/api/marcas').then(r => r.ok ? r.json() : []),
      fetch('/api/municipios').then(r => r.ok ? r.json() : []),
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
      } catch(e) {}

      try {
        const uIdChat = storedUser ? (storedUser.ID_USU || storedUser.id_usu || storedUser.id) : null;
        const pId = storedUser ? (storedUser.PERFIL_ID_PER || storedUser.perfil_id_per) : null;
        
        if (!uIdChat) return;

        const [resRutas, resSol, resMensajes, resGuardian, resPermisos] = await Promise.all([
          fetch(`/api/viajes/mis-rutas?usuarioId=${uIdChat}`),
          fetch(`/api/solicitudes/recibidas?usuarioId=${uIdChat}`),
          fetch(`/api/mensajes/chats?usuarioId=${uIdChat}`),
          fetch(`/api/guardian?usuarioId=${uIdChat}`),
          fetch(`/api/admin/permisos?usuarioId=${uIdChat}`)
        ]);
        if (resRutas.ok) {
          const dataRutas = await resRutas.json();
          setRutasPublicadas((Array.isArray(dataRutas.publicadas) ? dataRutas.publicadas : []).sort((a, b) => b.id - a.id));
          setRutasSolicitadas((Array.isArray(dataRutas.solicitadas) ? dataRutas.solicitadas : []).sort((a, b) => b.id - a.id));
        }
        if (resSol.ok) {
          const dataSol = await resSol.json();
          setSolicitudesRecibidas(Array.isArray(dataSol) ? dataSol : []);
        }
        if (resMensajes && resMensajes.ok) {
          const dataMensajes = await resMensajes.json();
          setMensajes(Array.isArray(dataMensajes) ? dataMensajes : []);
        }
        if (resGuardian && resGuardian.ok) {
          const dataGuardian = await resGuardian.json();
          if (dataGuardian && dataGuardian.id) {
            const startTime = new Date(dataGuardian.inicio.replace(' ', 'T'));
            const elapsed = Math.floor((Date.now() - startTime.getTime()) / 1000);
            const total = dataGuardian.tiempoMin * 60;
            const remaining = Math.max(total - elapsed, 0);

            setGuardianId(dataGuardian.id);
            setGuardianViaje({
              id: dataGuardian.viajeId,
              origen: dataGuardian.origen,
              destino: dataGuardian.destino,
              conductor: dataGuardian.conductor,
              placa: dataGuardian.placa,
              carro: dataGuardian.carro
            });
            setGuardianConfig({ email: dataGuardian.email, tiempoMin: dataGuardian.tiempoMin });
            setGuardianHoraInicio(startTime);
            setGuardianTiempoRestante(remaining);
            setGuardianActivo(true);
            if (remaining <= 0 && dataGuardian.estado?.toUpperCase() !== 'ALERTA') {
              setGuardianAlertaEnviada(true);
            }
          }
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
  }, []);

  // Re-fetch data when opening tabs or periodically
  // Re-fetch data when opening tabs or periodically
  useEffect(() => {
    if (!currentUser) return;
    const uId = currentUser.ID_USU || currentUser.id_usu || currentUser.id;

    const refreshTabs = () => {
      // Refresh solicitudes
      if (activePage === 'solicitudes') {
        fetch(`/api/solicitudes/recibidas?usuarioId=${uId}`)
          .then(res => res.json())
          .then(data => setSolicitudesRecibidas(Array.isArray(data) ? data : []))
          .catch(err => console.error(err));
      }
      
      // Refresh mis rutas SIEMPRE en background para detectar cambios de estado y activar el badge
      fetch(`/api/viajes/mis-rutas?usuarioId=${uId}`)
        .then(res => res.json())
        .then(data => {
          if (data && typeof data === 'object') {
            setRutasPublicadas((Array.isArray(data.publicadas) ? data.publicadas : []).sort((a, b) => b.id - a.id));
            setRutasSolicitadas((Array.isArray(data.solicitadas) ? data.solicitadas : []).sort((a, b) => b.id - a.id));
          }
        })
        .catch(err => console.error(err));

      // Refresh chat list SIEMPRE (en background) para detectar nuevos chats tanto
      // para el conductor que acepta como para el pasajero cuya solicitud fue aceptada
      fetch(`/api/mensajes/chats?usuarioId=${uId}`)
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) {
            setMensajes(prev => {
              // Si el usuario está en la pestaña mensajes, marcar como leídos automáticamente
              if (activePage === 'mensajes') {
                setMensajesLeidos(data.length);
              }
              return data;
            });
          }
        })
        .catch(err => console.error(err));

      // Refresh guardian alerts
      if (activePage === 'guardian') {
        if (currentUser?.CORREO_USU || currentUser?.correo_usu) {
          const email = currentUser.CORREO_USU || currentUser.correo_usu;
          fetch(`/api/guardian?email=${email}`)
            .then(res => res.json())
            .then(data => setAlertasRecibidas(Array.isArray(data) ? data : []))
            .catch(err => console.error(err));
        }
      }
    };


    refreshTabs();

    const interval = setInterval(refreshTabs, 10000);
    return () => clearInterval(interval);
  }, [activePage, currentUser]);

  // Cuando el usuario navega HACIA la pestaña de mis-rutas (o actualiza estando en ella), marcar todos como leídos
  useEffect(() => {
    if (activePage === 'mis-rutas' && rutasSolicitadas.length > 0) {
      const updated = {};
      rutasSolicitadas.forEach(r => {
        updated[r.id] = r.estado;
      });
      setRutasSolicitadasLeidas(prev => ({ ...prev, ...updated }));
    }
  }, [activePage, rutasSolicitadas]);

  // Cuando el usuario navega HACIA la pestaña mensajes, marcar todos como leídos
  useEffect(() => {
    if (activePage === 'mensajes') {
      setMensajesLeidos(mensajes.length);
    }
  }, [activePage]);

  // Temporizador del Guardián — SÓLO se reinicia cuando guardianActivo cambia
  useEffect(() => {
    if (!guardianActivo) return;

    const timer = setInterval(() => {
      setGuardianTiempoRestante(prev => {
        const next = prev - 1;

        // 5 minutos antes (300 seg) → pre-alerta
        if (next === 300 && !guardianPreAlertaRef.current) {
          setGuardianPreAlerta(true);
          setShowReadjustModal(true);
          toast('⚠️ ¿Has llegado? Tu tiempo está por terminar.', { duration: 10000, icon: '🔔' });
        }

        // Tiempo agotado → alerta real
        if (next <= 0 && !guardianAlertaEnviadaRef.current) {
          setGuardianAlertaEnviada(true);
          toast.error('🚨 TIEMPO AGOTADO. Alerta activada para tu contacto.', { duration: 15000 });
          // Sincronizar estado con la BD
          const gId = guardianIdRef.current;
          if (gId) {
            fetch('/api/guardian', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id: gId, estado: 'Alerta' })
            });
          }
          clearInterval(timer);
        }

        return Math.max(next, 0);
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [guardianActivo]); // ← SOLO depende de si está activo

  const iniciarGuardian = async (viaje) => {
    if (!guardianConfig.email || !guardianConfig.tiempoMin) {
      toast.error('Configura el correo y tiempo estimado');
      return;
    }

    const uId = currentUser?.ID_USU || currentUser?.id_usu || currentUser?.id;
    const vId = viaje.viajeId || viaje.id;
    
    try {
      const res = await fetch('/api/guardian', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          viajeId: vId,
          usuarioId: uId,
          email: guardianConfig.email.trim().toUpperCase(),
          tiempo: guardianConfig.tiempoMin
        })
      });

      const data = await res.json();
      if (res.ok) {
        const horaInicio = new Date();

        setGuardianId(data.id);
        setGuardianViaje(viaje);
        setGuardianActivo(true);
        setGuardianFinalizado(false);
        setGuardianAlertaEnviada(false);
        setGuardianPreAlerta(false);
        setGuardianHoraInicio(horaInicio);
        setGuardianTiempoRestante(guardianConfig.tiempoMin * 60);
        setGuardianConfigOpen(false);
        toast.success('🛡️ Guardián activado en base de datos. ¡Buen viaje!');
      } else {
        toast.error(`Error (ID: ${vId}): ` + data.error);
      }
    } catch (e) {
      toast.error('Error de conexión con el servidor');
    }
  };


  const finalizarGuardian = async () => {
    if (guardianId) {
      await fetch('/api/guardian', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: guardianId, estado: 'Inactivo' })
      });
    }
    setGuardianActivo(false);
    setGuardianFinalizado(true);
    setGuardianTiempoRestante(0);
    setGuardianId(null);
    toast.success('✅ ¡Llegaste bien! Guardián desactivado.');
  };

  const reajustarTiempo = async () => {
    if (guardianId) {
      await fetch('/api/guardian', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: guardianId, extraTiempo: 15 })
      });
      
      setGuardianTiempoRestante(prev => prev + (15 * 60));
      setGuardianPreAlerta(false);
      setShowReadjustModal(false);
      toast.success('⏱️ Tiempo extendido 15 minutos');
    }
  };


  const formatTiempo = (seg) => {
    const m = Math.floor(seg / 60);
    const s = seg % 60;
    return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  };

  const formatCurrency = (value) => {
    const cleanValue = value.replace(/\D/g, "");
    return cleanValue.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (name === 'valor') {
      setNuevaRuta({ ...nuevaRuta, [name]: formatCurrency(value) });
    } else {
      setNuevaRuta({ ...nuevaRuta, [name]: value.toUpperCase() });
    }
  };

  const fetchChatMsgs = async (chatId) => {
    if (!chatId) return;
    try {
      const res = await fetch(`/api/mensajes?chatId=${chatId}`);
      if (res.ok) {
        const data = await res.json();
        const myId = currentUser?.ID_USU || currentUser?.id_usu || currentUser?.id;
        const formatted = data.map(m => ({
          sender: m.senderId == myId ? 'me' : 'other',
          text: m.text
        }));
        setCurrentChatMsgs(formatted);
      }
    } catch (error) {
      console.error('Error fetching chat', error);
    }
  };

  useEffect(() => {
    let interval;
    if (chatOpen && chatData.chatId) {
      fetchChatMsgs(chatData.chatId);
      interval = setInterval(() => {
        fetchChatMsgs(chatData.chatId);
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [chatOpen, chatData.chatId]);

  const enviarMensajeChat = async () => {
    if (!msgInput.trim() || !chatData.chatId) return;
    const myId = currentUser?.ID_USU || currentUser?.id_usu || currentUser?.id;
    
    // Add locally immediately for fast UI
    const newMsg = { sender: 'me', text: msgInput.trim() };
    setCurrentChatMsgs([...currentChatMsgs, newMsg]);
    setMsgInput('');

    try {
      await fetch('/api/mensajes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatId: chatData.chatId,
          senderId: myId,
          text: newMsg.text
        })
      });
    } catch (e) {
      console.error('Error enviando mensaje', e);
    }
  };

  const buscarViajes = async () => {
    const toastId = toast.loading('Buscando viajes...');
    try {
      const url = new URL('/api/viajes', window.location.origin);
      if (searchParams.origen) url.searchParams.append('origen', searchParams.origen);
      if (searchParams.destino) url.searchParams.append('destino', searchParams.destino);
      
      const res = await fetch(url);
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
    const toastId = toast.loading('Enviando solicitud...');
    try {
      const uId = currentUser?.ID_USU || currentUser?.id_usu || currentUser?.id || 1;
      const res = await fetch('/api/solicitudes', {
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

  const guardarRuta = async (e) => {
    e.preventDefault();
    const toastId = toast.loading('Publicando tu ruta...');
    
    try {
      const uId = currentUser?.ID_USU || currentUser?.id_usu || currentUser?.id || 1;
      const res = await fetch('/api/viajes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...nuevaRuta, usuarioId: uId })
      });
      
      const data = await res.json();
      
      if (res.ok) {
        const nueva = {
          id: data.id,
          ...nuevaRuta
        };
        setRutasPublicadas([...rutasPublicadas, nueva]);
        setIsModalOpen(false);
        setNuevaRuta({ origen: '', destino: '', carro: '', placa: '', fecha: '', puestos: '', valor: '', comentarios: '' });
        toast.success('Ruta publicada correctamente', { id: toastId });
      } else {
        toast.error(data.error || 'Error al publicar', { id: toastId });
      }
    } catch (error) {
      toast.error('Error de conexión', { id: toastId });
    }
  };

  const gestionarSolicitud = async (id, estado) => {
    const toastId = toast.loading(estado === 'Aceptado' ? 'Aceptando solicitud...' : 'Rechazando solicitud...');
    try {
      const res = await fetch('/api/solicitudes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ solicitudId: id, estado })
      });
      if (res.ok) {
        setSolicitudesRecibidas(solicitudesRecibidas.filter(s => s.id !== id));
        toast.success(`Solicitud ${estado.toLowerCase()}`, { id: toastId });
        
        // Refresh chat list immediately if accepted
        if (estado === 'Aceptado') {
          const uId = currentUser?.ID_USU || currentUser?.id_usu || currentUser?.id;
          if (uId) {
            fetch(`/api/mensajes/chats?usuarioId=${uId}`)
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

  const getBadgeCount = (url) => {
    if (url === '/solicitudes') {
      return solicitudesRecibidas.length;
    }
    if (url === '/mis-rutas') {
      return activePage !== 'mis-rutas'
        ? rutasSolicitadas.filter(r => {
            const esCambio = r.estado?.toUpperCase().startsWith('ACEPTAD') || r.estado?.toUpperCase().startsWith('RECHAZAD');
            if (!esCambio) return false;
            // Mostrar badge solo si el estado actual es diferente al que el usuario vio/leyó
            return rutasSolicitadasLeidas[r.id] !== r.estado;
          }).length
        : 0;
    }
    if (url === '/mensajes') {
      // Mostrar la cantidad de chats NUEVOS que aún no ha visto
      const nuevos = mensajes.length - mensajesLeidos;
      return activePage !== 'mensajes' && nuevos > 0 ? nuevos : 0;
    }
    if (url === '/guardian') {
      return alertasRecibidas.filter(a => a.estado?.toUpperCase() === 'ALERTA').length;
    }
    return 0;
  };

  // Construir navItems dinámicamente desde la BD (MENUS)
  const navItems = menuItems.length > 0 && userPermisos !== null
    ? menuItems
        .filter(m => {
          if (!m.parentId && m.id !== 1) return userPermisos.includes(m.url);
          if (m.id === 1) return userPermisos.includes('/inicio/crear') || userPermisos.includes('/inicio/buscar') || userPermisos.includes('/inicio');
          return false;
        })
        .map(m => ({
          id: m.url ? m.url.replace('/', '') : m.id,
          label: m.label,
          icon: MENU_ICONS[m.url] || 'M3 12h18M3 6h18M3 18h18',
          badge: getBadgeCount(m.url),
        }))
    : [
        { id: 'inicio',      label: 'Inicio',      icon: MENU_ICONS['/inicio'],      badge: 0 },
        { id: 'mis-rutas',   label: 'Mis Rutas',   icon: MENU_ICONS['/mis-rutas'],   badge: getBadgeCount('/mis-rutas') },
        { id: 'solicitudes', label: 'Solicitudes',  icon: MENU_ICONS['/solicitudes'], badge: getBadgeCount('/solicitudes') },
        { id: 'mensajes',    label: 'Mensajes',     icon: MENU_ICONS['/mensajes'],    badge: getBadgeCount('/mensajes') },
        { id: 'guardian',    label: 'Guardian',     icon: MENU_ICONS['/guardian'],    badge: getBadgeCount('/guardian') },
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
          <div key={item.id} className={`mobile-item ${activePage === item.id ? 'active' : ''}`} onClick={() => setActivePage(item.id)}>
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
              <div key={item.id} className={`nav-item ${activePage === item.id ? 'active' : ''}`} onClick={() => setActivePage(item.id)}>
                <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d={item.icon} /></svg>
                {item.label}
                {item.badge > 0 && <span style={{ background: 'var(--red)', color: '#fff', borderRadius: '10px', padding: '1px 6px', fontSize: '0.7rem', marginLeft: 'auto' }}>{item.badge}</span>}
              </div>
            ))
          )}
        </nav>

        <div style={{ padding: '1.5rem', borderTop: '1px solid var(--border)' }}>
          <button 
            onClick={() => { localStorage.removeItem('user'); router.push('/'); }} 
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
          <section>
            <div className="page-header">
              <div><h1 style={{ fontFamily: 'Syne', fontWeight: 800 }}>¡Hola, {currentUser?.NOMBRE_USU || currentUser?.nombre_usu || 'Pasajero'}! 👋</h1><p style={{ color: 'var(--muted)' }}>Tu movilidad en Colombia simplificada</p></div>
            </div>

            
            <div className="grid-2" style={{ 
              display: 'grid', 
              gridTemplateColumns: '1fr 1fr', 
              gap: '2rem', 
              alignItems: 'stretch' 
            }}>
              {/* CREAR RUTA */}
              <div style={{ background: 'var(--surface)', padding: '2.5rem', borderRadius: '32px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: '1rem' }}>
                <div style={{ width: '64px', height: '64px', background: 'rgba(229,34,34,0.1)', borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--red)', marginBottom: '0.5rem' }}>
                  <svg width="32" height="32" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>
                </div>
                <h3 style={{ fontFamily: 'Syne', fontSize: '1.4rem', fontWeight: 800 }}>¿Vas a conducir?</h3>
                <p style={{ color: 'var(--muted)', fontSize: '0.95rem', lineHeight: '1.6', maxWidth: '280px' }}>
                  Publica tu viaje, ahorra en combustible y ayuda a otros a llegar a su destino.
                </p>
                <button 
                  className="btn-red" 
                  style={{ width: '100%', maxWidth: '240px', justifyContent: 'center', padding: '1rem', marginTop: '0.5rem' }} 
                  onClick={() => setIsModalOpen(true)}
                  disabled={userPermisos !== null && !userPermisos.includes('/inicio/crear')}
                >
                  Crear nueva ruta
                </button>
              </div>

              {/* BUSCAR RUTA */}
              <div style={{ background: 'var(--surface)', padding: '2.5rem', borderRadius: '32px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '0.2rem' }}>
                  <div style={{ width: '40px', height: '40px', background: 'rgba(255,255,255,0.05)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--red)' }}>
                    <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
                  </div>
                  <h3 style={{ fontFamily: 'Syne', fontSize: '1.4rem', fontWeight: 800 }}>¿Buscas un viaje?</h3>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <Autocomplete placeholder="Origen" value={searchParams.origen} opciones={municipiosDB} onChange={(val) => setSearchParams({...searchParams, origen: val.toUpperCase()})} />
                  <Autocomplete placeholder="Destino" value={searchParams.destino} opciones={municipiosDB} onChange={(val) => setSearchParams({...searchParams, destino: val.toUpperCase()})} />
                  <button 
                    className="btn-red" 
                    style={{ width: '100%', justifyContent: 'center', padding: '1rem', marginTop: '0.5rem' }} 
                    onClick={() => { buscarViajes(); setActivePage('buscar'); }}
                    disabled={userPermisos !== null && !userPermisos.includes('/inicio/buscar')}
                  >
                    Buscar rutas disponibles
                  </button>
                </div>
              </div>
            </div>
          </section>
        )}

        {activePage === 'buscar' && (
          <section>
            <div className="page-header">
              <div><h1>Resultados de búsqueda</h1><p style={{ color: 'var(--muted)' }}>Viajes disponibles para tu ruta</p></div>
              <button className="btn-red" onClick={() => setActivePage('inicio')}>Volver</button>
            </div>
            <div className="resultados-lista">
              {resultados.length > 0 ? resultados.map(viaje => (
                <div className="route-card" key={viaje.id}>
                  <div>
                    <strong>{viaje.origen} → {viaje.destino}</strong>
                    <p style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>Conductor: {viaje.conductor} • {viaje.hora}</p>
                    <button style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', fontSize: '0.8rem', padding: '5px 0', fontWeight: 'bold' }} onClick={() => {setViajeDetalle(viaje); setDetallesModalOpen(true)}}>Ver Detalles</button>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ color: 'var(--red)', fontWeight: '800' }}>${viaje.valor}</span><br/>
                    <button className="btn-red" style={{ padding: '6px 15px', fontSize: '0.8rem', marginTop: '8px' }} onClick={() => solicitarViaje(viaje.id)} disabled={solicitados.includes(viaje.id)}>{solicitados.includes(viaje.id) ? 'Pendiente' : 'Solicitar'}</button>
                  </div>
                </div>
              )) : <p style={{ color: 'var(--muted)' }}>No se encontraron viajes con esos criterios.</p>}
            </div>
          </section>
        )}

        {activePage === 'mis-rutas' && (
          <section>
            <div className="page-header">
              <div>
                <h1 style={{ fontFamily: 'Syne', fontWeight: 800 }}>Mis Rutas</h1>
                <p style={{ color: 'var(--muted)' }}>Gestiona tus viajes publicados y solicitudes enviadas</p>
              </div>
            </div>
            <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginTop: '2rem' }}>
              <div>
                <h3 style={{ color: 'var(--muted)', fontSize: '0.9rem', marginBottom: '1rem' }}>RUTAS PUBLICADAS</h3>
                {rutasPublicadas.map(r => (
                  <div key={r.id} className="route-card">
                    <div><strong>{r.origen} → {r.destino}</strong><p style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>Placa: {r.placa} • {r.fecha}</p></div>
                  </div>
                ))}
              </div>
              <div>
                <h3 style={{ color: 'var(--muted)', fontSize: '0.9rem', marginBottom: '1rem' }}>RUTAS SOLICITADAS</h3>
                {rutasSolicitadas.map(r => (
                  <div key={r.id} className="route-card">
                    <div><strong>{r.origen} → {r.destino}</strong><p style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>Conductor: {r.conductor} • {r.fecha}</p></div>
                    <span className={`badge-status ${r.estado}`}>{r.estado}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {activePage === 'solicitudes' && (
          <section>
            <div className="page-header">
              <div>
                <h1 style={{ fontFamily: 'Syne', fontWeight: 800 }}>Solicitudes Recibidas</h1>
                <p style={{ color: 'var(--muted)' }}>Gestiona quiénes viajarán contigo en tus próximas rutas</p>
              </div>
            </div>
            {solicitudesRecibidas.map(s => (
              <div key={s.id} className="route-card">
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                  <div style={{ width: 40, height: 40, background: 'var(--red)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{s.avatar}</div>
                  <div><strong>{s.pasajero}</strong><p style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>Ruta: {s.ruta}</p></div>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button onClick={() => aceptarSolicitud(s.id)} style={{ background: '#4ade80', border: 'none', padding: '8px 15px', borderRadius: '8px', fontWeight: 'bold' }}>Aceptar</button>
                  <button onClick={() => rechazarSolicitud(s.id)} style={{ background: 'rgba(255,255,255,0.1)', color: '#fff', border: 'none', padding: '8px 15px', borderRadius: '8px' }}>Rechazar</button>
                </div>
              </div>
            ))}
          </section>
        )}

        {activePage === 'mensajes' && (
          <section>
            <div className="page-header">
              <div>
                <h1 style={{ fontFamily: 'Syne', fontWeight: 800 }}>Mensajes</h1>
                <p style={{ color: 'var(--muted)' }}>Coordina los detalles del encuentro con tus compañeros de viaje</p>
              </div>
            </div>
            {mensajes.length > 0 ? mensajes.map((chat) => (
              <div key={chat.chatId} className="route-card" onClick={() => {setChatData({name: chat.nombre, avatar: chat.nombre.charAt(0), chatId: chat.chatId}); setCurrentChatMsgs([]); setChatOpen(true)}} style={{ cursor: 'pointer' }}>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <div style={{ width: 45, height: 45, background: '#333', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--red)' }}>{chat.nombre.charAt(0)}</div>
                  <div><strong>{chat.nombre}</strong><p style={{ fontSize: '0.8rem', color: 'var(--red)' }}>Viaje: {chat.ruta} ({chat.fecha})</p></div>
                </div>
              </div>
            )) : <p style={{ color: 'var(--muted)' }}>No tienes chats activos de próximos viajes.</p>}
            {chatOpen && (
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '20px', height: '400px', display: 'flex', flexDirection: 'column', marginTop: '1rem' }}>
                <div style={{ padding: '1rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}><strong>Chat con {chatData.name}</strong><button onClick={() => setChatOpen(false)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}>✕</button></div>
                
                <div style={{ flex: 1, padding: '1.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {currentChatMsgs.length === 0 ? (
                    <div style={{ margin: 'auto' }}>
                      <p style={{ textAlign: 'center', color: 'var(--muted)', fontSize: '0.8rem' }}>Inicia la conversación para acordar el punto de encuentro.</p>
                    </div>
                  ) : (
                    currentChatMsgs.map((msg, i) => (
                      <div key={i} style={{ 
                        background: msg.sender === 'me' ? 'var(--red)' : '#333', 
                        color: '#fff', 
                        padding: '10px', 
                        borderRadius: '12px', 
                        maxWidth: '80%', 
                        alignSelf: msg.sender === 'me' ? 'flex-end' : 'flex-start', 
                        borderBottomRightRadius: msg.sender === 'me' ? '2px' : '12px',
                        borderBottomLeftRadius: msg.sender === 'me' ? '12px' : '2px'
                      }}>
                        {msg.text}
                      </div>
                    ))
                  )}
                </div>
                
                <div style={{ padding: '1rem', display: 'flex', gap: '10px' }}>
                  <input 
                    placeholder="Escribe..." 
                    value={msgInput}
                    onChange={(e) => setMsgInput(e.target.value)}
                    onKeyDown={(e) => { if(e.key === 'Enter') enviarMensajeChat(); }}
                    style={{ flex: 1, background: 'var(--bg)', border: '1px solid var(--border)', padding: '10px', borderRadius: '10px', color: '#fff', outline: 'none' }} 
                  />
                  <button className="btn-red" onClick={enviarMensajeChat}>Enviar</button>
                </div>
              </div>
            )}
          </section>
        )}

        {activePage === 'guardian' && (
          <section>
            <div className="page-header">
              <div>
                <h1 style={{ fontFamily: 'Syne', fontWeight: 800 }}>🛡️ Guardián de Ruta</h1>
                <p style={{ color: 'var(--muted)' }}>Protege tu viaje. Tu contacto de confianza será alertado si no confirmas tu llegada.</p>
              </div>
            </div>

            {guardianActivo && guardianViaje && (
              <div style={{ background: 'linear-gradient(135deg, rgba(229,34,34,0.08), rgba(229,34,34,0.02))', border: '2px solid rgba(229,34,34,0.3)', borderRadius: '24px', padding: '2rem', marginBottom: '2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                  <h3 style={{ fontFamily: 'Syne', fontSize: '1.2rem' }}>Viaje en Curso</h3>
                  <span style={{ background: guardianTiempoRestante <= 300 ? 'rgba(255,50,50,0.2)' : 'rgba(74,222,128,0.1)', color: guardianTiempoRestante <= 300 ? '#ff4444' : '#4ade80', padding: '6px 14px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 'bold' }}>
                    {guardianTiempoRestante <= 0 ? '⚠️ TIEMPO AGOTADO' : guardianTiempoRestante <= 300 ? '⚠️ POR EXPIRAR' : '✅ EN CAMINO'}
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                  <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '14px', border: '1px solid var(--border)' }}>
                    <p style={{ color: 'var(--muted)', fontSize: '0.7rem', marginBottom: '4px' }}>RUTA</p>
                    <strong>{guardianViaje.origen} → {guardianViaje.destino}</strong>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '14px', border: '1px solid var(--border)' }}>
                    <p style={{ color: 'var(--muted)', fontSize: '0.7rem', marginBottom: '4px' }}>CONDUCTOR</p>
                    <strong>{guardianViaje.conductor}</strong>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '14px', border: '1px solid var(--border)' }}>
                    <p style={{ color: 'var(--muted)', fontSize: '0.7rem', marginBottom: '4px' }}>PLACA</p>
                    <strong style={{ color: 'var(--red)', letterSpacing: '2px' }}>{guardianViaje.placa}</strong>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '14px', border: '1px solid var(--border)' }}>
                    <p style={{ color: 'var(--muted)', fontSize: '0.7rem', marginBottom: '4px' }}>CONTACTO ALERTA</p>
                    <strong style={{ fontSize: '0.85rem' }}>{guardianConfig.email}</strong>
                  </div>
                </div>
                <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                  <p style={{ color: 'var(--muted)', fontSize: '0.8rem', marginBottom: '8px' }}>Tiempo restante para confirmar llegada</p>
                  <div style={{ fontFamily: 'Syne', fontSize: '3.5rem', fontWeight: 800, color: guardianTiempoRestante <= 300 ? '#ff4444' : '#fff', letterSpacing: '4px', textShadow: guardianTiempoRestante <= 300 ? '0 0 20px rgba(255,50,50,0.4)' : 'none', transition: 'color 0.5s' }}>
                    {formatTiempo(guardianTiempoRestante)}
                  </div>
                  {guardianHoraInicio && <p style={{ color: 'var(--muted)', fontSize: '0.75rem', marginTop: '8px' }}>Iniciado: {guardianHoraInicio.toLocaleTimeString()}</p>}
                </div>
                {guardianAlertaEnviada && (
                  <div style={{ background: 'rgba(255,50,50,0.1)', border: '1px solid rgba(255,50,50,0.3)', borderRadius: '14px', padding: '1rem', marginBottom: '1rem', textAlign: 'center' }}>
                    <p style={{ color: '#ff4444', fontWeight: 'bold', fontSize: '0.9rem' }}>🚨 ALERTA ENVIADA</p>
                    <p style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>Se envió una alerta a {guardianConfig.email} con los detalles: Ruta {guardianViaje.origen} → {guardianViaje.destino}, Placa {guardianViaje.placa}, Conductor {guardianViaje.conductor}, Inicio {guardianHoraInicio?.toLocaleTimeString()}</p>
                  </div>
                )}
                {guardianPreAlerta && !guardianAlertaEnviada && (
                  <div style={{ background: 'rgba(250,204,21,0.08)', border: '1px solid rgba(250,204,21,0.3)', borderRadius: '14px', padding: '1rem', marginBottom: '1rem', textAlign: 'center' }}>
                    <p style={{ color: '#facc15', fontWeight: 'bold' }}>⚠️ Tu viaje está por finalizar</p>
                    <p style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>Confirma tu llegada para evitar alertar a tu contacto de confianza.</p>
                  </div>
                )}
                <button className="btn-red" onClick={finalizarGuardian} style={{ width: '100%', justifyContent: 'center', padding: '1.2rem', fontSize: '1.1rem', borderRadius: '16px' }}>
                  ✅ He llegado a mi destino
                </button>
              </div>
            )}

            {!guardianActivo && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                <div>
                  <h3 style={{ color: 'var(--muted)', fontSize: '0.85rem', marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '1px' }}>🛡️ Proteger mi viaje (Hoy)</h3>
                  {(() => {
                    const d = new Date();
                    const todayStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                    const viajesHoy = rutasSolicitadas.filter(r => (r.estado?.toUpperCase().startsWith('ACEPTAD')) && r.fecha === todayStr);
                    
                    return viajesHoy.length === 0 ? (
                    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '20px', padding: '2rem', textAlign: 'center' }}>
                      <p style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>No tienes viajes aceptados para el día de hoy.</p>
                    </div>
                  ) : (
                    viajesHoy.map(viaje => (


                      <div key={viaje.id} className="route-card" style={{ cursor: 'pointer' }} onClick={() => { setGuardianViaje(viaje); setGuardianConfigOpen(true); }}>
                        <div>
                          <strong>{viaje.origen} → {viaje.destino}</strong>
                          <p style={{ color: 'var(--muted)', fontSize: '0.75rem' }}>{viaje.conductor} • {viaje.placa}</p>
                        </div>
                        <div style={{ background: 'rgba(229,34,34,0.1)', color: 'var(--red)', padding: '6px 12px', borderRadius: '8px', fontWeight: 'bold', fontSize: '0.75rem' }}>Activar</div>
                      </div>
                    ))
                  ); })()}
                </div>

                <div>
                  <h3 style={{ color: 'var(--muted)', fontSize: '0.85rem', marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '1px' }}>🚨 Alertas de Seguridad (Soy Guardián)</h3>
                  {alertasRecibidas.length === 0 ? (
                    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '20px', padding: '2rem', textAlign: 'center' }}>
                      <p style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>No tienes alertas de seguridad activas de tus contactos.</p>
                    </div>
                  ) : (
                    alertasRecibidas.map(alerta => (
                      <div key={alerta.id} className="route-card" style={{ border: alerta.estado?.toUpperCase() === 'ALERTA' ? '1px solid var(--red)' : '1px solid var(--border)', background: alerta.estado?.toUpperCase() === 'ALERTA' ? 'rgba(229,34,34,0.05)' : 'var(--card)' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                             <strong style={{ color: alerta.estado?.toUpperCase() === 'ALERTA' ? 'var(--red)' : '#fff' }}>{alerta.estado?.toUpperCase() === 'ALERTA' ? '⚠️ ALERTA: ' : '✅ EN RUTA: '}{alerta.pasajero}</strong>
                             <span style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>{alerta.inicio}</span>
                          </div>
                          <p style={{ fontSize: '0.85rem', margin: '4px 0' }}>{alerta.origen} → {alerta.destino}</p>
                          <div style={{ fontSize: '0.75rem', color: 'var(--muted)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px' }}>
                            <span>🚗 {alerta.carro}</span>
                            <span>🔢 {alerta.placa}</span>
                            <span>👤 Cond: {alerta.conductor}</span>
                            <span>⏱️ Tiempo: {alerta.tiempo} min</span>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}


            {guardianConfigOpen && guardianViaje && (
              <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '20px' }}>
                <div style={{ 
                  background: 'var(--surface)', 
                  width: '100%', 
                  maxWidth: '480px', 
                  maxHeight: '90vh',
                  overflowY: 'auto',
                  borderRadius: '24px', 
                  border: '1px solid var(--border)', 
                  padding: '2rem', 
                  position: 'relative',
                  boxShadow: '0 20px 50px rgba(0,0,0,0.5)'
                }}>
                  <button 
                    onClick={() => setGuardianConfigOpen(false)} 
                    style={{ 
                      position: 'absolute', top: '15px', right: '15px', 
                      background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', 
                      color: '#fff', cursor: 'pointer', fontSize: '1rem',
                      width: '32px', height: '32px', borderRadius: '50%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      zIndex: 10
                    }}
                  >✕</button>
                  <h2 style={{ fontFamily: 'Syne', fontSize: '1.4rem', fontWeight: 800, marginBottom: '0.5rem', color: 'var(--red)' }}>🛡️ Configurar Guardián</h2>
                  <p style={{ color: 'var(--muted)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>Configura tu red de seguridad antes de iniciar el viaje.</p>


                  <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '14px', border: '1px solid var(--border)', marginBottom: '1.5rem' }}>
                    <p style={{ fontWeight: 'bold', marginBottom: '8px' }}>{guardianViaje.origen} → {guardianViaje.destino}</p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.8rem', color: 'var(--muted)' }}>
                      <span>🚗 Vehículo: <strong style={{ color: '#fff' }}>{guardianViaje.carro || 'N/A'}</strong></span>
                      <span>🔢 Placa: <strong style={{ color: '#fff' }}>{guardianViaje.placa || 'N/A'}</strong></span>
                      <span>👤 {guardianViaje.conductor}</span>
                      <span>📅 {guardianViaje.fecha}</span>
                    </div>
                  </div>


                  <div style={{ background: 'rgba(250,204,21,0.06)', border: '1px solid rgba(250,204,21,0.2)', borderRadius: '14px', padding: '1rem', marginBottom: '1.5rem' }}>
                    <p style={{ color: '#facc15', fontWeight: 'bold', fontSize: '0.85rem', marginBottom: '4px' }}>⚠️ Verificación de Seguridad</p>
                    <p style={{ color: 'var(--muted)', fontSize: '0.8rem', lineHeight: '1.5' }}>Solo aborda el vehículo si coincide con la placa <strong style={{ color: '#fff' }}>{guardianViaje.placa}</strong> y la descripción <strong style={{ color: '#fff' }}>{guardianViaje.carro || 'indicada'}</strong>.</p>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--muted)', marginBottom: '8px' }}>📧 Correo del contacto de confianza</label>
                      <input 
                        className="search-input" 
                        type="email" 
                        placeholder="ejemplo@correo.com" 
                        value={guardianConfig.email} 
                        onChange={(e) => setGuardianConfig({...guardianConfig, email: e.target.value})} 
                        style={{ padding: '12px 16px' }}
                        required 
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--muted)', marginBottom: '8px' }}>⏱️ Tiempo estimado del viaje (minutos)</label>
                      <input 
                        className="search-input" 
                        type="number" 
                        min="5" 
                        max="600" 
                        placeholder="30" 
                        value={guardianConfig.tiempoMin} 
                        onChange={(e) => setGuardianConfig({...guardianConfig, tiempoMin: parseInt(e.target.value) || 0})} 
                        style={{ padding: '12px 16px' }}
                        required 
                      />
                    </div>
                  </div>

                  <div style={{ background: 'rgba(229,34,34,0.04)', border: '1px solid rgba(229,34,34,0.1)', borderRadius: '16px', padding: '1.2rem', marginTop: '1.5rem', fontSize: '0.8rem', color: 'var(--muted)', lineHeight: '1.6' }}>
                    <strong style={{ color: '#fff', display: 'block', marginBottom: '8px', fontSize: '0.9rem' }}>¿Cómo funciona?</strong>
                    <ul style={{ paddingLeft: '1.2rem', margin: 0 }}>
                      <li>Al iniciar, se activa un temporizador en tiempo real.</li>
                      <li>5 min antes de expirar: recibirás un aviso para confirmar tu llegada.</li>
                      <li>Si no confirmas a tiempo: se envía una alerta a tu contacto con los detalles del vehículo y conductor.</li>
                    </ul>
                  </div>

                  <button className="btn-red" onClick={() => iniciarGuardian(guardianViaje)} style={{ width: '100%', justifyContent: 'center', marginTop: '1.5rem', padding: '1.2rem', fontSize: '1.1rem', borderRadius: '14px', boxShadow: '0 10px 20px rgba(229,34,34,0.2)' }}>
                    🛡️ Iniciar Viaje Seguro
                  </button>

                </div>
              </div>
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

        {isModalOpen && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
            <div style={{ background: 'var(--surface)', width: '100%', maxWidth: '550px', borderRadius: '24px', border: '1px solid var(--border)', padding: '2.5rem', position: 'relative' }}>
              <button onClick={() => setIsModalOpen(false)} style={{ position: 'absolute', top: '20px', right: '20px', background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '1.2rem' }}>✕</button>
              <h2 style={{ fontFamily: 'Syne', fontSize: '1.6rem', fontWeight: 800, marginBottom: '1.5rem', color: 'var(--red)' }}>Publicar nuevo viaje</h2>
              <form onSubmit={guardarRuta} style={{ display: 'grid', gap: '1rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <Autocomplete placeholder="Origen" value={nuevaRuta.origen} opciones={municipiosDB} onChange={(val) => setNuevaRuta({...nuevaRuta, origen: val.toUpperCase()})} />
                  <Autocomplete placeholder="Destino" value={nuevaRuta.destino} opciones={municipiosDB} onChange={(val) => setNuevaRuta({...nuevaRuta, destino: val.toUpperCase()})} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <select
                    name="marca"
                    className="search-input"
                    value={nuevaRuta.marca}
                    onChange={(e) => setNuevaRuta({...nuevaRuta, marca: e.target.value, carro: e.target.value})}
                    required
                    style={{ cursor: 'pointer' }}
                  >
                    <option value="">Marca del vehículo</option>
                    {marcas.map(m => (
                      <option key={m.id || m.ID_MAR} value={m.nombre || m.NOMBRE_MAR}>
                        {m.nombre || m.NOMBRE_MAR}
                      </option>
                    ))}
                  </select>
                  <input name="placa" className="search-input" placeholder="Placa (Ej: XYZ123)" value={nuevaRuta.placa} onChange={handleInputChange} required />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <input type="date" name="fecha" className="search-input" onChange={handleInputChange} required />
                  <input type="number" name="puestos" className="search-input" placeholder="Puestos" onChange={handleInputChange} required />
                </div>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', fontSize: '0.85rem' }}>$</span>
                  <input name="valor" className="search-input" placeholder="Valor por persona" value={nuevaRuta.valor} onChange={handleInputChange} required style={{ paddingLeft: '25px' }} />
                </div>
                <textarea name="comentarios" className="search-input" placeholder="Comentarios extras (Ej: NO MASCOTAS, MALETA PEQUEÑA...)" value={nuevaRuta.comentarios} onChange={handleInputChange} style={{ minHeight: '80px', fontFamily: 'inherit' }} />
                <button type="submit" className="btn-red" style={{ width: '100%', justifyContent: 'center', marginTop: '1rem', padding: '1rem' }}>Publicar Viaje</button>
              </form>
            </div>
          </div>
        )}

        {detallesModalOpen && viajeDetalle && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
            <div style={{ background: 'var(--surface)', width: '100%', maxWidth: '450px', borderRadius: '24px', border: '1px solid var(--border)', padding: '2.5rem', position: 'relative' }}>
              <button onClick={() => setDetallesModalOpen(false)} style={{ position: 'absolute', top: '20px', right: '20px', background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '1.2rem' }}>✕</button>
              <h2 style={{ fontFamily: 'Syne', marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '10px' }}>Detalles del Viaje</h2>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.95rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--muted)' }}>Ruta:</span> <strong>{viajeDetalle.origen} → {viajeDetalle.destino}</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--muted)' }}>Conductor:</span> <strong>{viajeDetalle.conductor}</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--muted)' }}>Vehículo:</span> <strong>{viajeDetalle.carro || 'N/A'}</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--muted)' }}>Fecha:</span> <strong>{viajeDetalle.hora}</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--muted)' }}>Puestos Disp:</span> <strong>{viajeDetalle.puestos}</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--muted)' }}>Valor:</span> <strong style={{ color: 'var(--red)' }}>${viajeDetalle.valor}</strong></div>
                
                <div style={{ marginTop: '1rem', background: 'rgba(255,255,255,0.03)', padding: '15px', borderRadius: '12px', border: '1px solid var(--border)' }}>
                  <span style={{ color: 'var(--red)', fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>Comentarios del conductor:</span>
                  <p style={{ color: '#fff', margin: 0, fontStyle: 'italic' }}>{viajeDetalle.comentarios || 'Sin comentarios adicionales.'}</p>
                </div>
              </div>

              <button className="btn-red" style={{ width: '100%', justifyContent: 'center', marginTop: '2rem' }} onClick={() => { setDetallesModalOpen(false); solicitarViaje(viajeDetalle.id); }} disabled={solicitados.includes(viajeDetalle.id)}>
                {solicitados.includes(viajeDetalle.id) ? 'Solicitud Pendiente' : 'Solicitar Cupo'}
              </button>
            </div>
          </div>
        )}
        {showReadjustModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: '20px' }}>
            <div style={{ background: 'var(--surface)', width: '100%', maxWidth: '400px', borderRadius: '24px', border: '1px solid var(--red)', padding: '2.5rem', textAlign: 'center' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</div>
              <h2 style={{ fontFamily: 'Syne', fontSize: '1.5rem', marginBottom: '1rem' }}>¿Has llegado a tu destino?</h2>
              <p style={{ color: 'var(--muted)', fontSize: '0.9rem', marginBottom: '2rem' }}>Tu tiempo está por terminar. Confirma tu llegada o solicita más tiempo si hay retrasos en la ruta.</p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <button className="btn-red" onClick={finalizarGuardian} style={{ width: '100%', justifyContent: 'center', padding: '1rem' }}>✅ Sí, he llegado</button>
                <button onClick={reajustarTiempo} style={{ background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid var(--border)', width: '100%', padding: '1rem', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold' }}>🕒 No, hay retraso (+15 min)</button>
              </div>
            </div>
          </div>
        )}
      </main>
      </div>
    </HydrationWrapper>
  );
}