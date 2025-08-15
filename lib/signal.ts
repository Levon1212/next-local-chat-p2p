'use client';

import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io("https://local-chat-signal-production.up.railway.app/", {
      transports: ['websocket'],
    });

    // Optional diagnostics for debugging connectivity on the frontend
    socket.on('connect', () => {
      // eslint-disable-next-line no-console
      console.log('[socket] connected', socket.id);
    });
    socket.on('disconnect', (reason) => {
      // eslint-disable-next-line no-console
      console.log('[socket] disconnected', reason);
    });
    socket.on('connect_error', (err) => {
      // eslint-disable-next-line no-console
      console.error('[socket] connect_error', err.message);
    });
    socket.on('reconnect_attempt', (n) => {
      // eslint-disable-next-line no-console
      console.log('[socket] reconnect_attempt', n);
    });
  }
  return socket;
}
