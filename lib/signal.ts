'use client';

import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function getSocket(): Socket {
    if (!socket) {
        socket = io("https://next-local-chat-p2p.vercel.app", {
            transports: ['websocket'],
        });
    }
    return socket;
}
