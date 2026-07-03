import { useState, useCallback, useRef } from 'react';

export default function UploadScreen({ onFile, onText, onDemo }) {
  const [drag, setDrag] = useState(false);
  const [pasteMode, setPasteMode] = useState(false);
  const [pasted, setPasted] = useState('');
  const fileRef = useRef();

  const onDrop = useCallback(
    (e) => {
      e.preventDefault();
      setDrag(false);
      if (e.dataTransfer.files?.[0]) onFile(e.dataTransfer.files[0]);
    },
    [onFile]
  );

  return (
    <div className="upload-wrap">
      <div className="hero">
        <h1>
          Read the fine print.
          <br />
          <em>Before</em> you sign it.
        </h1>
        <p className="hero-sub">
          Rent agreement, job offer, insurance policy, terms of service — upload any contract and
          get every clause explained in plain language, with red flags from <b>your</b> side of the table.
        </p>
      </div>

      {!pasteMode ? (
        <div
          className={`dropzone ${drag ? 'drag' : ''}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={onDrop}
        >
          <div className="dz-icon">⇪</div>
          <div className="dz-title">Drop your contract here</div>
          <div className="dz-sub">PDF · photo or scan (we'll OCR it) · text file</div>
          <div className="dz-actions">
            <button className="btn primary" onClick={() => fileRef.current?.click()}>
              Choose file
            </button>
            <button className="btn ghost" onClick={() => setPasteMode(true)}>
              Paste text instead
            </button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.txt,image/*"
            style={{ display: 'none' }}
            onChange={(e) => {
              if (e.target.files?.[0]) onFile(e.target.files[0]);
              e.target.value = '';
            }}
          />
          <div className="privacy-note">
            Extraction runs entirely in your browser. Text is sent only to the AI API for
            analysis — never stored, never on our servers (there are none).
          </div>
        </div>
      ) : (
        <div className="paste-panel">
          <textarea
            className="paste-area"
            placeholder="Paste the full contract text here…"
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
          />
          <div className="dz-actions">
            <button
              className="btn primary"
              disabled={pasted.trim().length < 200}
              onClick={() => onText(pasted)}
            >
              Analyze
            </button>
            <button className="btn ghost" onClick={() => setPasteMode(false)}>
              Back to upload
            </button>
          </div>
        </div>
      )}

      <button className="demo-link" onClick={onDemo}>
        No contract handy? <u>Analyze a sample Noida rent agreement</u> — seeded with clauses
        that actually show up in real agreements →
      </button>
    </div>
  );
}
