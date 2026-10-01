'use client';

import React from 'react';

/**
 * Pestaña "Mensajes": lista de chats y la conversación abierta. El estado del chat y su
 * refresco viven en la página; acá solo se renderiza y se avisa por callbacks.
 */
export default function MensajesTab({
  mensajes, chatOpen, chatData, currentChatMsgs, msgInput,
  onAbrirChat, onCerrarChat, onMsgInputChange, onEnviar,
}) {
  return (
    <section>
      <div className="page-header">
        <div>
          <h1 style={{ fontFamily: 'Syne', fontWeight: 800 }}>Mensajes</h1>
          <p style={{ color: 'var(--muted)' }}>Coordina los detalles del encuentro con tus compañeros de viaje</p>
        </div>
      </div>
      {mensajes.length > 0 ? mensajes.map((chat) => (
        <div key={chat.chatId} className="route-card" onClick={() => onAbrirChat(chat)} style={{ cursor: 'pointer' }}>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <div style={{ width: 45, height: 45, background: '#333', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--red)' }}>{chat.nombre.charAt(0)}</div>
            <div><strong>{chat.nombre}</strong><p style={{ fontSize: '0.8rem', color: 'var(--red)' }}>Viaje: {chat.ruta} ({chat.fecha})</p></div>
          </div>
        </div>
      )) : <p style={{ color: 'var(--muted)' }}>No tienes chats activos de próximos viajes.</p>}
      {chatOpen && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '20px', height: '400px', display: 'flex', flexDirection: 'column', marginTop: '1rem' }}>
          <div style={{ padding: '1rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}><strong>Chat con {chatData.name}</strong><button onClick={onCerrarChat} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}>✕</button></div>
          
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
              onChange={(e) => onMsgInputChange(e.target.value)}
              onKeyDown={(e) => { if(e.key === 'Enter') onEnviar(); }}
              style={{ flex: 1, background: 'var(--bg)', border: '1px solid var(--border)', padding: '10px', borderRadius: '10px', color: '#fff', outline: 'none' }} 
            />
            <button className="btn-red" onClick={onEnviar}>Enviar</button>
          </div>
        </div>
      )}
    </section>
  );
}
