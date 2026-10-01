'use client';

import { useState, useEffect } from 'react';
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

  const fetchChatMsgs = async (chatId) => {
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
  };

  useEffect(() => {
    if (!chatOpen || !chatData.chatId) return;
    fetchChatMsgs(chatData.chatId);
    return iniciarIntervaloVisible(() => fetchChatMsgs(chatData.chatId), REFRESCO_CHAT_MS);
  }, [chatOpen, chatData.chatId]);

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
    setChatData({ name: chat.nombre, avatar: chat.nombre.charAt(0), chatId: chat.chatId });
    setCurrentChatMsgs([]);
    setChatOpen(true);
  };

  const cerrarChat = () => setChatOpen(false);

  return { chatOpen, chatData, currentChatMsgs, msgInput, setMsgInput, abrirChat, cerrarChat, enviarMensaje };
}
