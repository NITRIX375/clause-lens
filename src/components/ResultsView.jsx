import { useMemo, useState } from 'react';
import { countRisks } from '../lib/analyzer.js';
import { buildReport, download } from '../lib/report.js';

const RISK_ORDER = { red: 0, caution: 1, standard: 2, info: 3 };
const RISK_LABEL = { red: 'red flag', caution: 'caution', standard: 'standard', info: 'info' };

export default function ResultsView({ state, onRetryBatch }) {
  const { profile, userRole, clauses, summary, stage, skipped, failedBatches, extraction } = state;
  const [filter, setFilter] = useState(null);
  const [sortByRisk, setSortByRisk] = useState(true);

  const counts = useMemo(() => countRisks(clauses), [clauses]);
  const analyzed = clauses.filter((c) => c.analysis).length;
  const pct = Math.round((analyzed / Math.max(1, clauses.length)) * 100);

  const visible = useMemo(() => {
    let list = clauses.filter((c) => (filter ? c.analysis?.risk === filter : true));
    if (sortByRisk) {
      list = [...list].sort(
        (a, b) =>
          (RISK_ORDER[a.analysis?.risk] ?? 9) - (RISK_ORDER[b.analysis?.risk] ?? 9) ||
          a.index - b.index
      );
    }
    return list;
  }, [clauses, filter, sortByRisk]);

  const exportReport = () => {
    download(
      `clauselens-report-${Date.now()}.md`,
      buildReport(profile, userRole, summary, [...clauses].sort((a, b) => a.index - b.index))
    );
  };

  return (
    <div className="results">
      <div className="results-head">
        <div>
          <div className="doc-badge">{profile.docType}</div>
          <div className="reading-as">
            reading as <b>{userRole}</b>
            {extraction?.method === 'ocr' && <span className="ocr-tag"> · OCR'd document</span>}
          </div>
        </div>
        {stage === 'done' && (
          <button className="btn primary" onClick={exportReport}>
            Download report
          </button>
        )}
      </div>

      {stage === 'analyzing' && (
        <div className="analyzing-bar">
          <div className="analyzing-label">
            Analyzing clause {analyzed} of {clauses.length} from the {userRole}'s perspective…
          </div>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}

      {summary && (
        <div className={`summary-card grade-${summary.grade}`}>
          <div className="grade-circle">{summary.grade}</div>
          <div className="summary-body">
            <p className="verdict">{summary.verdict}</p>
            {summary.topConcerns?.length > 0 && (
              <ul className="concerns">
                {summary.topConcerns.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            )}
            {summary.beforeSigning?.length > 0 && (
              <details className="before-signing">
                <summary>✅ Before-you-sign checklist ({summary.beforeSigning.length})</summary>
                <ul>
                  {summary.beforeSigning.map((c, i) => (
                    <li key={i}>{c}</li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        </div>
      )}

      <div className="filter-bar">
        {['red', 'caution', 'standard', 'info'].map((r) => (
          <button
            key={r}
            className={`filter-pill ${r} ${filter === r ? 'active' : ''}`}
            onClick={() => setFilter(filter === r ? null : r)}
          >
            {counts[r] || 0} {RISK_LABEL[r]}
          </button>
        ))}
        <label className="sort-toggle">
          <input type="checkbox" checked={sortByRisk} onChange={() => setSortByRisk(!sortByRisk)} />
          worst first
        </label>
      </div>

      {failedBatches.length > 0 && (
        <div className="failed-batches">
          {failedBatches.map((b, i) => (
            <div key={i} className="failed-batch">
              ⚠ {b.length} clauses failed to analyze
              <button className="btn small" onClick={() => onRetryBatch(b)}>
                Retry
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="clause-list">
        {visible.map((c) => (
          <ClauseCard key={c.id} clause={c} />
        ))}
      </div>

      {skipped > 0 && (
        <div className="skipped-note">
          {skipped} clauses beyond the analysis budget were skipped (very long document). The
          most important terms usually appear early.
        </div>
      )}
    </div>
  );
}

function ClauseCard({ clause }) {
  const [showOriginal, setShowOriginal] = useState(false);
  const a = clause.analysis;

  return (
    <div className={`clause-card ${a ? a.risk : 'pending'}`}>
      <div className="clause-head">
        <span className="clause-num">{clause.index}</span>
        <span className="clause-title">{clause.title}</span>
        {a ? (
          <span className={`risk-badge ${a.risk}`}>{RISK_LABEL[a.risk]}</span>
        ) : (
          <span className="risk-badge pending">analyzing…</span>
        )}
      </div>
      {a && (
        <div className="clause-body">
          <p className="plain-english">{a.plainEnglish}</p>
          {a.isUnusual && a.whyUnusual && (
            <div className="unusual-box">
              <span className="unusual-tag">unusual</span> {a.whyUnusual}
            </div>
          )}
          {a.negotiationTip && <div className="tip-box">💬 {a.negotiationTip}</div>}
          <button className="original-toggle" onClick={() => setShowOriginal(!showOriginal)}>
            {showOriginal ? 'Hide original text' : 'Show original text'}
          </button>
          {showOriginal && <pre className="original-text">{clause.text}</pre>}
        </div>
      )}
    </div>
  );
}
