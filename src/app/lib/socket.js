import { io } from "socket.io-client";

let socket;

export const getSocket = () => {
  if (!socket) {
    socket = io("https://video-streaming-server-5d4s.onrender.com", {
      autoConnect: false,
      transports: ["websocket"],
    });
  }
  return socket;
};