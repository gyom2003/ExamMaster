const { prisma } = require("../prisma");

function createSession({ code, userId, name }) {
	return prisma.sessions.create({
		data: {
			code,
			creator_id: userId,
			participants: {
				create: { user_id: userId, name },
			},
		},
		include: { participants: true },
	});
}

function findSessionWithHistory(code) {
	return prisma.sessions.findUnique({
		where: { code },
		include: {
			questions: {
				orderBy: [{ created_at: "asc" }, { id: "asc" }],
				include: {
					participants: { select: { user_id: true } },
					answers: {
						orderBy: [{ created_at: "asc" }, { id: "asc" }],
						include: {
							participants: { select: { user_id: true, name: true } },
						},
					},
				},
			},
		},
	});
}

function upsertParticipant({ sessionId, userId, name }) {
	return prisma.participants.upsert({
		where: {
			session_id_user_id: { session_id: sessionId, user_id: userId },
		},
		update: { name },
		create: { session_id: sessionId, user_id: userId, name },
	});
}

function createQuestion({ sessionId, authorId, content }) {
	return prisma.questions.create({
		data: { session_id: sessionId, author_id: authorId, content },
	});
}

function findAnswer({ questionId, participantId }) {
	return prisma.answers.findUnique({
		where: {
			question_id_participant_id: {
				question_id: questionId,
				participant_id: participantId,
			},
		},
	});
}

function saveAnswer({ questionId, participantId, content }) {
	return prisma.answers.upsert({
		where: {
			question_id_participant_id: {
				question_id: questionId,
				participant_id: participantId,
			},
		},
		update: { content },
		create: { question_id: questionId, participant_id: participantId, content },
	});
}

function shareAnswer({ questionId, participantId, content, sharedAt }) {
	return prisma.answers.upsert({
		where: {
			question_id_participant_id: {
				question_id: questionId,
				participant_id: participantId,
			},
		},
		update: { content, shared_at: sharedAt },
		create: {
			question_id: questionId,
			participant_id: participantId,
			content,
			shared_at: sharedAt,
		},
	});
}

module.exports = {
	createSession,
	findSessionWithHistory,
	upsertParticipant,
	createQuestion,
	findAnswer,
	saveAnswer,
	shareAnswer,
};