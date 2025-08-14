'use client';

import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function getSocket(): Socket {
    if (!socket) {
        socket = io("https://your-render-url.onrender.com", {
            transports: ['websocket'],
        });
    }
    return socket;
}
