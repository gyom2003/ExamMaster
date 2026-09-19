require("dotenv").config();

const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
const crypto = require("crypto");

const app = express();
const port = process.env.PORT || 3001;
const frontendUrls = (process.env.FRONTEND_URL || "http://localhost:3000")
  .split(",")
  .map((url) => url.trim().replace(/\/$/, ""))
  .filter(Boolean);

app.use(cors({ origin: frontendUrls }));

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: frontendUrls,
    methods: ["GET", "POST"],
  },
});

const sessions = new Map();


function generateSessionCode() {
  return crypto
    .randomBytes(3)
    .toString("hex")
    .toUpperCase();
}

function createUser(userId, name) {
  return {
    id: userId,
    name,
    answer: "",
    revealedTo: new Set(),
  };
}

//suivi etat de la session par la socket
async function sendSessionState(code) {
  const session = sessions.get(code);

  if (!session) {
    return;
  }

  const sockets = await io.in(code).fetchSockets();

  for (const currentSocket of sockets) {
    const viewerId = currentSocket.data.userId;

    currentSocket.emit(
      "session:update",
      buildStateForUser(session, viewerId)
    );
  }
}

app.get("/", (req, res) => {
  res.send("ExamMaster API running");
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Serveur démarré sur le port ${port}`);
});

//creation d'une session (connect, join, set question, set answer, reveal answer)
io.on("connection", (socket) => {
  console.log("Utilisateur connecté :", socket.id);

  socket.on("session:create", ({ name, userId }, callback) => {
    const code = generateSessionCode();

    const session = {
      code,
      question: null,
      users: new Map(),
    };
    //recup info user
    session.users.set(
      userId,
      createUser(userId, name)
    );  

    sessions.set(code, session);

    socket.join(code);

    socket.data.sessionCode = code;
    socket.data.userId = userId;

    callback({
      success: true,
      code,
    });

    sendSessionState(code);
  });

  socket.on("session:join", ({ code, name, userId }, callback) => {
  const normalizedCode = code.toUpperCase();

  const session = sessions.get(normalizedCode);

  if (!session) {
    callback({
      success: false,
      message: "Session introuvable",
    });

    return;
  }

  session.users.set(
    userId,
    createUser(userId, name)
  );

  socket.join(normalizedCode);

  socket.data.sessionCode = normalizedCode;
  socket.data.userId = userId;

  callback({
    success: true,
    code: normalizedCode,
  });

  sendSessionState(normalizedCode);
});

  socket.on("question:set", ({ text }) => {
  const code = socket.data.sessionCode;
  const userId = socket.data.userId;

  const session = sessions.get(code);

  if (!session) {
    return;
  }

  session.question = {
    id: crypto.randomUUID(),
    text,
    authorId: userId,
  };

  for (const user of session.users.values()) {
    user.answer = "";
    user.revealedTo.clear();
  }

  sendSessionState(code);
});

  socket.on("answer:update", ({ text }) => {
  const code = socket.data.sessionCode;
  const userId = socket.data.userId;

  const session = sessions.get(code);

  if (!session) {
    return;
  }

  const user = session.users.get(userId);

  if (!user) {
    return;
  }

  user.answer = text;

  sendSessionState(code);
});

  socket.on("answer:share", () => {
    const code = socket.data.sessionCode;
    const authorId = socket.data.userId;
    const session = sessions.get(code);

    if (!session) return;

    const user = session.users.get(authorId);
    if (!user || !user.answer.trim()) return;

    for (const participant of session.users.values()) {
      user.revealedTo.add(participant.id);
    }
    sendSessionState(code);
  });
});

//logique d'envoie de réponse
function buildStateForUser(session, viewerId) {
  const users = [];

  for (const user of session.users.values()) {
    const isMe = user.id === viewerId;

    const answerVisible =
      isMe ||
      user.revealedTo.has(viewerId);

    users.push({
      id: user.id,
      name: user.name,
      answer: answerVisible ? user.answer : null,
      answerRevealed: answerVisible,
      answerShared: user.revealedTo.size > 0,
      revealedToMe: user.revealedTo.has(viewerId),
    });
  }

  return {
    code: session.code,
    question: session.question,
    users,
  };
}

