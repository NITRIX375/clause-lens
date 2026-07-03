export default function PartyPicker({ profile, onPick }) {
  const roles = [...new Set(profile.parties.map((p) => p.role))];

  return (
    <div className="party-screen">
      <div className="doc-badge">{profile.docType}</div>
      <p className="doc-summary">{profile.summary}</p>
      {profile.jurisdictionHints && (
        <p className="doc-jurisdiction">📍 {profile.jurisdictionHints}</p>
      )}
      <h2>Which side of this contract are you on?</h2>
      <p className="party-sub">
        The same clause can protect one party and trap the other — the analysis reads every
        clause from your seat at the table.
      </p>
      <div className="party-grid">
        {roles.map((role) => (
          <button
            key={role}
            className={`party-card ${role === profile.likelyUserRole ? 'likely' : ''}`}
            onClick={() => onPick(role)}
          >
            <div className="party-role">{role}</div>
            <div className="party-names">
              {profile.parties
                .filter((p) => p.role === role)
                .map((p) => p.name)
                .join(', ')}
            </div>
            {role === profile.likelyUserRole && <div className="likely-tag">probably you</div>}
          </button>
        ))}
      </div>
    </div>
  );
}
