const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

/**
 * POST /ocr
 * Body   : multipart/form-data { file: File }
 * Returns: { text: string }
 */
export async function extractText(file) {
  const form = new FormData();
  form.append('file', file);

  const res = await fetch(`${BASE}/ocr`, { method: 'POST', body: form });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail ?? `OCR failed (HTTP ${res.status})`);
  }
  return res.json();
}