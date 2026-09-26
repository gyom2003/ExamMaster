function RevealComponent({ users, onReveal }) {
	return (
		<section className="reveal-block">
			<div className="section-label">Partager ma réponse</div>
			{users.length === 0 ? (
				<p className="empty-state compact">
					Invite quelqu'un pour commencer à échanger.
				</p>
			) : (
				<div className="reveal-list">
					{users.map((user) => (
						<div className="reveal-row" key={user.id}>
							<div>
								<span className="avatar muted">
									{user.name.slice(0, 1).toUpperCase()}
								</span>
								<b>{user.name}</b>
							</div>
							<button
								className="reveal-button"
								onClick={() => onReveal(user.id)}
								disabled={user.revealedToMe}
							>
								{user.revealedToMe ? "Réponse partagée" : "Dévoiler"}
							</button>
						</div>
					))}
				</div>
			)}
		</section>
	);
}

export default RevealComponent;
