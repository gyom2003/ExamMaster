function QuestionVue({ question, questionDraft, onDraftChange, onAsk }) {
	return (
		<section className="question-block">
			<div className="section-label">Question du groupe</div>
			{question ? (
				<h2 className="current-question">{question.text}</h2>
			) : (
				<p className="empty-state">Posez votre question pour le groupe</p>
			)}
			<div className="question-form">
				<input
					value={questionDraft}
					onChange={(event) => onDraftChange(event.target.value)}
					onKeyDown={(event) => event.key === "Enter" && onAsk()}
					placeholder="Poser une nouvelle question..."
					aria-label="Nouvelle question"
				/>
				<button className="primary-button small" onClick={onAsk}>
					Publier <span>↗</span>
				</button>
			</div>
		</section>
	);
}

export default QuestionVue;
