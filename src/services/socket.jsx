import { io } from "socket.io-client";

const socketUrl =
  process.env.REACT_APP_SOCKET_URL ||
  (process.env.NODE_ENV === "production"
    ? "https://exammaster-production.up.railway.app"
    : "http://localhost:3001");

const socket = io(socketUrl, {
  autoConnect: false,
  transports: ["websocket", "polling"],
});

export default socket;