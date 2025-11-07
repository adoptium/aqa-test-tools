"""
Merkle Tree for Code Repository Change Detection

This module provides Merkle tree implementation for tracking file changes
in GitHub repositories. It enables efficient incremental updates by
identifying only the files that have changed between repository snapshots.

Key Features:
- Cryptographic hash tree computation (SHA-256)
- SQLite persistence for tree state
- Efficient change detection (added/modified/deleted files)
- Support for multiple repositories
- Change history auditing
- Performance optimized for large repositories

Example:
    >>> store = MerkleTreeStore("merkle_trees.db")
    >>> tree = store.compute_tree("owner/repo", files, commit_sha)
    >>> store.save_tree(tree)
    >>> changes = store.detect_changes("owner/repo", new_files, new_commit)
"""

import sqlite3
import hashlib
import logging
from dataclasses import dataclass, field
from datetime import datetime
from typing import Dict, List, Optional, Any, Set
import re
import os

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@dataclass
class FileNode:
    """
    Represents a single file in the Merkle tree.
    
    Attributes:
        path: Relative file path (e.g., "src/main.py")
        content_hash: SHA-1 (40 chars) or SHA-256 (64 chars) hash of file content
        size: File size in bytes
        last_modified: ISO timestamp of last modification
    """
    path: str
    content_hash: str
    size: int
    last_modified: str
    
    def __post_init__(self):
        """Validate FileNode fields."""
        if not self.path:
            raise ValueError("File path cannot be empty")
        if len(self.content_hash) not in (40, 64):
            raise ValueError(f"Invalid hash length for {self.path}: {len(self.content_hash)} (expected 40 or 64)")
        if self.size < 0:
            raise ValueError(f"File size cannot be negative for {self.path}")


@dataclass
class MerkleTree:
    """
    Represents the entire repository state as a Merkle tree.
    
    Attributes:
        root_hash: SHA-256 of all file hashes combined (deterministic)
        files: Dictionary mapping file paths to FileNode objects
        commit_sha: Git commit SHA this tree represents
        repo_name: Repository identifier (e.g., "owner/repo")
        created_at: ISO timestamp of tree creation
        total_files: Total number of files in tree
        total_size: Total size of all files in bytes
    """
    root_hash: str
    files: Dict[str, FileNode]
    commit_sha: str
    repo_name: str
    created_at: str
    total_files: int = 0
    total_size: int = 0
    
    def __post_init__(self):
        """Calculate derived fields if not provided."""
        if self.total_files == 0:
            self.total_files = len(self.files)
        if self.total_size == 0:
            self.total_size = sum(f.size for f in self.files.values())


class MerkleTreeStore:
    """
    Manage Merkle trees for multiple repositories with persistent storage.
    
    This class provides methods to compute Merkle trees from file lists,
    persist them to SQLite, and efficiently detect changes between repository
    snapshots.
    
    Usage:
        store = MerkleTreeStore("merkle_trees.db")
        
        # Compute tree from GitHub files
        tree = store.compute_tree("owner/repo", files_list, commit_sha)
        
        # Save to database
        store.save_tree(tree)
        
        # Later, detect changes
        changes = store.detect_changes("owner/repo", new_files_list, new_commit)
        # Returns: {'added': [...], 'modified': [...], 'deleted': [...], 'unchanged': [...]}
    
    Attributes:
        db_path: Path to SQLite database file
    """
    
    def __init__(self, db_path: str = "merkle_trees.db"):
        """
        Initialize store and create database schema.
        
        Args:
            db_path: Path to SQLite database file (created if doesn't exist)
        """
        self.db_path = db_path
        self._init_database()
        logger.info(f"Initialized MerkleTreeStore with database: {db_path}")
    
    def _init_database(self) -> None:
        """Create database schema if it doesn't exist."""
        try:
            with sqlite3.connect(self.db_path) as conn:
                # Enable WAL mode for better concurrent access
                conn.execute("PRAGMA journal_mode=WAL")
                
                cursor = conn.cursor()
                
                # Repositories table
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS repositories (
                        repo_name TEXT PRIMARY KEY,
                        root_hash TEXT NOT NULL,
                        commit_sha TEXT NOT NULL,
                        total_files INTEGER NOT NULL,
                        total_size INTEGER NOT NULL,
                        last_indexed TIMESTAMP NOT NULL,
                        created_at TIMESTAMP NOT NULL
                    )
                """)
                
                # File hashes table
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS file_hashes (
                        repo_name TEXT,
                        file_path TEXT,
                        content_hash TEXT NOT NULL,
                        size INTEGER NOT NULL,
                        last_modified TIMESTAMP NOT NULL,
                        PRIMARY KEY (repo_name, file_path),
                        FOREIGN KEY (repo_name) REFERENCES repositories(repo_name)
                            ON DELETE CASCADE
                    )
                """)
                
                # Change history table
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS change_history (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        repo_name TEXT NOT NULL,
                        old_commit_sha TEXT,
                        new_commit_sha TEXT NOT NULL,
                        old_root_hash TEXT,
                        new_root_hash TEXT NOT NULL,
                        files_added INTEGER DEFAULT 0,
                        files_modified INTEGER DEFAULT 0,
                        files_deleted INTEGER DEFAULT 0,
                        detected_at TIMESTAMP NOT NULL,
                        FOREIGN KEY (repo_name) REFERENCES repositories(repo_name)
                    )
                """)
                
                # Create indexes
                cursor.execute("""
                    CREATE INDEX IF NOT EXISTS idx_file_hashes_repo 
                    ON file_hashes(repo_name)
                """)
                cursor.execute("""
                    CREATE INDEX IF NOT EXISTS idx_file_hashes_hash 
                    ON file_hashes(content_hash)
                """)
                cursor.execute("""
                    CREATE INDEX IF NOT EXISTS idx_change_history_repo 
                    ON change_history(repo_name)
                """)
                
                conn.commit()
                logger.debug("Database schema initialized successfully")
                
        except sqlite3.Error as e:
            logger.error(f"Failed to initialize database: {e}")
            raise
    
    def _validate_repo_name(self, repo_name: str) -> None:
        """
        Validate repository name format.
        
        Args:
            repo_name: Repository identifier to validate
            
        Raises:
            ValueError: If repo_name format is invalid
        """
        if not repo_name:
            raise ValueError("Repository name cannot be empty")
        
        # Allow alphanumeric, /, -, _, .
        if not re.match(r'^[a-zA-Z0-9/_.\-]+$', repo_name):
            raise ValueError(
                f"Invalid repository name format: {repo_name}. "
                "Only alphanumeric characters, /, -, _, . are allowed"
            )
    
    def _validate_commit_sha(self, commit_sha: str) -> None:
        """
        Validate Git commit SHA format.
        
        Args:
            commit_sha: Commit SHA to validate
            
        Raises:
            ValueError: If commit_sha format is invalid
        """
        if not commit_sha:
            raise ValueError("Commit SHA cannot be empty")
        
        if not re.match(r'^[a-fA-F0-9]{40}$', commit_sha):
            raise ValueError(
                f"Invalid commit SHA format: {commit_sha}. "
                "Must be 40 hexadecimal characters"
            )
    
    def _compute_file_hash(
        self, 
        content: Optional[str] = None, 
        github_sha: Optional[str] = None
    ) -> str:
        """
        Compute or use provided file hash.
        
        Prefers GitHub SHA if available to avoid re-computation.
        
        Args:
            content: File content to hash
            github_sha: Pre-computed GitHub blob SHA (40 chars SHA-1 or 64 chars SHA-256)
            
        Returns:
            SHA-1 (40 chars) if GitHub SHA provided, otherwise SHA-256 (64 chars)
            
        Raises:
            ValueError: If neither content nor github_sha provided
        """
        if github_sha:
            # Validate GitHub SHA format (accept both SHA-1 and SHA-256)
            if len(github_sha) == 40 or len(github_sha) == 64:
                return github_sha
            else:
                logger.warning(
                    f"Invalid GitHub SHA length: {len(github_sha)} (expected 40 or 64), computing from content"
                )
        
        if content is None:
            raise ValueError("Either content or github_sha must be provided")
        
        try:
            # Compute SHA-256 of content
            return hashlib.sha256(content.encode('utf-8')).hexdigest()
        except UnicodeEncodeError as e:
            logger.error(f"Failed to encode content: {e}")
            # Try with error handling
            return hashlib.sha256(content.encode('utf-8', errors='replace')).hexdigest()
    
    def _compute_root_hash(self, file_nodes: Dict[str, FileNode]) -> str:
        """
        Compute deterministic root hash from file nodes.
        
        Algorithm:
            1. Extract all file paths and sort alphabetically
            2. Concatenate hashes in sorted order
            3. Return SHA-256 of concatenated string
        
        Args:
            file_nodes: Dictionary of file paths to FileNode objects
            
        Returns:
            64-character SHA-256 hex string representing root hash
        """
        if not file_nodes:
            # Empty tree has a zero hash
            return hashlib.sha256(b'').hexdigest()
        
        # Sort file paths alphabetically for determinism
        sorted_paths = sorted(file_nodes.keys())
        
        # Concatenate hashes in sorted order
        concatenated = ''.join(file_nodes[path].content_hash for path in sorted_paths)
        
        # Compute root hash
        root_hash = hashlib.sha256(concatenated.encode('utf-8')).hexdigest()
        
        logger.debug(f"Computed root hash from {len(file_nodes)} files: {root_hash[:8]}...")
        
        return root_hash
    
    def compute_tree(
        self, 
        repo_name: str, 
        files: List[Dict[str, Any]],
        commit_sha: str
    ) -> MerkleTree:
        """
        Compute Merkle tree from a list of files.
        
        Args:
            repo_name: Repository identifier (e.g., "owner/repo")
            files: List of file dictionaries with keys:
                   - 'path': relative file path (required)
                   - 'content': file content string (optional if 'sha' provided)
                   - 'sha': GitHub blob SHA (optional)
                   - 'size': file size in bytes (optional, computed if not provided)
            commit_sha: Git commit SHA this tree represents
        
        Returns:
            MerkleTree object with computed root hash
            
        Raises:
            ValueError: If validation fails or required fields missing
        """
        self._validate_repo_name(repo_name)
        self._validate_commit_sha(commit_sha)
        
        if not files:
            raise ValueError("Files list cannot be empty")
        
        logger.info(f"Computing Merkle tree for {repo_name}")
        logger.info(f"  Commit: {commit_sha[:8]}...")
        logger.info(f"  Files: {len(files)}")
        
        file_nodes: Dict[str, FileNode] = {}
        total_size = 0
        
        for file_data in files:
            try:
                # Extract file data
                path = file_data.get('path')
                if not path:
                    logger.warning("Skipping file without path")
                    continue
                
                content = file_data.get('content')
                github_sha = file_data.get('sha')
                size = file_data.get('size', 0)
                
                # Compute hash
                content_hash = self._compute_file_hash(content, github_sha)
                
                # Compute size if not provided
                if size == 0 and content:
                    size = len(content.encode('utf-8'))
                
                # Get or compute timestamp
                last_modified = file_data.get(
                    'last_modified',
                    datetime.utcnow().isoformat()
                )
                
                # Create FileNode
                file_node = FileNode(
                    path=path,
                    content_hash=content_hash,
                    size=size,
                    last_modified=last_modified
                )
                
                file_nodes[path] = file_node
                total_size += size
                
            except Exception as e:
                logger.error(f"Failed to process file {file_data.get('path', 'unknown')}: {e}")
                # Continue processing other files
                continue
        
        # Compute root hash
        root_hash = self._compute_root_hash(file_nodes)
        
        # Create MerkleTree
        tree = MerkleTree(
            root_hash=root_hash,
            files=file_nodes,
            commit_sha=commit_sha,
            repo_name=repo_name,
            created_at=datetime.utcnow().isoformat(),
            total_files=len(file_nodes),
            total_size=total_size
        )
        
        logger.info(f"  Root hash: {root_hash[:8]}...")
        logger.info(f"  Total size: {total_size / 1024 / 1024:.2f} MB")
        
        return tree
    
    def save_tree(self, tree: MerkleTree) -> None:
        """
        Persist Merkle tree to database.
        
        Updates if repository already exists, inserts if new.
        Uses transactions to ensure atomicity.
        
        Args:
            tree: MerkleTree object to save
            
        Raises:
            sqlite3.Error: If database operation fails
        """
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                
                # Insert or update repository
                cursor.execute("""
                    INSERT OR REPLACE INTO repositories 
                    (repo_name, root_hash, commit_sha, total_files, total_size, 
                     last_indexed, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, COALESCE(
                        (SELECT created_at FROM repositories WHERE repo_name = ?),
                        ?
                    ))
                """, (
                    tree.repo_name,
                    tree.root_hash,
                    tree.commit_sha,
                    tree.total_files,
                    tree.total_size,
                    tree.created_at,
                    tree.repo_name,
                    tree.created_at
                ))
                
                # Delete old file hashes
                cursor.execute(
                    "DELETE FROM file_hashes WHERE repo_name = ?",
                    (tree.repo_name,)
                )
                
                # Insert new file hashes in batch
                file_data = [
                    (tree.repo_name, path, node.content_hash, node.size, node.last_modified)
                    for path, node in tree.files.items()
                ]
                
                cursor.executemany("""
                    INSERT INTO file_hashes 
                    (repo_name, file_path, content_hash, size, last_modified)
                    VALUES (?, ?, ?, ?, ?)
                """, file_data)
                
                conn.commit()
                
                logger.info(f"Saved Merkle tree for {tree.repo_name}")
                logger.info(f"  Root hash: {tree.root_hash[:8]}...")
                logger.info(f"  Files: {tree.total_files}")
                
        except sqlite3.Error as e:
            logger.error(f"Failed to save tree for {tree.repo_name}: {e}")
            raise
    
    def load_tree(self, repo_name: str) -> Optional[MerkleTree]:
        """
        Load the most recent Merkle tree for a repository.
        
        Args:
            repo_name: Repository identifier
            
        Returns:
            MerkleTree object if found, None otherwise
        """
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()
                
                # Load repository metadata
                cursor.execute("""
                    SELECT * FROM repositories WHERE repo_name = ?
                """, (repo_name,))
                
                repo_row = cursor.fetchone()
                if not repo_row:
                    logger.warning(f"Repository {repo_name} not found in database")
                    return None
                
                # Load file hashes
                cursor.execute("""
                    SELECT file_path, content_hash, size, last_modified
                    FROM file_hashes
                    WHERE repo_name = ?
                """, (repo_name,))
                
                file_nodes = {}
                for row in cursor.fetchall():
                    file_nodes[row['file_path']] = FileNode(
                        path=row['file_path'],
                        content_hash=row['content_hash'],
                        size=row['size'],
                        last_modified=row['last_modified']
                    )
                
                # Create MerkleTree
                tree = MerkleTree(
                    root_hash=repo_row['root_hash'],
                    files=file_nodes,
                    commit_sha=repo_row['commit_sha'],
                    repo_name=repo_row['repo_name'],
                    created_at=repo_row['created_at'],
                    total_files=repo_row['total_files'],
                    total_size=repo_row['total_size']
                )
                
                logger.info(f"Loaded Merkle tree for {repo_name}")
                logger.info(f"  Root hash: {tree.root_hash[:8]}...")
                logger.info(f"  Files: {tree.total_files}")
                
                return tree
                
        except sqlite3.Error as e:
            logger.error(f"Failed to load tree for {repo_name}: {e}")
            return None
    
    def detect_changes(
        self, 
        repo_name: str, 
        new_files: List[Dict[str, Any]],
        new_commit_sha: str
    ) -> Dict[str, List[str]]:
        """
        Detect changes between stored tree and new file list.
        
        Algorithm:
            1. Load old tree from database
            2. If no old tree exists, all files are 'added'
            3. Compute new tree from new_files
            4. If root hashes match, return empty changes (optimization)
            5. Otherwise, compare file-by-file:
               - Files in new but not old: added
               - Files in old but not new: deleted
               - Files in both with different hashes: modified
               - Files in both with same hashes: unchanged
            6. Save change history to database
        
        Args:
            repo_name: Repository identifier
            new_files: List of current file dictionaries
            new_commit_sha: Git commit SHA of new state
        
        Returns:
            Dictionary with keys:
                - 'added': List of newly added file paths
                - 'modified': List of changed file paths
                - 'deleted': List of removed file paths
                - 'unchanged': List of unchanged file paths
        """
        self._validate_repo_name(repo_name)
        self._validate_commit_sha(new_commit_sha)
        
        logger.info(f"Detecting changes for {repo_name}")
        
        # Load old tree
        old_tree = self.load_tree(repo_name)
        
        # Compute new tree
        new_tree = self.compute_tree(repo_name, new_files, new_commit_sha)
        
        # Initialize change sets
        added: List[str] = []
        modified: List[str] = []
        deleted: List[str] = []
        unchanged: List[str] = []
        
        if old_tree is None:
            # First indexing - all files are added
            added = list(new_tree.files.keys())
            logger.info(f"  First indexing - all {len(added)} files marked as added")
            
        else:
            logger.info(f"  Old root hash: {old_tree.root_hash[:8]}...")
            logger.info(f"  New root hash: {new_tree.root_hash[:8]}...")
            
            # Quick check: if root hashes match, no changes
            if old_tree.root_hash == new_tree.root_hash:
                unchanged = list(new_tree.files.keys())
                logger.info("  Root hashes match - no changes detected")
                
                return {
                    'added': added,
                    'modified': modified,
                    'deleted': deleted,
                    'unchanged': unchanged
                }
            
            # Compare file by file
            old_paths: Set[str] = set(old_tree.files.keys())
            new_paths: Set[str] = set(new_tree.files.keys())
            
            # Detect added files
            added = sorted(list(new_paths - old_paths))
            
            # Detect deleted files
            deleted = sorted(list(old_paths - new_paths))
            
            # Detect modified and unchanged files
            common_paths = old_paths & new_paths
            for path in sorted(common_paths):
                old_hash = old_tree.files[path].content_hash
                new_hash = new_tree.files[path].content_hash
                
                if old_hash != new_hash:
                    modified.append(path)
                    logger.debug(
                        f"  Modified: {path} ({old_hash[:8]}... -> {new_hash[:8]}...)"
                    )
                else:
                    unchanged.append(path)
            
            logger.info(f"  Added: {len(added)} files")
            logger.info(f"  Modified: {len(modified)} files")
            logger.info(f"  Deleted: {len(deleted)} files")
            logger.info(f"  Unchanged: {len(unchanged)} files")
            
            # Save change history
            self._save_change_history(
                repo_name=repo_name,
                old_commit_sha=old_tree.commit_sha,
                new_commit_sha=new_commit_sha,
                old_root_hash=old_tree.root_hash,
                new_root_hash=new_tree.root_hash,
                files_added=len(added),
                files_modified=len(modified),
                files_deleted=len(deleted)
            )
        
        return {
            'added': added,
            'modified': modified,
            'deleted': deleted,
            'unchanged': unchanged
        }
    
    def _save_change_history(
        self,
        repo_name: str,
        old_commit_sha: str,
        new_commit_sha: str,
        old_root_hash: str,
        new_root_hash: str,
        files_added: int,
        files_modified: int,
        files_deleted: int
    ) -> None:
        """Save change detection event to history table."""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                
                cursor.execute("""
                    INSERT INTO change_history
                    (repo_name, old_commit_sha, new_commit_sha, old_root_hash,
                     new_root_hash, files_added, files_modified, files_deleted,
                     detected_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    repo_name,
                    old_commit_sha,
                    new_commit_sha,
                    old_root_hash,
                    new_root_hash,
                    files_added,
                    files_modified,
                    files_deleted,
                    datetime.utcnow().isoformat()
                ))
                
                conn.commit()
                logger.debug("Saved change history to database")
                
        except sqlite3.Error as e:
            logger.error(f"Failed to save change history: {e}")
            # Don't raise - this is not critical
    
    def get_repo_info(self, repo_name: str) -> Optional[Dict[str, Any]]:
        """
        Get metadata about a repository's current state.
        
        Args:
            repo_name: Repository identifier
        
        Returns:
            Dictionary with repository metadata if found, None otherwise:
                - repo_name: Repository identifier
                - root_hash: Current root hash
                - commit_sha: Current commit SHA
                - total_files: Number of files
                - total_size: Total size in bytes
                - last_indexed: ISO timestamp of last indexing
                - created_at: ISO timestamp of first indexing
        """
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()
                
                cursor.execute("""
                    SELECT * FROM repositories WHERE repo_name = ?
                """, (repo_name,))
                
                row = cursor.fetchone()
                if row:
                    return dict(row)
                else:
                    logger.warning(f"Repository {repo_name} not found")
                    return None
                    
        except sqlite3.Error as e:
            logger.error(f"Failed to get repo info for {repo_name}: {e}")
            return None
    
    def list_repositories(self) -> List[str]:
        """
        Return list of all tracked repository names.
        
        Returns:
            List of repository names, sorted alphabetically
        """
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                
                cursor.execute("SELECT repo_name FROM repositories ORDER BY repo_name")
                
                return [row[0] for row in cursor.fetchall()]
                
        except sqlite3.Error as e:
            logger.error(f"Failed to list repositories: {e}")
            return []
    
    def delete_repository(self, repo_name: str) -> None:
        """
        Remove all data for a repository.
        
        Cascades to file_hashes due to foreign key constraint.
        
        Args:
            repo_name: Repository identifier to delete
        """
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                
                cursor.execute("DELETE FROM repositories WHERE repo_name = ?", (repo_name,))
                
                conn.commit()
                
                if cursor.rowcount > 0:
                    logger.info(f"Deleted repository {repo_name}")
                else:
                    logger.warning(f"Repository {repo_name} not found")
                    
        except sqlite3.Error as e:
            logger.error(f"Failed to delete repository {repo_name}: {e}")
            raise
    
    def get_change_history(
        self, 
        repo_name: str, 
        limit: int = 10
    ) -> List[Dict[str, Any]]:
        """
        Get recent change detection history for a repository.
        
        Args:
            repo_name: Repository identifier
            limit: Maximum number of history entries to return
        
        Returns:
            List of change history dictionaries, most recent first
        """
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()
                
                cursor.execute("""
                    SELECT * FROM change_history 
                    WHERE repo_name = ?
                    ORDER BY detected_at DESC
                    LIMIT ?
                """, (repo_name, limit))
                
                return [dict(row) for row in cursor.fetchall()]
                
        except sqlite3.Error as e:
            logger.error(f"Failed to get change history for {repo_name}: {e}")
            return []
