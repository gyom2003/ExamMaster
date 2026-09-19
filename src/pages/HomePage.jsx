import { useState } from "react";

function HomePage({ onEnter, initialCode = "", error }) {
	const [name, setName] = useState("");
	const [code, setCode] = useState(initialCode);

	return <section className="home-page">
		<div className="entry-panel">
			<div className="brand-mark home-brand"><span></span><strong>GuiguiApp</strong></div>
			<div className="panel-heading"><h1>Créer ou rejoindre une session</h1><p>Choisis un nom pour commencer.</p></div>
			<label htmlFor="name">Ton prénom</label>
			<input id="name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex. Camille" />
			<button className="primary-button" onClick={() => onEnter({ mode: "create", name })}>Créer une session <span>↗</span></button>
			<div className="split-line"><span>ou rejoindre</span></div>
			<div className="join-row"><input value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} placeholder="Code de session" maxLength={6} aria-label="Code de session" /><button className="secondary-button" onClick={() => onEnter({ mode: "join", name, code })}>Rejoindre</button></div>
			{error && <p className="error-message">{error}</p>}
		</div>
	</section>;
}

export default HomePage;
