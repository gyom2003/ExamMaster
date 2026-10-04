import AnswerEditor from "../components/AnswerEditor";
import ParticipantList from "../components/ParticipantList";
import QuestionVue from "../components/QuestionVue";
import socket from "../services/socket";

import { useEffect, useRef, useState } from "react";

function Session({ session, userId, onLeave, error }) {
	const [question, setQuestion] = useState("");
	const [copyFeedback, setCopyFeedback] = useState("");
	const copyTimerRef = useRef(null);
	useEffect(() => () => window.clearTimeout(copyTimerRef.current), []);
	const history = session?.history || [];
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
	const copySessionCode = async () => {
		try {
			await navigator.clipboard.writeText(session.code);
			setCopyFeedback("Code copié !");
		} catch {
			setCopyFeedback("Copie impossible");
		}
		window.clearTimeout(copyTimerRef.current);
		copyTimerRef.current = window.setTimeout(() => setCopyFeedback(""), 2200);
	};

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
							onClick={copySessionCode}
							aria-label="Copier le code"
						>
							Copier
						</button>
						{copyFeedback && <output className="copy-feedback">{copyFeedback}</output>}
					</div>
					<button className="leave-button" onClick={onLeave}>
						Quitter
					</button>
				</div>
			</header>

			<div className="session-layout">
				<aside className="history-panel">
					<div className="aside-title">
						<span>Historique</span>
						<b>{history.length}</b>
					</div>
					{history.length === 0 ? (
						<p className="history-empty">Aucune question pour le moment.</p>
					) : (
						<ol className="history-list">
							{history.slice().reverse().map((entry) => (
								<li key={entry.id}>
									<details className="history-entry">
										<summary>
											<span className="history-question">{entry.text}</span>
											{entry.id === session.question?.id && (
												<small>En cours</small>
											)}
											<span className="history-answer-count">
												{entry.answers.length} réponse{entry.answers.length > 1 ? "s" : ""}
											</span>
										</summary>
										{entry.answers.length > 0 && (
											<ul className="history-answers">
												{entry.answers.map((answer) => (
													<li key={`${entry.id}-${answer.participantId}`}>
														<div className="history-answer-author">
															<strong>{answer.name}</strong>
															{answer.isCorrectAnswer && <small>Réponse attendue</small>}
														</div>
														<div
															className="history-answer-content"
															dangerouslySetInnerHTML={{ __html: answer.content }}
														/>
													</li>
												))}
											</ul>
										)}
									</details>
								</li>
							))}
						</ol>
					)}
				</aside>
				<div className="work-area">
					<QuestionVue
						question={session.question}
						questionDraft={question}
						onDraftChange={setQuestion}
						onAsk={askQuestion}
					/>
					<AnswerEditor
						key={session.question?.id || "no-question"}
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
