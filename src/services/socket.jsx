import { io } from "socket.io-client";

const socketUrl =
  process.env.NODE_ENV === "production"
    ? "https://exammaster-production.up.railway.app"
    : "http://localhost:3001";

const socket = io(socketUrl, {
  autoConnect: false,
});

export default socket;