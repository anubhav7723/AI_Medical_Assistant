/* SummarySection.jsx
   Renders only after Risk Prediction succeeds.
   Flow: idle → [button] → loading → structured LLM output | error (retry button)
*/
export default function SummarySection({ riskSuccess, status, summary, error, onRun }) {
  if (!riskSuccess) return null;

  return (
    <div className="fade-up">
      <div className="divider">
        <div className="divider-line" />
        <span className="divider-label">AI Summary</span>
        <div className="divider-line" />
      </div>

      {/* Button */}
      {(status === 'idle' || status === 'error') && (
        <button className="btn-primary" onClick={onRun}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
          </svg>
          {status === 'error' ? 'Retry Summarization' : 'Summarize with AI'}
        </button>
      )}

      {/* Loading */}
      {status === 'loading' && (
        <div className="fade-up">
          <div className="status-row status-amber">
            <span className="spinner" /> Generating AI summary…
          </div>
          {[100,72,88,60,94,78].map((w,i) => (
            <div key={i} className="sk-line" style={{ width:`${w}%`, animationDelay:`${i*0.08}s` }} />
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
            Summarization failed
          </div>
          <p className="error-msg">{error}</p>
          <p className="error-hint">Check your API connection or try again in a moment.</p>
        </div>
      )}

      {/* Success */}
      {status === 'success' && summary && (
        <div className="fade-up">
          <div className="status-row status-green" style={{ marginBottom:18 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            Summary complete
          </div>

          {/* Overview */}
          <div style={block}>
            <SectionTitle color="var(--ink-3)" icon={infoIcon}>Clinical Overview</SectionTitle>
            <p style={{ fontFamily:"'Lora',serif", fontSize:15, lineHeight:1.85, color:'var(--ink-2)' }}>
              {summary.overview}
            </p>
          </div>

          {/* Abnormal params */}
          {summary.abnormal?.length > 0 && (
            <div style={block}>
              <SectionTitle color="var(--amber)" icon={warnIcon}>Abnormal Parameters</SectionTitle>
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {summary.abnormal.map((item, i) => (
                  <div key={i} style={{
                    display:'flex', alignItems:'flex-start', justifyContent:'space-between',
                    gap:16, padding:'10px 14px', background:'var(--surface2)', borderRadius:8, flexWrap:'wrap',
                  }}>
                    <div style={{ display:'flex', alignItems:'center', gap:12, flexShrink:0 }}>
                      <span style={{ fontWeight:600, fontSize:13, color:'var(--ink)', minWidth:140 }}>{item.param}</span>
                      <span style={{
                        fontFamily:"'JetBrains Mono',monospace", fontSize:12,
                        color:'var(--red)', background:'var(--red-bg)',
                        padding:'2px 8px', borderRadius:5,
                      }}>{item.value}</span>
                    </div>
                    <span style={{ fontSize:12.5, color:'var(--ink-3)', lineHeight:1.5, textAlign:'right' }}>{item.note}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recommendations */}
          {summary.suggestions?.length > 0 && (
            <div style={block}>
              <SectionTitle color="var(--green)" icon={checkIcon}>Recommendations</SectionTitle>
              <ol style={{ listStyle:'none', display:'flex', flexDirection:'column', gap:8 }}>
                {summary.suggestions.map((s, i) => (
                  <li key={i} style={{ display:'flex', gap:14, alignItems:'flex-start' }}>
                    <span style={{
                      fontFamily:"'JetBrains Mono',monospace", fontSize:11,
                      color:'var(--green)', background:'var(--green-bg)',
                      padding:'2px 7px', borderRadius:5, flexShrink:0, marginTop:1,
                    }}>
                      {String(i+1).padStart(2,'0')}
                    </span>
                    <span style={{ fontSize:13.5, color:'var(--ink-2)', lineHeight:1.65 }}>{s}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          <p className="disclaimer">
            ⓘ This AI-generated summary is not a substitute for professional medical advice. Always consult a licensed physician.
          </p>
        </div>
      )}
    </div>
  );
}

/* ── helpers ─────────────────────────────────────────────────── */
const block = {
  background:'var(--surface)', border:'1px solid var(--border)',
  borderRadius:12, padding:'18px 20px', marginBottom:12,
};

function SectionTitle({ children, color, icon }) {
  return (
    <div style={{
      display:'flex', alignItems:'center', gap:7, marginBottom:14,
      fontSize:10.5, fontFamily:"'JetBrains Mono',monospace",
      textTransform:'uppercase', letterSpacing:'.08em', color,
    }}>
      {icon}
      {children}
    </div>
  );
}

const infoIcon = (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10"/>
    <line x1="12" y1="16" x2="12" y2="12"/>
    <line x1="12" y1="8" x2="12.01" y2="8"/>
  </svg>
);
const warnIcon = (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
    <line x1="12" y1="9" x2="12" y2="13"/>
    <line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
);
const checkIcon = (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="9 11 12 14 22 4"/>
    <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
  </svg>
);