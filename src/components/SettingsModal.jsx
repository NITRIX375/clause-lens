import { useState } from 'react';
import { getApiKey, setApiKey } from '../lib/analyzer.js';

export default function SettingsModal({ onClose }) {
  const [key, setKey] = useState(getApiKey());

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <span>Settings</span>
          <button className="btn icon" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <label className="field-label">Anthropic API key</label>
          <input
            type="password"
            className="field"
            placeholder="sk-ant-…"
            value={key}
            onChange={(e) => setKey(e.target.value)}
          />
          <p className="field-hint">
            Stored only in this browser's localStorage. Analysis calls go directly from your
            browser to the Anthropic API — fine for personal use; for a public deployment, put
            the AI calls behind a small serverless proxy so the key never reaches clients.
          </p>
          <div className="modal-actions">
            <button
              className="btn primary"
              onClick={() => {
                setApiKey(key.trim());
                onClose();
              }}
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
