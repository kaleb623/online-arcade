// client/src/socket.js
import { io } from 'socket.io-client';

const socketUrl = import.meta.env.PROD ? '/' : import.meta.env.VITE_API_URL;

// Export one single socket instance
export const socket = io(socketUrl, {
    autoConnect: true
});