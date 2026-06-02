
import os
import json
import pickle
from pathlib import Path

import numpy as np
import faiss
from sentence_transformers import SentenceTransformer

# ── Paths ─────────────────────────────────────────────────────────
BASE_DIR   = Path(__file__).parent          # backend/rag/
DATA_DIR   = BASE_DIR / "data"              # backend/rag/data/
INDEX_DIR  = BASE_DIR / "index"             # backend/rag/index/  (auto-created)
INDEX_DIR.mkdir(exist_ok=True)

FAISS_PATH    = INDEX_DIR / "faiss.index"
METADATA_PATH = INDEX_DIR / "chunks.pkl"   # list of {"text": ..., "source": ...}

# ── Chunking config ───────────────────────────────────────────────
CHUNK_SIZE    = 400   # characters per chunk
CHUNK_OVERLAP = 80    # overlap between consecutive chunks

# ── Embedding model ───────────────────────────────────────────────
# all-MiniLM-L6-v2: lightweight (80 MB), 384-dim, great for medical Q&A retrieval
EMBED_MODEL = None

def get_model():
    global EMBED_MODEL
    if EMBED_MODEL is None:
        EMBED_MODEL = SentenceTransformer("paraphrase-MiniLM-L3-v2")
    return EMBED_MODEL


def load_txt_files(data_dir: Path) -> list[dict]:
    """Load all .txt files; return list of {source, text} dicts."""
    documents = []
    for path in sorted(data_dir.glob("*.txt")):
        text = path.read_text(encoding="utf-8")
        documents.append({"source": path.stem, "text": text})
        print(f"  📄 Loaded: {path.name}  ({len(text):,} chars)")
    return documents


def chunk_document(doc: dict, chunk_size: int, overlap: int) -> list[dict]:
    """
    Split a document into overlapping character-level chunks.
    Each chunk preserves its source label for citation.
    """
    text   = doc["text"]
    source = doc["source"]
    chunks = []
    start  = 0

    while start < len(text):
        end   = min(start + chunk_size, len(text))
        chunk = text[start:end].strip()

        if len(chunk) > 50:          # skip tiny trailing fragments
            chunks.append({"text": chunk, "source": source})

        if end == len(text):
            break
        start += chunk_size - overlap

    return chunks


def embed_chunks(chunks: list[dict], model: SentenceTransformer) -> np.ndarray:
    """Embed all chunk texts; return float32 array shape (N, dim)."""
    texts = [c["text"] for c in chunks]
    print(f"\n  🔢 Embedding {len(texts)} chunks …")
    embeddings = model.encode(
        texts,
        batch_size=64,
        show_progress_bar=True,
        convert_to_numpy=True,
        normalize_embeddings=True,   # cosine similarity via inner product
    )
    return embeddings.astype(np.float32)


def build_faiss_index(embeddings: np.ndarray) -> faiss.Index:
    """
    Build a flat inner-product index (equivalent to cosine similarity
    when embeddings are L2-normalised).
    For larger corpora switch to IndexIVFFlat or IndexHNSWFlat.
    """
    dim   = embeddings.shape[1]
    index = faiss.IndexFlatIP(dim)   # IP = Inner Product
    index.add(embeddings)
    print(f"  🗂️  FAISS index built: {index.ntotal} vectors, dim={dim}")
    return index


def main():
    print("=" * 55)
    print("  MedAI — FAISS Ingestion Pipeline")
    print("=" * 55)

    # 1. Load txt files
    print("\n[1/4] Loading disease documents …")
    documents = load_txt_files(DATA_DIR)
    if not documents:
        raise FileNotFoundError(f"No .txt files found in {DATA_DIR}")

    # 2. Chunk all documents
    print(f"\n[2/4] Chunking (size={CHUNK_SIZE}, overlap={CHUNK_OVERLAP}) …")
    all_chunks: list[dict] = []
    for doc in documents:
        chunks = chunk_document(doc, CHUNK_SIZE, CHUNK_OVERLAP)
        print(f"  ✂️  {doc['source']}: {len(chunks)} chunks")
        all_chunks.extend(chunks)
    print(f"  Total chunks: {len(all_chunks)}")

    # 3. Load embedding model and embed
    print(f"\n[3/4] Loading embedding model …")
    model      = get_model()
    embeddings = embed_chunks(all_chunks, model)

    # 4. Build FAISS index and save artifacts
    print("\n[4/4] Building FAISS index and saving …")
    index = build_faiss_index(embeddings)

    faiss.write_index(index, str(FAISS_PATH))
    print(f"  💾 FAISS index saved  → {FAISS_PATH}")

    with open(METADATA_PATH, "wb") as f:
        pickle.dump(all_chunks, f)
    print(f"  💾 Chunk metadata saved → {METADATA_PATH}")

    # Summary
    print("\n" + "=" * 55)
    print("  ✅ Ingestion complete!")
    print(f"     Documents : {len(documents)}")
    print(f"     Chunks    : {len(all_chunks)}")
    print(f"     Embedding : {embeddings.shape[1]}-dim")
    print(f"     Index     : {FAISS_PATH}")
    print("=" * 55)


if __name__ == "__main__":
    main()