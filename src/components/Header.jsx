export default function Header({ onReset, onSettings, showReset }) {
  return (
    <header className="header">
      <div className="brand">
        <span className="brand-mark">§</span>
        <span className="brand-name">ClauseLens</span>
        <span className="brand-tag">understand what you're signing</span>
      </div>
      <div className="header-actions">
        {showReset && (
          <button className="btn ghost" onClick={onReset}>
            New document
          </button>
        )}
        <button className="btn icon" onClick={onSettings} title="Settings (API key)">
          ⚙
        </button>
      </div>
    </header>
  );
}
