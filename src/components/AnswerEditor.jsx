import { useEffect, useRef } from "react";

function AnswerEditor({ answer, shared, onChange, onShare }) {
	const editorRef = useRef(null);
	const changeTimerRef = useRef(null);

	useEffect(() => {
		if (editorRef.current && editorRef.current.innerHTML !== answer) {
			editorRef.current.innerHTML = answer;
		}
	}, [answer]);

	const format = (command) => {
		editorRef.current?.focus();
		document.execCommand(command, false);
		onChange(editorRef.current?.innerHTML || "");
	};

	const scheduleChange = (html) => {
		window.clearTimeout(changeTimerRef.current);
		changeTimerRef.current = window.setTimeout(() => onChange(html), 150);
	};

	const hasAnswer = answer.replace(/<[^>]*>/g, "").trim();

	return (
		<section className="answer-block">
			<div className="section-label">
				Ta réflexion
				<span>
					{shared ? "visible par le groupe" : "visible par toi uniquement"}
				</span>
			</div>
			<div
				className="editor-toolbar"
				role="toolbar"
				aria-label="Mise en forme de la réponse"
			>
				<button
					type="button"
					onMouseDown={(event) => event.preventDefault()}
					onClick={() => format("bold")}
					aria-label="Mettre en gras"
				>
					<strong>G</strong>
				</button>
				<button
					type="button"
					onMouseDown={(event) => event.preventDefault()}
					onClick={() => format("italic")}
					aria-label="Mettre en italique"
				>
					<em>I</em>
				</button>
			</div>
			<div
				ref={editorRef}
				className="answer-editor"
				contentEditable={!shared}
				role="textbox"
				aria-multiline="true"
				data-placeholder="Écris ce que tu penses, sans filtre..."
				onInput={(event) => scheduleChange(event.currentTarget.innerHTML)}
			/>
			<div className="answer-footer">
				<div className="save-hint">
					Enregistrement automatique <span>●</span>
				</div>
				<button
					className="share-button"
					onClick={onShare}
					disabled={!hasAnswer || shared}
				>
					{shared ? "Réponse partagée" : "Partager ma réponse"}
				</button>
			</div>
		</section>
	);
}

export default AnswerEditor;
