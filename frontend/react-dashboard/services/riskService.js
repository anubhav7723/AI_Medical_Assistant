const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

/**
 * POST /predict
 * Body   : { text: string }
 * Returns: { predictions: Array<{ disease: string, score: number, model: string }> }
 */
export async function predictRisk(text) {
  const res = await fetch(`${BASE}/predict`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail ?? `Prediction failed (HTTP ${res.status})`);
  }
  return res.json();
}