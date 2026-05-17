"""
rag/retriever.py
─────────────────────────────────────────────────────────────────
Loads the FAISS index + chunk metadata built by ingest.py.
Exposes a single function:

    retrieve(query: str, top_k: int = 5) -> list[dict]

Each returned dict:
    {
        "text":   "...chunk text...",
        "source": "anemia" | "diabetes" | "heart" | "liver",
        "score":  0.87          # cosine similarity (0–1, higher = more relevant)
    }

The retriever is initialised once at module import time so the
FAISS index and embedding model stay in memory across all requests.
"""

import pickle
from pathlib import Path

import numpy as np
import faiss
from sentence_transformers import SentenceTransformer

# ── Paths (mirror ingest.py) ──────────────────────────────────────
BASE_DIR      = Path(__file__).parent
INDEX_DIR     = BASE_DIR / "index"
FAISS_PATH    = INDEX_DIR / "faiss.index"
METADATA_PATH = INDEX_DIR / "chunks.pkl"

# ── Same model used during ingestion ─────────────────────────────
EMBED_MODEL = None

def get_model():
    global EMBED_MODEL
    if EMBED_MODEL is None:
        EMBED_MODEL = SentenceTransformer("paraphrase-MiniLM-L3-v2")
    return EMBED_MODEL

# ── Minimum similarity score to include a chunk ───────────────────
# Cosine similarity is 0–1; chunks below this threshold are noise.
MIN_SCORE = 0.25


# ═════════════════════════════════════════════════════════════════
# Module-level singleton — loaded once, reused across all requests
# ═════════════════════════════════════════════════════════════════

def _load_artifacts():
    """Load FAISS index, chunk metadata, and embedding model."""
    if not FAISS_PATH.exists() or not METADATA_PATH.exists():
        raise FileNotFoundError(
            "FAISS index not found. Run `python -m rag.ingest` first.\n"
            f"Expected files:\n  {FAISS_PATH}\n  {METADATA_PATH}"
        )

    print("  🔍 Loading FAISS index …")
    index = faiss.read_index(str(FAISS_PATH))

    print("  📦 Loading chunk metadata …")
    with open(METADATA_PATH, "rb") as f:
        chunks: list[dict] = pickle.load(f)

    print(f"  🤖 Loading embedding model…")
    model = get_model()

    print(f"  ✅ Retriever ready — {index.ntotal} vectors indexed")
    return index, chunks, model


# Load everything at import time (FastAPI startup)
try:
    _faiss_index, _chunks, _embed_model = _load_artifacts()
    RETRIEVER_READY = True
except FileNotFoundError as e:
    print(f"\n⚠️  RAG retriever NOT ready: {e}\n")
    _faiss_index = _chunks = _embed_model = None
    RETRIEVER_READY = False


# ═════════════════════════════════════════════════════════════════
# Public API
# ═════════════════════════════════════════════════════════════════

def retrieve(query: str, top_k: int = 5) -> list[dict]:
    """
    Embed `query` and return the top_k most relevant chunks.

    Parameters
    ----------
    query  : Natural language question from the user
    top_k  : Maximum number of chunks to return (default 5)

    Returns
    -------
    List of dicts with keys: text, source, score
    Empty list if retriever is not ready or no chunks pass MIN_SCORE.
    """
    if not RETRIEVER_READY:
        return []

    # 1. Embed the query (same model + normalisation as ingestion)
    query_vec = _embed_model.encode(
        [query],
        convert_to_numpy=True,
        normalize_embeddings=True,
    ).astype(np.float32)                     # shape: (1, 384)

    # 2. Search FAISS — returns distances (cosine scores) + indices
    scores, indices = _faiss_index.search(query_vec, top_k)
    scores  = scores[0]                      # shape: (top_k,)
    indices = indices[0]                     # shape: (top_k,)

    # 3. Collect results, filter by MIN_SCORE, deduplicate by source
    results = []
    seen_sources = {}                        # source → best chunk already added

    for score, idx in zip(scores, indices):
        if idx == -1:                        # FAISS returns -1 for empty slots
            continue
        if float(score) < MIN_SCORE:        # skip low-relevance chunks
            continue

        chunk  = _chunks[idx]
        source = chunk["source"]

        # Keep at most 2 chunks per disease source to stay balanced
        seen_sources[source] = seen_sources.get(source, 0) + 1
        if seen_sources[source] > 2:
            continue

        results.append({
            "text":   chunk["text"],
            "source": source,
            "score":  round(float(score), 4),
        })

    return results


def retrieve_for_diseases(query: str, diseases: list[str], top_k: int = 6) -> list[dict]:
    """
    Retrieve chunks, but boost results from diseases flagged by the ML model.

    Parameters
    ----------
    query    : User question
    diseases : List of disease names that had non-None ML scores
               e.g. ["anemia", "diabetes"]
    top_k    : Total chunks to fetch before disease-boosting filter

    Returns
    -------
    Chunks relevant to the query, prioritising flagged disease sources.
    """
    # Fetch a wider pool first
    candidates = retrieve(query, top_k=top_k * 2)

    if not candidates or not diseases:
        return candidates[:top_k]

    # Normalise disease names for comparison (e.g. "Heart Disease" → "heart")
    flagged = {d.lower().split()[0] for d in diseases}

    # Split into boosted (disease source matches ML flags) and rest
    boosted = [c for c in candidates if c["source"] in flagged]
    rest    = [c for c in candidates if c["source"] not in flagged]

    # Return boosted first, then fill with remaining up to top_k
    combined = (boosted + rest)[:top_k]
    return combined


def format_context(chunks: list[dict]) -> str:
    """
    Format retrieved chunks into a single context string for the LLM prompt.
    Each chunk is labelled with its disease source.
    """
    if not chunks:
        return "No specific medical knowledge retrieved."

    parts = []
    for i, chunk in enumerate(chunks, 1):
        source_label = chunk["source"].replace("_", " ").title()
        parts.append(
            f"[Source {i} — {source_label}]\n{chunk['text']}"
        )

    return "\n\n".join(parts)


# ═════════════════════════════════════════════════════════════════
# Quick self-test  (python -m rag.retriever)
# ═════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    test_queries = [
        "What does low hemoglobin mean?",
        "My HbA1c is 7.2, is that dangerous?",
        "High LDL cholesterol and heart risk",
        "What does elevated ALT indicate in liver disease?",
    ]

    print("\n" + "=" * 60)
    print("  RAG Retriever — Self Test")
    print("=" * 60)

    for q in test_queries:
        print(f"\n🔎 Query: {q}")
        results = retrieve(q, top_k=3)
        if not results:
            print("  ⚠️  No results (run ingest.py first)")
        for r in results:
            print(f"  [{r['source']}] score={r['score']}  {r['text'][:120].strip()} …")