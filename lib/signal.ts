'use client';

import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function getSocket(): Socket {
    if (!socket) {
        socket = io("local-chat-signal-production.up.railway.app", {
            transports: ['websocket'],
        });
    }
    return socket;
}
