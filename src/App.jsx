
import { useEffect, useState } from "react";
import "./App.css";
import HomePage from "./pages/HomePage";
import Session from "./pages/Session";
import socket from "./services/socket";

const createIdentityId = () => window.crypto?.randomUUID?.() || Date.now().toString(36);

function App() {
  const [screen, setScreen] = useState("home");
  const [session, setSession] = useState(null);
  const [inviteCode] = useState(() => new URLSearchParams(window.location.search).get("session") || "");
  const [identity, setIdentity] = useState(() => ({ id: createIdentityId(), name: "" }));
  const [error, setError] = useState("");

  useEffect(() => {
    const handleState = (nextSession) => {
      setSession(nextSession);
      setScreen("session");
      setError("");
    };
    socket.on("session:update", handleState);
    return () => socket.off("session:update", handleState);
  }, []);

  const enterSession = ({ mode, name, code }) => {
    const trimmedName = name.trim();
    if (!trimmedName) return setError("Choisis un prénom pour entrer dans la session.");
    const nextIdentity = { ...identity, name: trimmedName };
    setIdentity(nextIdentity);
    setError("");
    const event = mode === "create" ? "session:create" : "session:join";
    const payload = mode === "create"
      ? { name: nextIdentity.name, userId: nextIdentity.id }
      : { name: nextIdentity.name, userId: nextIdentity.id, code: code.trim().toUpperCase() };
    if (!socket.connected) socket.connect();
    socket.emit(event, payload, (response) => {
      if (!response?.success) setError(response?.message || "Impossible de rejoindre la session.");
    });
  };

  const leaveSession = () => {
    socket.disconnect();
    setSession(null);
    setScreen("home");
  };

  return <main className="app-shell">{screen === "home" ? <HomePage onEnter={enterSession} initialCode={inviteCode} error={error} /> : <Session session={session} userId={identity.id} onLeave={leaveSession} error={error} />}</main>;
}

export default App;
