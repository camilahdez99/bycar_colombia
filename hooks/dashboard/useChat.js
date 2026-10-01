'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { fetchConSesion } from '@/lib/client/sessionFetch';
import { getUserId } from '@/lib/client/usuario';
import { iniciarIntervaloVisible } from '@/lib/client/intervaloVisible';

const REFRESCO_CHAT_MS = 3000;

/**
 * Chat abierto en la pestaña Mensajes: historial con refresco cada 3 s mientras está abierto
 * y la pestaña del navegador visible, campo de texto y envío con descarte si falla.
 */
export function useChat(currentUser) {
  const [chatOpen, setChatOpen] = useState(false);
  const [chatData, setChatData] = useState({ name: '', avatar: '', chatId: null });
  const [currentChatMsgs, setCurrentChatMsgs] = useState([]);
  const [msgInput, setMsgInput] = useState('');

  const fetchChatMsgs = useCallback(async (chatId) => {
    if (!chatId) return;
    try {
      const res = await fetchConSesion(`/api/mensajes?chatId=${chatId}`);
      if (res.ok) {
        const data = await res.json();
        const myId = getUserId(currentUser);
        const formatted = data.map(m => ({
          sender: m.senderId == myId ? 'me' : 'other',
          text: m.text
        }));
        setCurrentChatMsgs(formatted);
      }
    } catch (error) {
      console.error('Error fetching chat', error);
    }
  }, [currentUser]);

  // Refresco del chat abierto. El primer pedido lo hace abrirChat: hacerlo acá era un setState
  // en cascada dentro del efecto (DT-38)
  useEffect(() => {
    if (!chatOpen || !chatData.chatId) return;
    return iniciarIntervaloVisible(() => fetchChatMsgs(chatData.chatId), REFRESCO_CHAT_MS);
  }, [chatOpen, chatData.chatId, fetchChatMsgs]);

  const enviarMensaje = async () => {
    if (!msgInput.trim() || !chatData.chatId) return;
    const myId = getUserId(currentUser);
    
    // Add locally immediately for fast UI
    const newMsg = { sender: 'me', text: msgInput.trim() };
    setCurrentChatMsgs([...currentChatMsgs, newMsg]);
    setMsgInput('');

    // Si el envío falla, el mensaje no queda como enviado: se saca y vuelve al input (BUGS F29)
    const descartarMensaje = () => {
      setCurrentChatMsgs(prev => prev.filter(m => m !== newMsg));
      setMsgInput(newMsg.text);
      toast.error('No se pudo enviar el mensaje');
    };

    try {
      const res = await fetchConSesion('/api/mensajes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatId: chatData.chatId,
          senderId: myId,
          text: newMsg.text
        })
      });
      if (!res.ok) descartarMensaje();
    } catch (e) {
      console.error('Error enviando mensaje', e);
      descartarMensaje();
    }
  };

  const abrirChat = (chat) => {
    // Tocar el chat que ya está abierto no hace nada: antes vaciaba la conversación hasta el
    // siguiente refresco (BUGS F41)
    if (chatOpen && chatData.chatId === chat.chatId) return;
    setChatData({ name: chat.nombre, avatar: chat.nombre.charAt(0), chatId: chat.chatId });
    setCurrentChatMsgs([]);
    setChatOpen(true);
    fetchChatMsgs(chat.chatId);
  };

  const cerrarChat = () => setChatOpen(false);

  return { chatOpen, chatData, currentChatMsgs, msgInput, setMsgInput, abrirChat, cerrarChat, enviarMensaje };
}
