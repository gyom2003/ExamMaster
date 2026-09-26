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
function sendSessionState(code) {
  const session = sessions.get(code);

  if (!session) {
    return;
  }

  const socketIds = io.sockets.adapter.rooms.get(code) || new Set();
  for (const socketId of socketIds) {
    const currentSocket = io.sockets.sockets.get(socketId);
    if (!currentSocket) continue;
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
    session.users.get(userId).socketId = socket.id;

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
  session.users.get(userId).socketId = socket.id;

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

  //func msise à jour de la réponse de l'utilisateur
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

  user.answer = sanitizeAnswer(text);

  socket.emit("session:update", buildStateForUser(session, userId));
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

  socket.on("disconnect", () => {
    const code = socket.data.sessionCode;
    const userId = socket.data.userId;
    const session = sessions.get(code);
    const user = session?.users.get(userId);

    if (!session || !user || user.socketId !== socket.id) return;

    session.users.delete(userId);
    if (session.users.size === 0) {
      sessions.delete(code);
      return;
    }
    sendSessionState(code);
  });
});

//logique d'envoie de réponse
function buildStateForUser(session, viewerId) {
  const users = [];
  const questionAuthorId = session.question?.authorId;
  const hasPublishedResponse = [...session.users.values()].some(
    (user) => user.id !== questionAuthorId && user.revealedTo.size > 0
  );

  for (const user of session.users.values()) {
    const isMe = user.id === viewerId;

    const isCorrectAnswer =
      user.id === questionAuthorId &&
      Boolean(user.answer.trim()) &&
      (isMe || hasPublishedResponse);
    const answerVisible =
      isMe ||
      user.revealedTo.has(viewerId) ||
      isCorrectAnswer;

    users.push({
      id: user.id,
      name: user.name,
      answer: answerVisible ? user.answer : null,
      answerRevealed: answerVisible,
      answerShared: user.revealedTo.size > 0,
      revealedToMe: user.revealedTo.has(viewerId),
      isCorrectAnswer,
    });
  }

  return {
    code: session.code,
    question: session.question,
    users,
  };
}

function sanitizeAnswer(value) {
  return String(value || "")
    .replace(/<\s*(\/?)\s*(strong|b|em|i|br|p)\b[^>]*>/gi, "<$1$2>")
    .replace(/<[^>]*>/g, "");
}

