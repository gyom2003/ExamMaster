import { useEffect, useRef, useState } from "react";

function AnswerEditor({ answer, shared, onChange, onShare }) {
	const editorRef = useRef(null);
	const changeTimerRef = useRef(null);
	const latestHtmlRef = useRef(answer);
	const hasLocalEditsRef = useRef(false);
	const [hasAnswer, setHasAnswer] = useState(false);

	useEffect(() => {
		const editor = editorRef.current;
		if (!editor) return;

		if (!hasLocalEditsRef.current || shared) {
			if (editor.innerHTML !== answer) editor.innerHTML = answer;
			latestHtmlRef.current = answer;
			setHasAnswer(Boolean(editor.innerText.trim()));
			if (shared) hasLocalEditsRef.current = false;
		}
	}, [answer, shared]);

	useEffect(() => () => window.clearTimeout(changeTimerRef.current), []);

	const publishEditorValue = (editor) => {
		const html = editor.innerHTML;
		latestHtmlRef.current = html;
		hasLocalEditsRef.current = true;
		setHasAnswer(Boolean(editor.innerText.trim()));
		window.clearTimeout(changeTimerRef.current);
		changeTimerRef.current = null;
		onChange(html);
	};

	const format = (command) => {
		const editor = editorRef.current;
		if (!editor) return;
		editor.focus();
		document.execCommand(command, false);
		publishEditorValue(editor);
	};

	const highlight = () => {
		const editor = editorRef.current;
		const selection = window.getSelection();
		if (!editor || !selection || selection.rangeCount === 0) return;

		const range = selection.getRangeAt(0);
		if (range.collapsed || !editor.contains(range.commonAncestorContainer)) return;

		const mark = document.createElement("mark");
		mark.appendChild(range.extractContents());
		range.insertNode(mark);
		selection.removeAllRanges();
		publishEditorValue(editor);
	};

	const scheduleChange = (html) => {
		latestHtmlRef.current = html;
		hasLocalEditsRef.current = true;
		setHasAnswer(Boolean(editorRef.current?.innerText.trim()));
		window.clearTimeout(changeTimerRef.current);
		changeTimerRef.current = window.setTimeout(() => {
			changeTimerRef.current = null;
			onChange(html);
		}, 300);
	};

	const flushChange = () => {
		if (changeTimerRef.current === null) return;
		window.clearTimeout(changeTimerRef.current);
		changeTimerRef.current = null;
		onChange(latestHtmlRef.current);
	};

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
				<button
					type="button"
					onMouseDown={(event) => event.preventDefault()}
					onClick={() => format("underline")}
					aria-label="Souligner le texte sélectionné"
					disabled={shared}
				>
					<u>U</u>
				</button>
				<button
					type="button"
					onMouseDown={(event) => event.preventDefault()}
					onClick={highlight}
					aria-label="Surligner le texte sélectionné"
					disabled={shared}
				>
					<mark>A</mark>
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
				onBlur={flushChange}
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
