import AnswerEditor from "../components/AnswerEditor";
import ParticipantList from "../components/ParticipantList";
import QuestionVue from "../components/QuestionVue";
import socket from "../services/socket";

import { useState } from "react";

function Session({ session, userId, onLeave, error }) {
	const [question, setQuestion] = useState("");
	const me = session?.users.find((user) => user.id === userId);
	if (!session) {
		return (
			<section className="loading-state">
				<p>Connexion à la session...</p>
			</section>
		);
	}
	if (!me) {
		return (
			<section className="loading-state">
				<p>Préparation de la session...</p>
			</section>
		);
	}

	const askQuestion = () => {
		if (!question.trim()) return;
		socket.emit("question:set", { text: question.trim() });
		setQuestion("");
	};
	const sharedAnswers = session.users.filter((user) => user.id !== userId && user.answerRevealed && user.answer);

	return (
		<section className="session-page">
			<header className="session-header">
				<div className="brand-mark">
					<span></span>
					<strong>Guiguiapp</strong>
				</div>
				<div className="session-actions">
					<div className="session-code">
						CODE <b>{session.code}</b>
						<button
							onClick={() => navigator.clipboard?.writeText(session.code)}
							aria-label="Copier le code"
						>
							Copier
						</button>
					</div>
					<button className="leave-button" onClick={onLeave}>
						Quitter
					</button>
				</div>
			</header>

			<div className="session-layout">
				<div className="work-area">
					<QuestionVue
						question={session.question}
						questionDraft={question}
						onDraftChange={setQuestion}
						onAsk={askQuestion}
					/>
					<AnswerEditor
						answer={me.answer || ""}
						shared={me.answerShared}
						onChange={(text) => socket.emit("answer:update", { text })}
						onShare={() => socket.emit("answer:share")}
					/>

					{sharedAnswers.length > 0 && (
						<section className="shared-answers">
							<div className="section-label">Réponses partagées</div>
							<div className="shared-answer-list">
								{sharedAnswers.map((user) => (
									<article className="shared-answer" key={user.id}>
										<div className="shared-answer-author">
											<span className="avatar muted">
												{user.name.slice(0, 1).toUpperCase()}
											</span>
											<strong>{user.name}</strong>
											{user.isCorrectAnswer && (
												<span className="correct-label">
													Réponse attendue
												</span>
											)}
										</div>
										<div
											className="shared-answer-content"
											dangerouslySetInnerHTML={{ __html: user.answer }}
										/>
									</article>
								))}
							</div>
						</section>
					)}

					{error && <p className="error-message">{error}</p>}
				</div>
				<ParticipantList users={session.users} userId={userId} />
			</div>
		</section>
	);
}

export default Session;
