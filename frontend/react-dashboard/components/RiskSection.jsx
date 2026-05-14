/* RiskSection.jsx
   Redesigned: row-based cards with insight lines per prediction
*/

function riskMeta(score) {
  if (score < 35) return {
    label: 'Low Risk',
    color: 'var(--green)',
    bg: 'var(--green-bg)',
    icon: '✓',
    insight: (disease) => `Your ${disease.toLowerCase()} markers are within a healthy range. Continue maintaining your current lifestyle.`,
    barColor: '#16a34a',
  };
  if (score < 65) return {
    label: 'Moderate Risk',
    color: '#d97706',
    bg: '#fef3c7',
    icon: '⚠',
    insight: (disease) => `Some ${disease.toLowerCase()} indicators are slightly elevated. Monitoring and dietary adjustments are recommended.`,
    barColor: '#d97706',
  };
  return {
    label: 'High Risk',
    color: 'var(--red)',
    bg: 'var(--red-bg)',
    icon: '!',
    insight: (disease) => `Significant ${disease.toLowerCase()} risk detected from the available markers. Please consult a physician promptly.`,
    barColor: '#dc2626',
  };
}

function insightText(p) {
  const score = p.score;
  const disease = p.disease;

  if (disease === 'Liver Disease') {
    if (score >= 65) return `Elevated liver enzymes (ALP, Bilirubin, Albumin) suggest hepatic stress.`;
    if (score >= 35) return `Mild liver function irregularities detected. Avoid alcohol and monitor enzyme levels regularly.`;
    return `Liver function parameters appear normal. Stay hydrated and maintain a balanced diet.`;
  }
  if (disease === 'Diabetes') {
    if (score >= 65) return `HbA1c or glucose levels indicate high diabetic risk. Blood sugar management and specialist consultation needed.`;
    if (score >= 35) return `Blood glucose is trending upward. Reducing refined carbs and increasing physical activity is advised.`;
    return `Glucose and HbA1c levels are in a healthy range. Keep up with regular checkups.`;
  }
  if (disease === 'Anemia') {
    if (score >= 65) return `Low hemoglobin or RBC count strongly suggests anemia. Iron supplementation and dietary changes may be required.`;
    if (score >= 35) return `Borderline blood count values detected. Ensure adequate iron and B12 intake in your diet.`;
    return `Blood count markers look normal. No signs of anemia based on current report.`;
  }
  if (disease === 'Heart Disease') {
    if (score >= 65) return `Cholesterol or BP values indicate elevated cardiovascular risk. Lifestyle changes and cardiology consult recommended.`;
    if (score >= 35) return `Some lipid markers are borderline. Regular exercise and a heart-healthy diet are advised.`;
    return `Cardiovascular markers appear within acceptable limits. Maintain an active lifestyle.`;
  }
  // fallback
  const meta = riskMeta(score);
  return meta.insight(disease);
}

export default function RiskSection({ ocrSuccess, status, predictions, error, onRun }) {
  if (!ocrSuccess) return null;

  const visible = predictions?.filter(p => !p.skip && p.score != null) ?? [];

  return (
    <div className="fade-up">
      <div className="divider">
        <div className="divider-line" />
        <span className="divider-label"> ML Risk Prediction</span>
        <div className="divider-line" />
      </div>

      {/* Button */}
      {(status === 'idle' || status === 'error') && (
        <button className="btn-primary" onClick={onRun}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[0, 1, 2].map(i => (
              <div key={i} className="sk-line" style={{ height: 72, borderRadius: 10, animationDelay: `${i * 0.12}s` }} />
            ))}
          </div>
        </div>
      )}

      {/* Error */}
      {status === 'error' && (
        <div className="error-block fade-up">
          <div className="status-row status-red" style={{ marginBottom: 6 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            Prediction failed
          </div>
          <p className="error-msg">{error}</p>
        </div>
      )}

      {/* Results */}
      {status === 'success' && (
        <div className="fade-up">
          {/* Header row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
            <div className="status-row status-green" style={{ marginBottom: 0 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Predictions ready
            </div>
            <span style={{ fontSize: 11, fontFamily: "'JetBrains Mono',monospace", color: 'var(--ink-4)' }}>
              {[...new Set(visible.map(p => p.model).filter(Boolean))].join(' · ')}
            </span>
          </div>

          {/* Row cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {visible.map((p, idx) => {
              const { label, color, bg, barColor } = riskMeta(p.score);
              const insight = insightText(p);
              return (
                <div
                  key={p.disease}
                  style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderLeft: `4px solid ${color}`,
                    borderRadius: 12,
                    padding: '14px 18px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                    animation: `fadeUp .35s ease both`,
                    animationDelay: `${idx * 0.08}s`,
                  }}
                >
                  {/* Top row: name + badge + score */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 650, fontSize: 14, color: 'var(--ink)', flex: '0 0 auto' }}>
                      {p.disease}
                    </span>
                    <span style={{
                      fontSize: 10.5,
                      fontFamily: "'JetBrains Mono',monospace",
                      padding: '2px 9px',
                      borderRadius: 20,
                      color,
                      background: bg,
                      flex: '0 0 auto',
                    }}>
                      {label}
                    </span>

                    {/* Score + bar pushed to right */}
                    <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
                      {/* Mini bar */}
                      <div style={{ width: 80, height: 5, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{
                          height: '100%',
                          width: `${p.score}%`,
                          background: barColor,
                          borderRadius: 3,
                          transition: 'width 1s cubic-bezier(.4,0,.2,1)',
                        }} />
                      </div>
                      {/* Score */}
                      <span style={{
                        fontFamily: "'Lora',serif",
                        fontSize: 22,
                        fontWeight: 500,
                        color,
                        lineHeight: 1,
                        minWidth: 48,
                        textAlign: 'right',
                      }}>
                        {p.score}<span style={{ fontSize: 12, color: 'var(--ink-3)', fontFamily: 'inherit' }}>%</span>
                      </span>
                    </div>
                  </div>

                  {/* Insight line */}
                  <p style={{
                    margin: 0,
                    fontSize: 12.5,
                    color: 'var(--ink-3)',
                    lineHeight: 1.55,
                    borderTop: '1px solid var(--border)',
                    paddingTop: 8,
                  }}>
                    {insight}
                  </p>

                  {/* Model tag bottom-right */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <span style={{ fontSize: 10, fontFamily: "'JetBrains Mono',monospace", color: 'var(--ink-4)' }}>
                      {p.model}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <p className="disclaimer" style={{ marginTop: 16 }}>
            ⓘ These predictions are for informational purposes only. Consult a qualified physician for diagnosis.
          </p>
        </div>
      )}
    </div>
  );
}