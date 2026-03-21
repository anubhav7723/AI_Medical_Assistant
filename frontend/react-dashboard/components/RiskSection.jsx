/* RiskSection.jsx
   Renders only after OCR succeeds.
   Flow: idle → [button] → loading → risk cards | error (retry button)
*/
function riskMeta(score) {
  if (score < 35) return { label:'Low Risk',      color:'var(--green)', bg:'var(--green-bg)' };
  if (score < 65) return { label:'Moderate Risk', color:'#d97706',      bg:'#fef3c7'         };
  return              { label:'High Risk',     color:'var(--red)',   bg:'var(--red-bg)'   };
}

export default function RiskSection({ ocrSuccess, status, predictions, error, onRun }) {
  if (!ocrSuccess) return null;

  return (
    <div className="fade-up">
      <div className="divider">
        <div className="divider-line" />
        <span className="divider-label">Risk Prediction</span>
        <div className="divider-line" />
      </div>

      {/* Button */}
      {(status === 'idle' || status === 'error') && (
        <button className="btn-primary" onClick={onRun}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
          </svg>
          {status === 'error' ? 'Retry Risk Prediction' : 'Predict Disease Risk'}
        </button>
      )}

      {/* Loading */}
      {status === 'loading' && (
        <div className="fade-up">
          <div className="status-row status-amber">
            <span className="spinner" /> Running ML models…
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:12 }}>
            {[0,1,2].map(i => (
              <div key={i} className="sk-line" style={{ height:100, borderRadius:10, animationDelay:`${i*0.1}s` }} />
            ))}
          </div>
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
            Prediction failed
          </div>
          <p className="error-msg">{error}</p>
        </div>
      )}

      {/* Results */}
      {status === 'success' && (
        <div className="fade-up">
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14, flexWrap:'wrap', gap:8 }}>
            <div className="status-row status-green" style={{ marginBottom:0 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              Predictions ready
            </div>
            <span style={{ fontSize:11, fontFamily:"'JetBrains Mono',monospace", color:'var(--ink-4)' }}>
              Random Forest · XGBoost
            </span>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:12 }}>
            {predictions.map((p) => {
              const { label, color, bg } = riskMeta(p.score);
              return (
                <div key={p.disease} style={{
                  background:'var(--surface)', border:'1px solid var(--border)',
                  borderLeft:`3px solid ${color}`, borderRadius:12, padding:'16px 18px',
                }}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10, gap:8 }}>
                    <span style={{ fontWeight:600, fontSize:14, color:'var(--ink)' }}>{p.disease}</span>
                    <span style={{ fontSize:10.5, fontFamily:"'JetBrains Mono',monospace", padding:'2px 8px', borderRadius:20, color, background:bg }}>
                      {label}
                    </span>
                  </div>
                  <div style={{ display:'flex', alignItems:'baseline', gap:3, marginBottom:10 }}>
                    <span style={{ fontFamily:"'Lora',serif", fontSize:34, lineHeight:1, fontWeight:500, color }}>{p.score}</span>
                    <span style={{ fontSize:14, color:'var(--ink-3)' }}>%</span>
                    <span style={{ marginLeft:'auto', fontSize:10, fontFamily:"'JetBrains Mono',monospace", color:'var(--ink-4)' }}>{p.model}</span>
                  </div>
                  <div style={{ height:4, background:'var(--border)', borderRadius:2, overflow:'hidden' }}>
                    <div style={{ height:'100%', width:`${p.score}%`, background:color, borderRadius:2, transition:'width .9s cubic-bezier(.4,0,.2,1)' }} />
                  </div>
                </div>
              );
            })}
          </div>

          <p className="disclaimer">
            ⓘ These predictions are for informational purposes only. Consult a qualified physician for diagnosis.
          </p>
        </div>
      )}
    </div>
  );
}