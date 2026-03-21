const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

/**
 * POST /summarize
 * Body   : { text: string, predictions: array }
 * Returns: { overview: string, abnormal: Array<{param,value,note}>, suggestions: string[] }
 */
export async function summarizeReport(text, predictions) {
  const res = await fetch(`${BASE}/summarize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, predictions }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail ?? `Summarization failed (HTTP ${res.status})`);
  }
  return res.json();
}