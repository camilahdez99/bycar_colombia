// Un chat de la pestaña Mensajes es de un viaje (`chatId`, la solicitud) o de un guardián
// (`guardianId`). Estas funciones arman lo que la API espera para cada tipo.

/** Identificador del chat para el body de POST /api/mensajes. */
export const idDeChat = (chat) => (chat.guardianId ? { guardianId: chat.guardianId } : { chatId: chat.chatId });

/** Query string del historial: `guardianId=…` o `chatId=…`. */
export const consultaDeChat = (chat) => new URLSearchParams(idDeChat(chat)).toString();

/** Clave única del chat, para las listas y para saber si ya está abierto. */
export const claveDeChat = (chat) =>
  chat.clave ?? (chat.guardianId ? `guardian-${chat.guardianId}` : `viaje-${chat.chatId}`);
