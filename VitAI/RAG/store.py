import os
import json
import re
import logging
from typing import List, Optional, Sequence, Any, Dict, Union
from datetime import datetime
from fnmatch import fnmatch
from collections import OrderedDict
import numpy as np
import faiss

logger = logging.getLogger(__name__)


class RepositoryNotFoundError(Exception):
    """Raised when repository doesn't exist."""
    pass


class InvalidMetadataError(Exception):
    """Raised when metadata validation fails."""
    pass


class FaissStore:
    """
    Multi-repository FAISS vector store with incremental update support.

    Features:
    - Separate index per repository with namespacing
    - Incremental updates (add/update/delete file chunks)
    - Soft deletion for efficient updates
    - Advanced search with filtering
    - LRU cache for repository indices
    - Repository statistics and management

    Directory Structure:
        VectorStore/
        ├── owner_repo-a/
        │   ├── index.faiss
        │   └── metadata.json
        └── owner_repo-b/
            ├── index.faiss
            └── metadata.json
    """

    INDEX_FILENAME = "index.faiss"
    META_FILENAME = "metadata.json"

    def __init__(self, base_dir: Optional[str] = None, cache_size: int = 5):
        """
        Initialize multi-repository store.

        Args:
            base_dir: Base directory for all repositories
            cache_size: Max number of repository indices to keep in memory
        """
        if base_dir:
            self.base_dir = os.path.abspath(base_dir)
        else:
            parent_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
            self.base_dir = os.path.join(parent_dir, "VectorStore")
        
        os.makedirs(self.base_dir, exist_ok=True)

        self.cache_size = cache_size
        # LRU cache: {repo_name: store_dict}
        self._repo_cache: OrderedDict[str, Dict] = OrderedDict()

    def _sanitize_repo_name(self, repo_name: str) -> str:
        """Convert 'owner/repo' to 'owner_repo' for directory names."""
        return repo_name.replace("/", "_").replace("\\", "_")

    def _get_repo_dir(self, repo_name: str) -> str:
        """Get directory path for a repository."""
        sanitized = self._sanitize_repo_name(repo_name)
        return os.path.join(self.base_dir, sanitized)

    def _get_repo_paths(self, repo_name: str) -> tuple[str, str]:
        """Get (index_path, meta_path) for a repository."""
        repo_dir = self._get_repo_dir(repo_name)
        index_path = os.path.join(repo_dir, self.INDEX_FILENAME)
        meta_path = os.path.join(repo_dir, self.META_FILENAME)
        return index_path, meta_path

    def _repo_exists(self, repo_name: str) -> bool:
        """Check if repository index exists on disk."""
        index_path, meta_path = self._get_repo_paths(repo_name)
        return os.path.exists(index_path) and os.path.exists(meta_path)

    def _load_repo_from_disk(self, repo_name: str) -> Dict:
        """Load repository index and metadata from disk."""
        index_path, meta_path = self._get_repo_paths(repo_name)
        
        if not os.path.exists(index_path) or not os.path.exists(meta_path):
            # Create new empty repository
            logger.info(f"Creating new repository: {repo_name}")
            return {
                'index': None,
                'metastore': {},
                'next_id': 0,
                'index_path': index_path,
                'meta_path': meta_path,
                'repo_name': repo_name
            }

        try:
            logger.debug(f"Loading repository from disk: {repo_name}")
            index = faiss.read_index(index_path)
            
            with open(meta_path, "r", encoding="utf-8") as f:
                payload = json.load(f)
            
            return {
                'index': index,
                'metastore': payload.get("metastore", {}),
                'next_id': int(payload.get("next_id", 0)),
                'index_path': index_path,
                'meta_path': meta_path,
                'repo_name': repo_name
            }
        except Exception as e:
            logger.error(f"Failed to load repository {repo_name}: {e}")
            raise

    def _save_repo_to_disk(self, store: Dict):
        """Save repository index and metadata to disk."""
        if store['index'] is None:
            return

        repo_dir = os.path.dirname(store['index_path'])
        os.makedirs(repo_dir, exist_ok=True)

        # Write index
        faiss.write_index(store['index'], store['index_path'])
        
        # Write metadata
        payload = {
            "metastore": store['metastore'],
            "next_id": store['next_id']
        }
        with open(store['meta_path'], "w", encoding="utf-8") as f:
            json.dump(payload, f, ensure_ascii=False, indent=2)
        
        logger.debug(f"Saved repository to disk: {store['repo_name']}")

    def _get_repo_store(self, repo_name: str) -> Dict:
        """
        Get or load repository store with LRU caching.

        Returns:
            {
                'index': faiss.Index,
                'metastore': Dict[str, Dict],
                'next_id': int,
                'index_path': str,
                'meta_path': str,
                'repo_name': str
            }
        """
        # Check cache (move to end if exists = mark as recently used)
        if repo_name in self._repo_cache:
            logger.debug(f"Cache hit for {repo_name}")
            self._repo_cache.move_to_end(repo_name)
            return self._repo_cache[repo_name]

        # Load from disk
        logger.debug(f"Cache miss for {repo_name}, loading from disk")
        store = self._load_repo_from_disk(repo_name)

        # Evict LRU if cache is full
        if len(self._repo_cache) >= self.cache_size:
            evicted_name, evicted_store = self._repo_cache.popitem(last=False)
            # Save evicted store before removing from cache
            self._save_repo_to_disk(evicted_store)
            logger.debug(f"Evicted {evicted_name} from cache")

        # Add to cache
        self._repo_cache[repo_name] = store
        return store

    def _ensure_index(self, store: Dict, dim: int):
        """Create index for repository if it doesn't exist."""
        if store['index'] is None:
            index_flat = faiss.IndexFlatIP(dim)
            store['index'] = faiss.IndexIDMap(index_flat)
            logger.info(f"Created new index for {store['repo_name']} with dimension {dim}")

    @staticmethod
    def _to_numpy(embs: Sequence[Sequence[float]]) -> np.ndarray:
        """Convert embeddings to numpy array."""
        arr = np.array(embs, dtype="float32")
        if arr.ndim == 1:
            arr = arr.reshape(1, -1)
        return arr

    @staticmethod
    def _normalize_matrix(mat: np.ndarray) -> np.ndarray:
        """Normalize vectors for cosine similarity via inner product."""
        norms = np.linalg.norm(mat, axis=1, keepdims=True)
        norms[norms == 0.0] = 1.0
        return mat / norms

    def _validate_metadata(self, metadata: Dict) -> bool:
        """Validate that metadata has required fields."""
        required_fields = {'chunk_id', 'file_path', 'repo_name'}
        return required_fields.issubset(metadata.keys())

    def _get_chunks_by_file(self, store: Dict, file_path: str) -> List[int]:
        """Get all chunk IDs for a specific file path."""
        chunk_ids = []
        for key, entry in store['metastore'].items():
            meta = entry.get('metadata', {})
            if meta.get('file_path') == file_path and not meta.get('deleted', False):
                chunk_ids.append(int(key))
        return chunk_ids

    def _soft_delete_chunks(self, store: Dict, chunk_ids: List[int]):
        """Mark chunks as deleted in metadata."""
        deleted_count = 0
        for cid in chunk_ids:
            key = str(cid)
            if key in store['metastore']:
                store['metastore'][key]['metadata']['deleted'] = True
                deleted_count += 1
        logger.debug(f"Soft-deleted {deleted_count} chunks")

    def add_to_repo(
        self,
        repo_name: str,
        embeddings: Sequence[Sequence[float]],
        metadatas: Sequence[Dict],
        texts: Optional[Sequence[str]] = None,
        ids: Optional[Sequence[int]] = None,
    ):
        """
        Add vectors to a repository's index.

        Args:
            repo_name: Repository identifier (e.g., "owner/repo")
            embeddings: List of embedding vectors
            metadatas: List of metadata dicts (must include chunk_id, file_path, repo_name)
            texts: Optional chunk content
            ids: Optional custom IDs (auto-generated if not provided)

        Raises:
            InvalidMetadataError: If metadata validation fails
        """
        if len(embeddings) != len(metadatas):
            raise ValueError("embeddings and metadatas must be same length")
        if texts is not None and len(texts) != len(embeddings):
            raise ValueError("texts length must equal embeddings length")

        # Validate metadata
        for meta in metadatas:
            if not self._validate_metadata(meta):
                raise InvalidMetadataError(
                    f"Metadata missing required fields. Required: chunk_id, file_path, repo_name. Got: {meta.keys()}"
                )
            # Ensure deleted flag exists
            if 'deleted' not in meta:
                meta['deleted'] = False
            # Add timestamp if not present
            if 'created_at' not in meta:
                meta['created_at'] = datetime.utcnow().isoformat()

        store = self._get_repo_store(repo_name)
        
        mat = self._to_numpy(embeddings)
        mat = self._normalize_matrix(mat)
        n, dim = mat.shape

        self._ensure_index(store, dim)

        if ids is not None:
            if len(ids) != n:
                raise ValueError("ids length must equal embeddings length")
            id_array = np.array(ids, dtype="int64")
        else:
            id_array = np.arange(store['next_id'], store['next_id'] + n, dtype="int64")

        # Add to metastore
        for i, _id in enumerate(id_array.tolist()):
            key = str(int(_id))
            entry = {"metadata": metadatas[i]}
            if texts is not None:
                entry["text"] = texts[i]
            store['metastore'][key] = entry

        # Add to index
        store['index'].add_with_ids(mat, id_array)
        store['next_id'] = max(store['next_id'], int(id_array.max()) + 1)

        logger.info(f"Added {n} chunks to {repo_name}. New total: {store['index'].ntotal}")

        self._save_repo_to_disk(store)

    def update_file_chunks(
        self,
        repo_name: str,
        file_path: str,
        embeddings: Sequence[Sequence[float]],
        metadatas: Sequence[Dict],
        texts: Optional[Sequence[str]] = None
    ):
        """
        Update all chunks for a specific file.

        Process:
        1. Find all existing chunks with this file_path
        2. Mark them as deleted (soft delete)
        3. Add new chunks for the file

        Args:
            repo_name: Repository identifier (e.g., "owner/repo")
            file_path: Relative file path (e.g., "src/main.py")
            embeddings: New embeddings for file's chunks
            metadatas: Must include 'file_path' key matching file_path arg
            texts: Optional chunk content
        """
        store = self._get_repo_store(repo_name)

        # Find and soft-delete existing chunks for this file
        existing_ids = self._get_chunks_by_file(store, file_path)
        if existing_ids:
            self._soft_delete_chunks(store, existing_ids)
            logger.info(f"Soft-deleted {len(existing_ids)} existing chunks for {file_path}")

        # Add new chunks
        self.add_to_repo(repo_name, embeddings, metadatas, texts)
        logger.info(f"Updated {file_path} with {len(embeddings)} new chunks")

    def delete_file_chunks(self, repo_name: str, file_path: str):
        """
        Delete all chunks belonging to a specific file.

        Uses soft deletion to avoid expensive FAISS index rebuilding.

        Args:
            repo_name: Repository identifier
            file_path: Relative file path
        """
        store = self._get_repo_store(repo_name)
        
        chunk_ids = self._get_chunks_by_file(store, file_path)
        if not chunk_ids:
            logger.warning(f"No chunks found for {file_path} in {repo_name}")
            return

        self._soft_delete_chunks(store, chunk_ids)
        logger.info(f"Soft-deleted {len(chunk_ids)} chunks for {file_path}")
        
        self._save_repo_to_disk(store)

    def delete_chunks_by_ids(self, repo_name: str, chunk_ids: List[str]):
        """
        Delete specific chunks by their chunk_id.

        Args:
            repo_name: Repository identifier
            chunk_ids: List of chunk_id values from metadata
        """
        store = self._get_repo_store(repo_name)
        
        deleted = 0
        for key, entry in store['metastore'].items():
            meta = entry.get('metadata', {})
            if meta.get('chunk_id') in chunk_ids:
                meta['deleted'] = True
                deleted += 1

        logger.info(f"Soft-deleted {deleted} chunks by ID in {repo_name}")
        self._save_repo_to_disk(store)

    def _matches_filters(self, metadata: Dict, filters: Dict) -> bool:
        """
        Check if metadata matches filter criteria.

        Supports:
        - Exact match: {'language': 'python'}
        - Glob patterns: {'file_path': 'src/*.py'}
        - Range queries: {'start_line': {'$gte': 10, '$lte': 100}}
        - Multiple values: {'language': ['python', 'javascript']}
        """
        for key, filter_value in filters.items():
            if key not in metadata:
                return False

            meta_value = metadata[key]

            # Range query (for numeric fields)
            if isinstance(filter_value, dict):
                if '$gte' in filter_value and meta_value < filter_value['$gte']:
                    return False
                if '$lte' in filter_value and meta_value > filter_value['$lte']:
                    return False
                if '$gt' in filter_value and meta_value <= filter_value['$gt']:
                    return False
                if '$lt' in filter_value and meta_value >= filter_value['$lt']:
                    return False
            # Multiple values (OR)
            elif isinstance(filter_value, list):
                if meta_value not in filter_value:
                    return False
            # Glob pattern for strings
            elif isinstance(filter_value, str) and ('*' in filter_value or '?' in filter_value):
                if not fnmatch(str(meta_value), filter_value):
                    return False
            # Exact match
            else:
                if meta_value != filter_value:
                    return False

        return True

    def search_repo(
        self,
        repo_name: str,
        query_embedding: Sequence[float],
        top_k: int = 10,
        filters: Optional[Dict[str, Any]] = None,
        include_deleted: bool = False
    ) -> List[Dict[str, Any]]:
        """
        Search within a specific repository with optional filters.

        Args:
            repo_name: Repository to search
            query_embedding: Query vector
            top_k: Number of results
            filters: Optional metadata filters, e.g.:
                {
                    'language': 'python',
                    'file_path': 'src/*.py',  # glob pattern
                    'chunk_type': 'ast',
                    'start_line': {'$gte': 100}  # range query
                }
            include_deleted: If False, filter out soft-deleted chunks

        Returns:
            List of search results sorted by similarity score

        Raises:
            RepositoryNotFoundError: If repository doesn't exist
        """
        if not self._repo_exists(repo_name):
            raise RepositoryNotFoundError(
                f"Repository '{repo_name}' not found. "
                f"Available: {self.list_repositories()}"
            )

        store = self._get_repo_store(repo_name)

        if store['index'] is None or store['index'].ntotal == 0:
            logger.warning(f"Repository {repo_name} has no vectors")
            return []

        # Fetch more results initially to account for filtering
        search_k = top_k * 3 if filters or not include_deleted else top_k

        q = np.array(query_embedding, dtype="float32").reshape(1, -1)
        q = self._normalize_matrix(q)
        
        D, I = store['index'].search(q, min(search_k, store['index'].ntotal))
        
        results = []
        for score, idx in zip(D[0].tolist(), I[0].tolist()):
            if idx == -1:
                continue

            key = str(int(idx))
            meta_entry = store['metastore'].get(key, {})
            metadata = meta_entry.get('metadata', {})

            # Filter deleted chunks
            if not include_deleted and metadata.get('deleted', False):
                continue

            # Apply filters
            if filters and not self._matches_filters(metadata, filters):
                continue

            results.append({
                "id": int(idx),
                "score": float(score),
                "metadata": metadata,
                "text": meta_entry.get("text"),
            })

            if len(results) >= top_k:
                break

        logger.debug(f"Search in {repo_name} returned {len(results)} results")
        return results

    def bulk_update_files(
        self,
        repo_name: str,
        updates: List[Dict[str, Any]]
    ):
        """
        Update multiple files in a single operation.

        Args:
            updates: List of update operations:
                [
                    {
                        'operation': 'update',  # or 'delete'
                        'file_path': 'src/main.py',
                        'embeddings': [...],    # if operation='update'
                        'metadatas': [...],     # if operation='update'
                        'texts': [...]          # if operation='update'
                    },
                    {
                        'operation': 'delete',
                        'file_path': 'src/old.py'
                    },
                ]
        """
        store = self._get_repo_store(repo_name)
        
        for update in updates:
            operation = update.get('operation')
            file_path = update.get('file_path')

            if operation == 'delete':
                chunk_ids = self._get_chunks_by_file(store, file_path)
                if chunk_ids:
                    self._soft_delete_chunks(store, chunk_ids)
                    logger.info(f"Bulk delete: {file_path} ({len(chunk_ids)} chunks)")

            elif operation == 'update':
                # Soft delete existing
                existing_ids = self._get_chunks_by_file(store, file_path)
                if existing_ids:
                    self._soft_delete_chunks(store, existing_ids)

                # Add new chunks
                embeddings = update['embeddings']
                metadatas = update['metadatas']
                texts = update.get('texts')

                # Validate
                for meta in metadatas:
                    if not self._validate_metadata(meta):
                        raise InvalidMetadataError(f"Invalid metadata for {file_path}")
                    if 'deleted' not in meta:
                        meta['deleted'] = False
                    if 'created_at' not in meta:
                        meta['created_at'] = datetime.utcnow().isoformat()

                mat = self._to_numpy(embeddings)
                mat = self._normalize_matrix(mat)
                n, dim = mat.shape

                self._ensure_index(store, dim)

                id_array = np.arange(store['next_id'], store['next_id'] + n, dtype="int64")

                for i, _id in enumerate(id_array.tolist()):
                    key = str(int(_id))
                    entry = {"metadata": metadatas[i]}
                    if texts is not None:
                        entry["text"] = texts[i]
                    store['metastore'][key] = entry

                store['index'].add_with_ids(mat, id_array)
                store['next_id'] = max(store['next_id'], int(id_array.max()) + 1)
                
                logger.info(f"Bulk update: {file_path} ({n} new chunks)")

        self._save_repo_to_disk(store)
        logger.info(f"Bulk update complete for {repo_name}: {len(updates)} operations")

    def list_repositories(self) -> List[str]:
        """
        List all indexed repositories.

        Returns:
            List of repository names (e.g., ["facebook/react", "microsoft/vscode"])
        """
        repos = []
        if not os.path.exists(self.base_dir):
            return repos

        for entry in os.listdir(self.base_dir):
            repo_dir = os.path.join(self.base_dir, entry)
            if os.path.isdir(repo_dir):
                index_path = os.path.join(repo_dir, self.INDEX_FILENAME)
                meta_path = os.path.join(repo_dir, self.META_FILENAME)
                if os.path.exists(index_path) and os.path.exists(meta_path):
                    # Convert back: owner_repo → owner/repo
                    repo_name = entry.replace("_", "/", 1)
                    repos.append(repo_name)

        return sorted(repos)

    def get_repo_stats(self, repo_name: str) -> Dict[str, Any]:
        """
        Get statistics about a repository's index.

        Returns:
            {
                'repo_name': str,
                'exists': bool,
                'total_vectors': int,
                'active_vectors': int,
                'deleted_vectors': int,
                'dimension': int,
                'by_language': {'python': 150, 'javascript': 80, ...},
                'by_chunk_type': {'ast': 180, 'recursive': 50, ...},
                'by_file': {'src/main.py': 10, 'src/utils.py': 5, ...},
                'index_size_mb': float,
                'last_modified': str
            }
        """
        stats = {
            'repo_name': repo_name,
            'exists': self._repo_exists(repo_name),
            'total_vectors': 0,
            'active_vectors': 0,
            'deleted_vectors': 0,
            'dimension': 0,
            'by_language': {},
            'by_chunk_type': {},
            'by_file': {},
            'index_size_mb': 0.0,
            'last_modified': None
        }

        if not stats['exists']:
            return stats

        store = self._get_repo_store(repo_name)

        if store['index']:
            stats['total_vectors'] = store['index'].ntotal
            stats['dimension'] = store['index'].d

        # Analyze metadata
        for entry in store['metastore'].values():
            meta = entry.get('metadata', {})
            
            if meta.get('deleted', False):
                stats['deleted_vectors'] += 1
            else:
                stats['active_vectors'] += 1

                # Group by language
                lang = meta.get('language', 'unknown')
                stats['by_language'][lang] = stats['by_language'].get(lang, 0) + 1

                # Group by chunk type
                chunk_type = meta.get('chunk_type', 'unknown')
                stats['by_chunk_type'][chunk_type] = stats['by_chunk_type'].get(chunk_type, 0) + 1

                # Group by file
                file_path = meta.get('file_path', 'unknown')
                stats['by_file'][file_path] = stats['by_file'].get(file_path, 0) + 1

        # File size
        index_path, meta_path = self._get_repo_paths(repo_name)
        if os.path.exists(index_path):
            index_size = os.path.getsize(index_path)
            meta_size = os.path.getsize(meta_path) if os.path.exists(meta_path) else 0
            stats['index_size_mb'] = (index_size + meta_size) / (1024 * 1024)
            stats['last_modified'] = datetime.fromtimestamp(
                os.path.getmtime(index_path)
            ).isoformat()

        return stats

    def delete_repository(self, repo_name: str):
        """
        Completely remove a repository's index and metadata.

        Args:
            repo_name: Repository identifier
        """
        # Remove from cache
        if repo_name in self._repo_cache:
            del self._repo_cache[repo_name]
            logger.debug(f"Removed {repo_name} from cache")

        # Delete directory
        repo_dir = self._get_repo_dir(repo_name)
        if os.path.exists(repo_dir):
            import shutil
            shutil.rmtree(repo_dir)
            logger.info(f"Deleted repository: {repo_name}")
        else:
            logger.warning(f"Repository {repo_name} does not exist")

    def compact_repository(self, repo_name: str):
        """
        Rebuild repository index without soft-deleted chunks.

        This is an expensive operation but frees up space and improves
        search performance by removing deleted vectors from FAISS index.

        Process:
        1. Load current index
        2. Extract all non-deleted vectors and metadata
        3. Build new index from scratch
        4. Replace old index with new one

        Args:
            repo_name: Repository identifier
        """
        if not self._repo_exists(repo_name):
            raise RepositoryNotFoundError(f"Repository '{repo_name}' not found")

        logger.info(f"Compacting repository: {repo_name}")
        store = self._get_repo_store(repo_name)

        if store['index'] is None:
            logger.warning(f"Repository {repo_name} has no index to compact")
            return

        # Collect non-deleted entries
        active_ids = []
        active_vectors = []
        active_meta = {}

        for key, entry in store['metastore'].items():
            meta = entry.get('metadata', {})
            if not meta.get('deleted', False):
                idx = int(key)
                active_ids.append(idx)
                # Reconstruct vector from index
                vec = store['index'].reconstruct(idx)
                active_vectors.append(vec)
                active_meta[key] = entry

        if not active_vectors:
            logger.warning(f"No active vectors to compact in {repo_name}")
            return

        # Build new index
        mat = np.array(active_vectors, dtype='float32')
        dim = mat.shape[1]

        new_index_flat = faiss.IndexFlatIP(dim)
        new_index = faiss.IndexIDMap(new_index_flat)
        id_array = np.array(active_ids, dtype='int64')
        new_index.add_with_ids(mat, id_array)

        # Update store
        old_total = store['index'].ntotal
        store['index'] = new_index
        store['metastore'] = active_meta

        logger.info(
            f"Compacted {repo_name}: {old_total} → {new_index.ntotal} vectors "
            f"({old_total - new_index.ntotal} deleted removed)"
        )

        self._save_repo_to_disk(store)

    def migrate_from_legacy(self, target_repo_name: str):
        """
        Migrate existing single-index store to new multi-repo structure.

        Moves:
            VectorStore/index.faiss → VectorStore/target_repo_name/index.faiss
            VectorStore/metadata.json → VectorStore/target_repo_name/metadata.json

        Args:
            target_repo_name: Repository name to assign to legacy data
        """
        legacy_index = os.path.join(self.base_dir, self.INDEX_FILENAME)
        legacy_meta = os.path.join(self.base_dir, self.META_FILENAME)

        if not os.path.exists(legacy_index) or not os.path.exists(legacy_meta):
            logger.warning("No legacy index found to migrate")
            return

        logger.info(f"Migrating legacy index to repository: {target_repo_name}")

        # Create new repo directory
        repo_dir = self._get_repo_dir(target_repo_name)
        os.makedirs(repo_dir, exist_ok=True)

        # Move files
        import shutil
        new_index = os.path.join(repo_dir, self.INDEX_FILENAME)
        new_meta = os.path.join(repo_dir, self.META_FILENAME)

        shutil.move(legacy_index, new_index)
        shutil.move(legacy_meta, new_meta)

        logger.info(f"Migration complete: legacy → {target_repo_name}")

    def save_all(self):
        """Save all cached repositories to disk."""
        for repo_name, store in self._repo_cache.items():
            self._save_repo_to_disk(store)
        logger.info(f"Saved {len(self._repo_cache)} repositories from cache")

    def clear_cache(self):
        """Clear in-memory cache (saves all before clearing)."""
        self.save_all()
        self._repo_cache.clear()
        logger.info("Cleared repository cache")

    # Backward compatibility methods
    def build_from_embeddings(
        self,
        embeddings: Sequence[Sequence[float]],
        metadatas: Sequence[Any],
        texts: Optional[Sequence[str]] = None,
        ids: Optional[Sequence[int]] = None,
        overwrite: bool = True,
        repo_name: str = "default"
    ):
        """
        Legacy method for backward compatibility.
        
        Builds index for a repository (defaults to "default").
        """
        if overwrite and self._repo_exists(repo_name):
            self.delete_repository(repo_name)
        
        self.add_to_repo(repo_name, embeddings, metadatas, texts, ids)

    def add(
        self,
        embeddings: Sequence[Sequence[float]],
        metadatas: Sequence[Any],
        texts: Optional[Sequence[str]] = None,
        ids: Optional[Sequence[int]] = None,
        repo_name: str = "default"
    ):
        """Legacy method for backward compatibility."""
        self.add_to_repo(repo_name, embeddings, metadatas, texts, ids)

    def search(
        self,
        query_embedding: Sequence[float],
        top_k: int = 10,
        repo_name: str = "default"
    ) -> List[Dict[str, Any]]:
        """Legacy method for backward compatibility."""
        return self.search_repo(repo_name, query_embedding, top_k)
