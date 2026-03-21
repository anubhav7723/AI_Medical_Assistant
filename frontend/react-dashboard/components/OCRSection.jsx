/* OCRSection.jsx
   Renders after a file is selected.
   Flow: idle → [button] → loading → success (text box) | error (retry button)
*/
export default function OCRSection({ file, status, text, error, onRun }) {
  if (!file) return null;

  return (
    <div className="fade-up">
      <div className="divider">
        <div className="divider-line" />
        <span className="divider-label">Text Extraction</span>
        <div className="divider-line" />
      </div>

      {/* Button: show when idle or after error */}
      {(status === 'idle' || status === 'error') && (
        <button className="btn-primary" onClick={onRun}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="16" y1="13" x2="8" y2="13"/>
            <line x1="16" y1="17" x2="8" y2="17"/>
          </svg>
          {status === 'error' ? 'Retry OCR Extraction' : 'Extract Text via OCR'}
        </button>
      )}

      {/* Loading */}
      {status === 'loading' && (
        <div className="fade-up">
          <div className="status-row status-amber">
            <span className="spinner" />
            Extracting text from document…
          </div>
          {[100,80,92,65,88,72,95,58].map((w,i) => (
            <div key={i} className="sk-line" style={{ width:`${w}%`, animationDelay:`${i*0.06}s` }} />
          ))}
        </div>
      )}

      {/* Error */}
      {status === 'error' && (
        <div className="error-block fade-up">
          <div className="status-row status-red" style={{ marginBottom:6 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            Extraction failed
          </div>
          <p className="error-msg">{error}</p>
          <p className="error-hint">
            Ensure the file is a clear, readable scan. Blurry or low-resolution documents may fail OCR.
          </p>
        </div>
      )}

      {/* Success */}
      {status === 'success' && (
        <div className="fade-up">
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10, flexWrap:'wrap', gap:8 }}>
            <div className="status-row status-green" style={{ marginBottom:0 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              Text extracted successfully
            </div>
            <span style={{
              fontSize:11, fontFamily:"'JetBrains Mono',monospace",
              color:'var(--ink-4)', background:'var(--surface2)',
              padding:'2px 9px', borderRadius:20,
            }}>
              {text.length.toLocaleString()} chars
            </span>
          </div>
          <pre style={{
            background:'var(--surface)', border:'1px solid var(--border)',
            borderRadius:10, padding:'16px 18px',
            fontFamily:"'JetBrains Mono',monospace", fontSize:12,
            lineHeight:1.85, color:'var(--ink-2)',
            whiteSpace:'pre-wrap', wordBreak:'break-word',
            maxHeight:320, overflowY:'auto',
          }}>
            {text}
          </pre>
        </div>
      )}
    </div>
  );
}