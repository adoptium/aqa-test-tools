import os
import json
from typing import List, Optional, Sequence, Any, Dict, Union
import numpy as np
import faiss

class FaissStore:
    """
    Manage a FAISS index + metadata store on disk.

    - store_dir: directory where index.faiss and metadata.json are stored.
    - Uses IndexFlatIP with IndexIDMap for id->vector mapping. Vectors are normalized
      so inner product == cosine similarity.
    """

    INDEX_FILENAME = "index.faiss"
    META_FILENAME = "metadata.json"

    def __init__(self, store_dir: Optional[str] = None):
        base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
        self.store_dir = os.path.abspath(store_dir) if store_dir else os.path.join(base_dir, "VectorStore")
        os.makedirs(self.store_dir, exist_ok=True)

        self.index_path = os.path.join(self.store_dir, self.INDEX_FILENAME)
        self.meta_path = os.path.join(self.store_dir, self.META_FILENAME)

        self.index: Optional[faiss.Index] = None
        # metadata mapping: str(id) -> {"metadata": ..., "text": ...}
        self._metastore: Dict[str, Dict[str, Any]] = {}
        self._next_id: int = 0

        # Try load existing if present
        if os.path.exists(self.index_path) and os.path.exists(self.meta_path):
            try:
                self.load()
            except Exception:
                # if loading fails, start fresh
                self.index = None
                self._metastore = {}
                self._next_id = 0

    def _ensure_index(self, dim: int):
        if self.index is None:
            # inner-product index + id map
            index_flat = faiss.IndexFlatIP(dim)
            self.index = faiss.IndexIDMap(index_flat)

    @staticmethod
    def _to_numpy(embs: Sequence[Sequence[float]]) -> np.ndarray:
        arr = np.array(embs, dtype="float32")
        if arr.ndim == 1:
            arr = arr.reshape(1, -1)
        return arr

    @staticmethod
    def _normalize_matrix(mat: np.ndarray) -> np.ndarray:
        norms = np.linalg.norm(mat, axis=1, keepdims=True)
        norms[norms == 0.0] = 1.0
        return mat / norms

    def build_from_embeddings(
        self,
        embeddings: Sequence[Sequence[float]],
        metadatas: Sequence[Any],
        texts: Optional[Sequence[str]] = None,
        ids: Optional[Sequence[int]] = None,
        overwrite: bool = True,
    ):
        """
        Build a new index from scratch from embeddings + metadatas (+ optional texts/ids).
        If overwrite=True, existing index/meta will be replaced.
        """
        if len(embeddings) != len(metadatas):
            raise ValueError("embeddings and metadatas must be same length")
        if texts is not None and len(texts) != len(embeddings):
            raise ValueError("texts length must equal embeddings length")

        mat = self._to_numpy(embeddings)
        mat = self._normalize_matrix(mat)
        n, dim = mat.shape

        if overwrite:
            # reset meta and index
            self._metastore = {}
            self.index = None
            self._next_id = 0

        self._ensure_index(dim)

        if ids is not None:
            if len(ids) != n:
                raise ValueError("ids length must equal embeddings length")
            id_array = np.array(ids, dtype="int64")
        else:
            # assign sequential ids
            id_array = np.arange(self._next_id, self._next_id + n, dtype="int64")

        # add to metastore
        for i, _id in enumerate(id_array.tolist()):
            key = str(int(_id))
            entry = {"metadata": metadatas[i]}
            if texts is not None:
                entry["text"] = texts[i]
            self._metastore[key] = entry

        # add vectors to index
        self.index.add_with_ids(mat, id_array)
        self._next_id = max(self._next_id, int(id_array.max()) + 1)

        # persist
        self.save()

    def add(
        self,
        embeddings: Sequence[Sequence[float]],
        metadatas: Sequence[Any],
        texts: Optional[Sequence[str]] = None,
        ids: Optional[Sequence[int]] = None,
    ):
        """
        Add more vectors to existing index (will create index if missing).
        """
        if len(embeddings) != len(metadatas):
            raise ValueError("embeddings and metadatas must be same length")
        if texts is not None and len(texts) != len(embeddings):
            raise ValueError("texts length must equal embeddings length")

        mat = self._to_numpy(embeddings)
        mat = self._normalize_matrix(mat)
        n, dim = mat.shape

        self._ensure_index(dim)

        if ids is not None:
            if len(ids) != n:
                raise ValueError("ids length must equal embeddings length")
            id_array = np.array(ids, dtype="int64")
        else:
            id_array = np.arange(self._next_id, self._next_id + n, dtype="int64")

        for i, _id in enumerate(id_array.tolist()):
            key = str(int(_id))
            entry = {"metadata": metadatas[i]}
            if texts is not None:
                entry["text"] = texts[i]
            self._metastore[key] = entry

        self.index.add_with_ids(mat, id_array)
        self._next_id = max(self._next_id, int(id_array.max()) + 1)
        self.save()

    def search(self, query_embedding: Sequence[float], top_k: int = 10) -> List[Dict[str, Any]]:
        """
        Search the index with a single query embedding.
        Returns list of dicts: {"id": int, "score": float, "metadata": ..., "text": ...}
        Score is cosine similarity in [-1,1].
        """
        if self.index is None:
            return []

        q = np.array(query_embedding, dtype="float32").reshape(1, -1)
        q = self._normalize_matrix(q)
        D, I = self.index.search(q, top_k)
        results = []
        for score, idx in zip(D[0].tolist(), I[0].tolist()):
            if idx == -1:
                continue
            key = str(int(idx))
            meta_entry = self._metastore.get(key, {})
            results.append(
                {
                    "id": int(idx),
                    "score": float(score),
                    "metadata": meta_entry.get("metadata"),
                    "text": meta_entry.get("text"),
                }
            )
        return results

    def save(self):
        """
        Persist FAISS index and metadata to disk.
        """
        if self.index is None:
            return
        # write index
        faiss.write_index(self.index, self.index_path)
        # write metadata
        payload = {"metastore": self._metastore, "next_id": self._next_id}
        with open(self.meta_path, "w", encoding="utf-8") as f:
            json.dump(payload, f, ensure_ascii=False, indent=2)

    def load(self):
        """
        Load index and metadata from disk.
        """
        if not os.path.exists(self.index_path) or not os.path.exists(self.meta_path):
            raise FileNotFoundError("Index or metadata file not found")

        self.index = faiss.read_index(self.index_path)
        with open(self.meta_path, "r", encoding="utf-8") as f:
            payload = json.load(f)
        self._metastore = payload.get("metastore", {})
        self._next_id = int(payload.get("next_id", 0))

    def clear(self):
        """
        Remove index and metadata files and reset in-memory state.
        """
        if os.path.exists(self.index_path):
            os.remove(self.index_path)
        if os.path.exists(self.meta_path):
            os.remove(self.meta_path)
        self.index = None
        self._metastore = {}
        self._next_id = 0


if __name__ == "__main__":
    # quick usage example
    store = FaissStore()
    # small test: two 3-d vectors
    embs = [[1.0, 0.0, 0.0], [0.0, 1.0, 0.0]]
    metas = [{"source": "a"}, {"source": "b"}]
    texts = ["first", "second"]
    store.build_from_embeddings(embs, metas, texts=texts, overwrite=True)
    q = [1.0, 0.0, 0.0]
    print(store.search(q, top_k=2))
