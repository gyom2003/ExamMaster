require("dotenv").config();

const express = require("express");
const http = require("node:http");
const cors = require("cors");
const { Server } = require("socket.io");
const crypto = require("node:crypto");
const { connectDatabase, disconnectDatabase } = require("./prisma");
const sessionRepository = require("./repositories/sessionRepository");

const app = express();
const port = process.env.SERVER_PORT || process.env.PORT || 3001;
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
const answerWriteQueues = new Map();

//creation code de session
function generateSessionCode() {
  return crypto
    .randomBytes(3)
    .toString("hex")
    .toUpperCase();
}

//func creation utilisateut
function createUser(userId, name, databaseId) {
  return {
    id: userId,
    name,
    databaseId,
    answer: "",
    revealedTo: new Set(),
  };
}

function queueAnswerWrite(key, write) {
  const previousWrite = answerWriteQueues.get(key) || Promise.resolve();
  const currentWrite = previousWrite.catch(() => {}).then(write);

  answerWriteQueues.set(key, currentWrite);
  currentWrite.then(
    () => {
      if (answerWriteQueues.get(key) === currentWrite) answerWriteQueues.delete(key);
    },
    () => {
      if (answerWriteQueues.get(key) === currentWrite) answerWriteQueues.delete(key);
    }
  );

  return currentWrite;
}

function updateHistoryAnswer(session, questionId, user, answer) {
  const entry = session.history.find((item) => item.databaseId === questionId);
  if (!entry) return;

  const existingAnswer = entry.answers.find((item) => item.participantId === user.id);
  const historyAnswer = {
    participantId: user.id,
    name: user.name,
    content: answer.content,
    sharedAt: answer.shared_at,
  };

  if (existingAnswer) Object.assign(existingAnswer, historyAnswer);
  else entry.answers.push(historyAnswer);
}

function reportPersistenceError(socket, error) {
  console.error("Database persistence failed:", error);
  socket.emit("session:error", {
    message: "Impossible d'enregistrer cette action. Réessaie.",
  });
}

async function loadSessionFromDatabase(code) {
  const persistedSession = await sessionRepository.findSessionWithHistory(code);

  if (!persistedSession) return null;

  const history = persistedSession.questions.map((question) => ({
    databaseId: question.id,
    question: {
      id: question.id.toString(),
      text: question.content,
      authorId: question.participants?.user_id || "",
    },
    answers: question.answers.map((answer) => ({
      participantId: answer.participants.user_id || "",
      name: answer.participants.name,
      content: answer.content,
      sharedAt: answer.shared_at,
    })),
  }));
  const latestQuestion = history[history.length - 1] || null;
  const session = {
    code: persistedSession.code,
    databaseId: persistedSession.id,
    question: latestQuestion?.question || null,
    currentQuestionDatabaseId: latestQuestion?.databaseId || null,
    history,
    users: new Map(),
  };

  sessions.set(code, session);
  return session;
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

connectDatabase()
  .then(() => {
    server.listen(port, "0.0.0.0", () => {
      console.log(`Serveur démarré sur le port ${port}`);
    });
  })
  .catch(async (error) => {
    console.error("Impossible de se connecter à PostgreSQL:", error);
    await disconnectDatabase();
    process.exitCode = 1;
  });

//couroutine gestion de la session (connect, join, set question, set answer, reveal answer)
io.on("connection", (socket) => {
  console.log("Utilisateur connecté :", socket.id);

  socket.on("session:create", async ({ name, userId }, callback) => {
    const normalizedUserId = String(userId || "").trim();
    const normalizedName = String(name || "").trim().slice(0, 200);

    if (!normalizedUserId || !normalizedName) {
      callback?.({ success: false, message: "Identité de participant invalide." });
      return;
    }

    try {
      let persistedSession;
      let code;

      for (let attempt = 0; attempt < 3; attempt += 1) {
        code = generateSessionCode();
        try {
          persistedSession = await sessionRepository.createSession({
            code,
            userId: normalizedUserId,
            name: normalizedName,
          });
          break;
        } catch (error) {
          if (error.code !== "P2002" || attempt === 2) throw error;
        }
      }

      const session = {
        code,
        databaseId: persistedSession.id,
        question: null,
        currentQuestionDatabaseId: null,
        history: [],
        users: new Map(),
      };
      const user = createUser(normalizedUserId, normalizedName, persistedSession.participants[0].id);
      user.socketId = socket.id;
      session.users.set(normalizedUserId, user);
      sessions.set(code, session);

      await socket.join(code);
      socket.data.sessionCode = code;
      socket.data.userId = normalizedUserId;

      callback?.({ success: true, code });
      sendSessionState(code);
    } catch (error) {
      callback?.({ success: false, message: "Impossible de créer la session." });
      reportPersistenceError(socket, error);
    }
  });

  socket.on("session:join", async ({ code, name, userId }, callback) => {
    const normalizedCode = String(code || "").trim().toUpperCase();
    const normalizedUserId = String(userId || "").trim();
    const normalizedName = String(name || "").trim().slice(0, 200);
    if (!normalizedUserId || !normalizedName) {
      callback?.({ success: false, message: "Identité de participant invalide." });
      return;
    }

    try {
      let session = sessions.get(normalizedCode);
      if (!session) {
        session = await loadSessionFromDatabase(normalizedCode);
      }
      if (!session) {
        callback?.({ success: false, message: "Session introuvable" });
        return;
      }

      const participant = await sessionRepository.upsertParticipant({
        sessionId: session.databaseId,
        userId: normalizedUserId,
        name: normalizedName,
      });

      const user = session.users.get(normalizedUserId) || createUser(normalizedUserId, normalizedName, participant.id);
      user.name = normalizedName;
      user.databaseId = participant.id;
      user.socketId = socket.id;
      session.users.set(normalizedUserId, user);

      if (session.currentQuestionDatabaseId) {
        const savedAnswer = await sessionRepository.findAnswer({
          questionId: session.currentQuestionDatabaseId,
          participantId: participant.id,
        });
        if (savedAnswer) {
          user.answer = savedAnswer.content;
          if (savedAnswer.shared_at) {
            for (const connectedUser of session.users.values()) {
              user.revealedTo.add(connectedUser.id);
            }
          }
        }
      }

      for (const connectedUser of session.users.values()) {
        if (connectedUser.revealedTo.size > 0) {
          connectedUser.revealedTo.add(normalizedUserId);
        }
      }

      await socket.join(normalizedCode);
      socket.data.sessionCode = normalizedCode;
      socket.data.userId = normalizedUserId;

      callback?.({ success: true, code: normalizedCode });
      sendSessionState(normalizedCode);
    } catch (error) {
      callback?.({ success: false, message: "Impossible de rejoindre la session." });
      reportPersistenceError(socket, error);
    }
  });

  socket.on("question:set", async ({ text }) => {
    const code = socket.data.sessionCode;
    const userId = socket.data.userId;
    const session = sessions.get(code);
    const author = session?.users.get(userId);
    const questionText = String(text || "").trim();

    if (!session || !author || !questionText) return;

    try {
      const question = await sessionRepository.createQuestion({
        sessionId: session.databaseId,
        authorId: author.databaseId,
        content: questionText,
      });

      session.currentQuestionDatabaseId = question.id;
      session.question = {
        id: question.id.toString(),
        text: questionText,
        authorId: userId,
      };
      session.history.push({
        databaseId: question.id,
        question: session.question,
        answers: [],
      });

      for (const user of session.users.values()) {
        user.answer = "";
        user.revealedTo.clear();
      }

      sendSessionState(code);
    } catch (error) {
      reportPersistenceError(socket, error);
    }
  });

  socket.on("answer:update", async ({ text }) => {
    const code = socket.data.sessionCode;
    const userId = socket.data.userId;
    const session = sessions.get(code);
    const user = session?.users.get(userId);

    if (!session || !user) return;

    user.answer = sanitizeAnswer(text);
    const questionId = session.currentQuestionDatabaseId;

    if (questionId) {
      const writeKey = `${questionId}:${user.databaseId}`;
      try {
        const savedAnswer = await queueAnswerWrite(writeKey, () => sessionRepository.saveAnswer({
          questionId,
          participantId: user.databaseId,
          content: user.answer,
        }));
        updateHistoryAnswer(session, questionId, user, savedAnswer);
      } catch (error) {
        reportPersistenceError(socket, error);
        return;
      }
    }

  });

  socket.on("answer:share", async () => {
    const code = socket.data.sessionCode;
    const authorId = socket.data.userId;
    const session = sessions.get(code);

    if (!session) return;

    const user = session.users.get(authorId);
    if (!user || !user.answer.trim()) return;

    const questionId = session.currentQuestionDatabaseId;
    if (questionId && user.databaseId) {
      const writeKey = `${questionId}:${user.databaseId}`;
      try {
        const savedAnswer = await queueAnswerWrite(writeKey, () => sessionRepository.shareAnswer({
          questionId,
          participantId: user.databaseId,
          content: user.answer,
          sharedAt: new Date(),
        }));
        updateHistoryAnswer(session, questionId, user, savedAnswer);
      } catch (error) {
        reportPersistenceError(socket, error);
        return;
      }
      if (session.currentQuestionDatabaseId !== questionId) return;
    }

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

  const history = session.history.map((entry) => {
    const hasPublishedResponse = entry.answers.some(
      (answer) => answer.sharedAt && answer.content.replace(/<[^>]*>/g, "").trim()
    );
    const answers = entry.answers
      .filter((answer) => {
        const hasContent = answer.content.replace(/<[^>]*>/g, "").trim();
        const isCorrectAnswer =
          answer.participantId === entry.question.authorId && hasPublishedResponse;
        return hasContent && (
          answer.participantId === viewerId || answer.sharedAt || isCorrectAnswer
        );
      })
      .map((answer) => ({
        participantId: answer.participantId,
        name: answer.name,
        content: answer.content,
        isCorrectAnswer:
          answer.participantId === entry.question.authorId && hasPublishedResponse,
      }));

    return {
      id: entry.question.id,
      text: entry.question.text,
      authorId: entry.question.authorId,
      answers,
    };
  });

  return {
    code: session.code,
    question: session.question,
    users,
    history,
  };
}

function sanitizeAnswer(value) {
  return String(value || "")
    .replace(/<!--([\s\S]*?)-->/g, "")
    .replace(/<\/?([a-z][a-z0-9]*)\b[^>]*>/gi, (tag, tagName) => {
      const name = tagName.toLowerCase();
      const allowedTags = new Set(["strong", "b", "em", "i", "u", "mark", "br", "p"]);

      if (!allowedTags.has(name)) return "";
      if (name === "br") return "<br>";

      return tag.startsWith("</") ? `</${name}>` : `<${name}>`;
    });
}

