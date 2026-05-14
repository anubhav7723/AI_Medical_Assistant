import { useState } from 'react';
import UploadZone      from '../components/UploadZone';
import OCRSection      from '../components/OCRSection';
import RiskSection     from '../components/RiskSection';
import SummarySection  from '../components/SummarySection';
import { extractText }     from '../services/ocrService';
import { predictRisk }     from '../services/riskService';
import { summarizeReport } from '../services/summaryService';
import Chatbot from '../components/Chatbot';

export default function App() {
  // ── File ─────────────────────────────────────────────────────
  const [file,        setFile]        = useState(null);

  // ── OCR ──────────────────────────────────────────────────────
  const [ocrStatus,   setOcrStatus]   = useState('idle'); // idle | loading | success | error
  const [ocrText,     setOcrText]     = useState('');
  const [ocrError,    setOcrError]    = useState('');

  // ── Risk ─────────────────────────────────────────────────────
  const [riskStatus,  setRiskStatus]  = useState('idle');
  const [predictions, setPredictions] = useState([]);
  const [riskError,   setRiskError]   = useState('');

  // ── Summary ──────────────────────────────────────────────────
  const [sumStatus,   setSumStatus]   = useState('idle');
  const [summary,     setSummary]     = useState(null);
  const [sumError,    setSumError]    = useState('');

  // ── File handlers ─────────────────────────────────────────────
  function handleFileSelect(f) {
    setFile(f);
    // reset entire pipeline on new file
    setOcrStatus('idle');  setOcrText('');     setOcrError('');
    setRiskStatus('idle'); setPredictions([]); setRiskError('');
    setSumStatus('idle');  setSummary(null);   setSumError('');
  }

  function handleFileRemove() {
    setFile(null);
    setOcrStatus('idle');  setOcrText('');     setOcrError('');
    setRiskStatus('idle'); setPredictions([]); setRiskError('');
    setSumStatus('idle');  setSummary(null);   setSumError('');
  }

  // ── Pipeline handlers ─────────────────────────────────────────
  async function handleOCR() {
    setOcrStatus('loading');
    // reset downstream
    setRiskStatus('idle'); setPredictions([]); setRiskError('');
    setSumStatus('idle');  setSummary(null);   setSumError('');
    try {
      const res = await extractText(file);
      setOcrText(res.text);
      setOcrStatus('success');
    } catch (e) {
      setOcrError(e.message ?? 'OCR extraction failed. Please try again.');
      setOcrStatus('error');
    }
  }

  async function handlePredict() {
    setRiskStatus('loading');
    // reset downstream
    setSumStatus('idle'); setSummary(null); setSumError('');
    try {
      const res = await predictRisk(ocrText);
      setPredictions(res.predictions);
      setRiskStatus('success');
    } catch (e) {
      setRiskError(e.message ?? 'Risk prediction failed. Please try again.');
      setRiskStatus('error');
    }
  }

  async function handleSummary() {
    setSumStatus('loading');
    try {
      const res = await summarizeReport(ocrText, predictions);
      setSummary(res);
      setSumStatus('success');
    } catch (e) {
      setSumError(e.message ?? 'Summarization failed. Please try again.');
      setSumStatus('error');
    }
  }

  // ── Render ────────────────────────────────────────────────────
  return (
    <>
      {/* Header */}
      <header className="header">
        <div className="header-inner">
          <div className="header-brand">
            <div className="header-logo">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
              </svg>
            </div>
            <div>
              <div className="header-title">MediTalk</div>
              <div className="header-sub">AI Medical Assistant</div>
            </div>
          </div>
          <span className="header-badge">● Active</span>
        </div>
      </header>

      {/* Main content */}
      <div className="page-wrap">

        {/* Step 1 — always visible */}
        <UploadZone
          file={file}
          onFileSelect={handleFileSelect}
          onFileRemove={handleFileRemove}
        />

        {/* Step 2 — visible once file is selected */}
        <OCRSection
          file={file}
          status={ocrStatus}
          text={ocrText}
          error={ocrError}
          onRun={handleOCR}
        />

        {/* Step 3 — visible once OCR succeeds */}
        <RiskSection
          ocrSuccess={ocrStatus === 'success'}
          status={riskStatus}
          predictions={predictions}
          error={riskError}
          onRun={handlePredict}
        />

        {/* Step 4 — visible once Risk prediction succeeds */}
        <SummarySection
          riskSuccess={riskStatus === 'success'}
          status={sumStatus}
          summary={summary}
          error={sumError}
          onRun={handleSummary}
        />

      </div>
      {/* Mediee chatbot — fixed bottom right */}
      <Chatbot
        reportContext={{
          predictions: predictions,                      // ← your useState: setPredictions
          summary:     summary?.overview ?? '',          // ← your useState: setSummary (overview field from /summarize)
          parameters:  summary?.abnormal ?? {},          // ← abnormal params from /summarize
        }}
      />
    </>
  );
}