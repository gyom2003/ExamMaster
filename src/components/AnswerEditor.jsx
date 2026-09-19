function AnswerEditor({ answer, shared, onChange, onShare }) {
	return <section className="answer-block"><div className="section-label">Ta réflexion <span>{shared ? "visible par le groupe" : "visible par toi uniquement"}</span></div><textarea value={answer} onChange={(event) => onChange(event.target.value)} placeholder="Écris ce que tu penses, sans filtre..." /><div className="answer-footer"><div className="save-hint">Enregistrement automatique <span>●</span></div><button className="share-button" onClick={onShare} disabled={!answer.trim() || shared}>{shared ? "Réponse partagée" : "Partager ma réponse"}</button></div></section>;
}

export default AnswerEditor;
