import { io } from "socket.io-client";

const socketUrl = (process.env.REACT_APP_SOCKET_URL || "http://localhost:3001").replace(/\/$/, "");

const socket = io(socketUrl, {
  autoConnect: false,
});

export default socket;