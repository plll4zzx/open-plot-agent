"""
Chart RAG — vector search over past successfully generated plot.py files.

Uses FAISS + LangChain with Ollama embeddings (nomic-embed-text).
All operations fail silently so RAG never breaks the agent loop.

Quick start:
  1. ollama pull nomic-embed-text
  2. The RAG auto-indexes every chart after successful execute_python.
  3. Agent can call search_charts(query) to retrieve similar past code.
"""
from __future__ import annotations

import logging
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

_EMBED_MODEL = "nomic-embed-text"
_INDEX_DIR = Path.home() / "open-plot-agent" / "chart_index"


class ChartRAG:
    def __init__(self, index_dir: Path = _INDEX_DIR):
        self.index_dir = index_dir
        self.index_dir.mkdir(parents=True, exist_ok=True)
        self._store = None
        self._embeddings = None
        self._ready = False
        self._try_load()

    def _get_embeddings(self):
        if self._embeddings is not None:
            return self._embeddings
        from langchain_community.embeddings import OllamaEmbeddings
        self._embeddings = OllamaEmbeddings(model=_EMBED_MODEL)
        return self._embeddings

    def _try_load(self) -> None:
        faiss_file = self.index_dir / "index.faiss"
        if not faiss_file.exists():
            return
        try:
            from langchain_community.vectorstores import FAISS
            emb = self._get_embeddings()
            self._store = FAISS.load_local(
                str(self.index_dir), emb,
                allow_dangerous_deserialization=True,
            )
            self._ready = True
            logger.info("ChartRAG: loaded %s", self.index_dir)
        except Exception as e:
            logger.warning("ChartRAG: failed to load index: %s", e)

    def index_chart(self, code: str, metadata: Optional[dict] = None) -> bool:
        """
        Add a plot.py to the index. Returns True on success.
        Call this after every successful chart execution.
        """
        if not code.strip():
            return False
        try:
            from langchain_community.vectorstores import FAISS
            from langchain.schema import Document
            doc = Document(page_content=code, metadata=metadata or {})
            emb = self._get_embeddings()
            if self._store is None:
                self._store = FAISS.from_documents([doc], emb)
            else:
                self._store.add_documents([doc])
            self._store.save_local(str(self.index_dir))
            self._ready = True
            return True
        except Exception as e:
            logger.warning("ChartRAG.index_chart: %s", e)
            return False

    def search(self, query: str, k: int = 3) -> list[dict]:
        """
        Return up to k similar past chart scripts.
        Each result: {"code": str, "task": str, "score": float, ...metadata}
        """
        if not self._ready or self._store is None:
            return []
        try:
            results = self._store.similarity_search_with_score(query, k=k)
            out = []
            for doc, score in results:
                out.append({
                    "code": doc.page_content,
                    "similarity": round(1.0 - float(score) / 2.0, 3),  # normalize L2→[0,1]
                    **doc.metadata,
                })
            return out
        except Exception as e:
            logger.warning("ChartRAG.search: %s", e)
            return []

    @property
    def ready(self) -> bool:
        return self._ready

    @property
    def size(self) -> int:
        if self._store is None:
            return 0
        try:
            return self._store.index.ntotal
        except Exception:
            return 0


# ── Singleton ──────────────────────────────────────────────────────────────

_rag: Optional[ChartRAG] = None


def get_rag() -> ChartRAG:
    global _rag
    if _rag is None:
        _rag = ChartRAG()
    return _rag
