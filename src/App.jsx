import { useReducer, useCallback, useState, useRef, useEffect } from 'react';
import Header from './components/Header.jsx';
import UploadScreen from './components/UploadScreen.jsx';
import ExtractProgress from './components/ExtractProgress.jsx';
import PartyPicker from './components/PartyPicker.jsx';
import ResultsView from './components/ResultsView.jsx';
import SettingsModal from './components/SettingsModal.jsx';
import { extract } from './lib/extract.js';
import { segment, applyBudget } from './lib/segmenter.js';
import {
  documentProfile,
  analyzeClauseBatch,
  executiveSummary,
  batches,
  getApiKey,
} from './lib/analyzer.js';
import { DEMO_CONTRACT } from './data/demoContract.js';

const initial = {
  stage: 'upload', // upload | extracting | profiling | pick-party | analyzing | done | error
  extraction: null,
  progress: null,
  profile: null,
  userRole: null,
  clauses: [],
  skipped: 0,
  summary: null,
  analyzedCount: 0,
  failedBatches: [],
  error: null,
};

function reducer(state, a) {
  switch (a.type) {
    case 'RESET':
      return { ...initial };
    case 'STAGE':
      return { ...state, stage: a.stage, error: a.error ?? state.error };
    case 'PROGRESS':
      return { ...state, progress: a.progress };
    case 'EXTRACTED':
      return { ...state, extraction: a.extraction };
    case 'PROFILED':
      return { ...state, profile: a.profile, clauses: a.clauses, skipped: a.skipped, stage: 'pick-party' };
    case 'ROLE':
      return { ...state, userRole: a.role, stage: 'analyzing' };
    case 'CLAUSE_RESULTS': {
      const map = new Map(a.results.map((r) => [r.id, r]));
      return {
        ...state,
        clauses: state.clauses.map((c) => (map.has(c.id) ? { ...c, analysis: map.get(c.id) } : c)),
        analyzedCount: state.analyzedCount + a.results.length,
      };
    }
    case 'BATCH_FAILED':
      return { ...state, failedBatches: [...state.failedBatches, a.batch] };
    case 'BATCH_RETRY_OK':
      return { ...state, failedBatches: state.failedBatches.filter((b) => b !== a.batch) };
    case 'SUMMARY':
      return { ...state, summary: a.summary, stage: 'done' };
    case 'ERROR':
      return { ...state, stage: 'error', error: a.error };
    default:
      return state;
  }
}

export default function App() {
  const [state, dispatch] = useReducer(reducer, initial);
  const [showSettings, setShowSettings] = useState(false);

  const startFromText = useCallback(async (text, method = 'text') => {
    try {
      dispatch({ type: 'EXTRACTED', extraction: { text, method } });
      if (!getApiKey()) {
        dispatch({ type: 'ERROR', error: 'NO_KEY' });
        return;
      }
      dispatch({ type: 'STAGE', stage: 'profiling' });
      const profile = await documentProfile(text);
      const { clauses, skipped } = applyBudget(segment(text));
      dispatch({ type: 'PROFILED', profile, clauses, skipped });
    } catch (e) {
      dispatch({ type: 'ERROR', error: e.message });
    }
  }, []);

  const onFile = useCallback(
    async (file) => {
      dispatch({ type: 'STAGE', stage: 'extracting' });
      try {
        const extraction = await extract(file, (p) => dispatch({ type: 'PROGRESS', progress: p }));
        if (!extraction.text || extraction.text.length < 200) {
          dispatch({
            type: 'ERROR',
            error: 'Could not extract readable text from this file. Try a clearer scan, or paste the text instead.',
          });
          return;
        }
        await startFromText(extraction.text, extraction.method);
      } catch (e) {
        dispatch({ type: 'ERROR', error: e.message });
      }
    },
    [startFromText]
  );

  const onPickRole = useCallback(
    async (role) => {
      dispatch({ type: 'ROLE', role });
      const { profile, clauses } = stateRef.current;
      const groups = batches(clauses);
      for (const group of groups) {
        try {
          const results = await analyzeClauseBatch(profile, role, group);
          dispatch({ type: 'CLAUSE_RESULTS', results });
        } catch {
          dispatch({ type: 'BATCH_FAILED', batch: group });
        }
      }
      try {
        const done = stateRef.current.clauses;
        const summary = await executiveSummary(profile, role, done);
        dispatch({ type: 'SUMMARY', summary });
      } catch {
        dispatch({ type: 'SUMMARY', summary: null });
      }
    },
    []
  );

  const retryBatch = useCallback(async (batch) => {
    try {
      const results = await analyzeClauseBatch(stateRef.current.profile, stateRef.current.userRole, batch);
      dispatch({ type: 'CLAUSE_RESULTS', results });
      dispatch({ type: 'BATCH_RETRY_OK', batch });
    } catch (e) {
      dispatch({ type: 'ERROR', error: `Retry failed: ${e.message}` });
    }
  }, []);

  // keep a live ref for async loops
  const stateRef = useRefLike(state);

  const onDemo = useCallback(() => startFromText(DEMO_CONTRACT, 'demo'), [startFromText]);

  return (
    <div className="app">
      <Header
        onReset={() => dispatch({ type: 'RESET' })}
        onSettings={() => setShowSettings(true)}
        showReset={state.stage !== 'upload'}
      />
      {state.stage === 'upload' && <UploadScreen onFile={onFile} onText={startFromText} onDemo={onDemo} />}
      {(state.stage === 'extracting' || state.stage === 'profiling') && (
        <ExtractProgress stage={state.stage} progress={state.progress} />
      )}
      {state.stage === 'pick-party' && <PartyPicker profile={state.profile} onPick={onPickRole} />}
      {(state.stage === 'analyzing' || state.stage === 'done') && (
        <ResultsView state={state} onRetryBatch={retryBatch} />
      )}
      {state.stage === 'error' && (
        <div className="error-screen">
          {state.error === 'NO_KEY' ? (
            <>
              <h2>Add your API key to analyze</h2>
              <p>
                ClauseLens uses the Gemini API for analysis. Add your Gemini API key in
                Settings — extraction happens locally either way.
              </p>
              <button className="btn primary" onClick={() => setShowSettings(true)}>
                Open Settings
              </button>
            </>
          ) : (
            <>
              <h2>Something went wrong</h2>
              <p>{state.error}</p>
            </>
          )}
          <button className="btn ghost" onClick={() => dispatch({ type: 'RESET' })}>
            Start over
          </button>
        </div>
      )}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
      <footer className="disclaimer-bar">
        ClauseLens is an AI reading aid, <b>not legal advice</b>. For decisions that matter,
        consult a qualified lawyer.
      </footer>
    </div>
  );
}

// tiny helper: a ref that always mirrors latest state without re-render loops
function useRefLike(value) {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  });
  return ref;
}
