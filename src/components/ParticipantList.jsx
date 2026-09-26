function ParticipantList({ users, userId }) {
	return (
		<aside className="participants-panel">
			<div className="aside-title">
				<span>Dans la session</span>
				<b>{users.length}</b>
			</div>
			<div className="participant-list">
				{users.map((user) => (
					<div className="participant" key={user.id}>
						<span className="avatar">
							{user.name.slice(0, 1).toUpperCase()}
						</span>
						<span>
							{user.name}
							{user.id === userId && <small>toi</small>}
						</span>
						<i className={user.answer ? "is-writing" : ""} />
					</div>
				))}
			</div>
			<p className="privacy-note">
				Les réponses restent privées jusqu'au partage. La réponse de l'auteur
				devient la réponse attendue lorsqu'une réponse est publiée.
			</p>
		</aside>
	);
}

export default ParticipantList;
