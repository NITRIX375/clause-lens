export default function ExtractProgress({ stage, progress }) {
  const label =
    stage === 'profiling'
      ? 'Reading the document — identifying type and parties…'
      : progress?.stage === 'ocr'
        ? `Running OCR on page ${progress.page} of ${progress.pages}… (scanned documents take a minute)`
        : progress?.stage === 'ocr-start'
          ? 'No text layer found — switching to OCR…'
          : progress?.stage === 'pdf-text'
            ? `Extracting text — page ${progress.page} of ${progress.pages}`
            : 'Reading file…';

  const pct =
    progress?.pages && progress?.page ? Math.round((progress.page / progress.pages) * 100) : null;

  return (
    <div className="progress-screen">
      <div className="doc-anim">
        <div className="doc-sheet" />
        <div className="doc-scanline" />
      </div>
      <div className="progress-label">{label}</div>
      {pct != null && stage === 'extracting' && (
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${pct}%` }} />
        </div>
      )}
    </div>
  );
}
