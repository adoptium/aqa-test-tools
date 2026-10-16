"""
Advanced code chunking system with tree-sitter AST parsing and fallback strategies.
"""
import hashlib
import re
import logging
from typing import List, Dict, Optional
import tiktoken

from tree_sitter import Language, Parser, Node
from langchain.text_splitter import RecursiveCharacterTextSplitter

# Tree-sitter language imports
import tree_sitter_python
import tree_sitter_javascript
import tree_sitter_typescript
import tree_sitter_java
import tree_sitter_c
import tree_sitter_cpp
import tree_sitter_go
import tree_sitter_rust
import tree_sitter_ruby
import tree_sitter_bash
import tree_sitter_groovy
import tree_sitter_make
import tree_sitter_html

logger = logging.getLogger(__name__)

TREE_SITTER_MODULES = {
    'python': tree_sitter_python,
    'javascript': tree_sitter_javascript,
    'typescript': tree_sitter_typescript,
    'java': tree_sitter_java,
    'c': tree_sitter_c,
    'cpp': tree_sitter_cpp,
    'go': tree_sitter_go,
    'rust': tree_sitter_rust,
    'ruby': tree_sitter_ruby,
    'bash': tree_sitter_bash,
    'groovy': tree_sitter_groovy,
    'make': tree_sitter_make,
    'html': tree_sitter_html,
}


class CodeChunker:
    """
    Intelligent code chunker that uses tree-sitter for AST-based chunking with fallbacks.
    """
    
    # Language mappings
    EXTENSION_TO_LANGUAGE = {
        '.py': 'python',
        '.js': 'javascript',
        '.jsx': 'javascript',
        '.ts': 'typescript',
        '.tsx': 'typescript',
        '.java': 'java',
        '.c': 'c',
        '.cpp': 'cpp',
        '.cc': 'cpp',
        '.cxx': 'cpp',
        '.h': 'c',
        '.hpp': 'cpp',
        '.go': 'go',
        '.rs': 'rust',
        '.rb': 'ruby',
        '.sh': 'bash',
        '.bash': 'bash',
        '.groovy': 'groovy',
        '.gradle': 'groovy',
        'Makefile': 'make',
        '.mk': 'make',
        '.html': 'html',
        '.htm': 'html',
        '.md': 'markdown',
        '.markdown': 'markdown',
        '.txt': 'text',
        '.xml': 'xml',
        '.yml': 'yaml',
        '.yaml': 'yaml',
        '.json': 'json',
        '.sql': 'sql',
        '.pl': 'perl',
        '.php': 'php',
        '.toml': 'toml',
        '.ini': 'ini',
        '.cfg': 'config',
        '.conf': 'config',
        '.properties': 'properties',
    }
    
    # Tree-sitter supported languages (only those we have modules for)
    TREE_SITTER_LANGUAGES = set(TREE_SITTER_MODULES.keys())
    
    # Chunkable AST node types by language
    CHUNKABLE_NODE_TYPES = {
        'python': {'function_definition', 'class_definition', 'decorated_definition'},
        'javascript': {'function_declaration', 'class_declaration', 'method_definition', 
                      'arrow_function', 'function_expression'},
        'typescript': {'function_declaration', 'class_declaration', 'method_definition',
                      'arrow_function', 'function_expression'},
        'java': {'method_declaration', 'class_declaration', 'interface_declaration',
                'constructor_declaration'},
        'c': {'function_definition', 'struct_specifier'},
        'cpp': {'function_definition', 'class_specifier', 'struct_specifier'},
        'go': {'function_declaration', 'method_declaration', 'type_declaration'},
        'rust': {'function_item', 'impl_item', 'trait_item', 'struct_item'},
        'ruby': {'method', 'class', 'module'},
        'groovy': {'method_declaration', 'class_declaration', 'closure'},
        'make': {'rule'},
        'html': {'element'},
    }
    
    # Language-specific separators for recursive splitting
    LANGUAGE_SEPARATORS = {
        'python': ["\nclass ", "\ndef ", "\n\n", "\n", " ", ""],
        'javascript': ["\nfunction ", "\nclass ", "\nconst ", "\n\n", "\n", " ", ""],
        'typescript': ["\nfunction ", "\nclass ", "\ninterface ", "\n\n", "\n", " ", ""],
        'java': ["\nclass ", "\npublic ", "\nprivate ", "\nprotected ", "\n\n", "\n", " ", ""],
        'c': ["\nvoid ", "\nint ", "\nstruct ", "\n\n", "\n", " ", ""],
        'cpp': ["\nclass ", "\nvoid ", "\nint ", "\nnamespace ", "\n\n", "\n", " ", ""],
        'go': ["\nfunc ", "\ntype ", "\nconst ", "\n\n", "\n", " ", ""],
        'rust': ["\nfn ", "\nstruct ", "\nimpl ", "\n\n", "\n", " ", ""],
        'ruby': ["\nclass ", "\ndef ", "\nmodule ", "\n\n", "\n", " ", ""],
        'bash': ["\nfunction ", "\n\n", "\n", " ", ""],
        'groovy': ["\nclass ", "\ndef ", "\n\n", "\n", " ", ""],
        'make': ["\n\n", "\n", ""],
        'html': ["\n<", "\n\n", "\n", " ", ""],
        'xml': ["\n<", "\n\n", "\n", " ", ""],
        'yaml': ["\n\n", "\n- ", "\n", " ", ""],
        'json': ["\n  ", "\n", " ", ""],
        'sql': ["\nCREATE ", "\nSELECT ", "\nINSERT ", "\n\n", "\n", ""],
        'perl': ["\nsub ", "\n\n", "\n", " ", ""],
        'php': ["\nfunction ", "\nclass ", "\n\n", "\n", " ", ""],
        'toml': ["\n[", "\n\n", "\n", " ", ""],
        'ini': ["\n[", "\n\n", "\n", " ", ""],
        'config': ["\n\n", "\n", " ", ""],
        'properties': ["\n\n", "\n", " ", ""],
        # Generic fallback used by .get() default
        'text': ["\n\n", "\n", " ", ""],
    }
    
    MAX_FILE_SIZE = 1_000_000  # 1MB limit
    
    def __init__(self, max_tokens: int = 1000, overlap_tokens: int = 200):
        """
        Initialize the code chunker.
        
        Args:
            max_tokens: Maximum tokens per chunk
            overlap_tokens: Number of overlapping tokens between chunks
        """
        if max_tokens <= 0:
            raise ValueError("max_tokens must be > 0")
        if overlap_tokens < 0:
            raise ValueError("overlap_tokens must be >= 0")
        if overlap_tokens >= max_tokens:
            raise ValueError("overlap_tokens must be < max_tokens")
        
        self.max_tokens = max_tokens
        self.overlap_tokens = overlap_tokens
        self.encoder = tiktoken.get_encoding("cl100k_base")
        
        # Cache parsers for efficiency
        self._parser_cache: Dict[str, Parser] = {}
    
    def chunk_file(self, file_path: str, content: str) -> List[Dict]:
        """
        Chunk a file using the appropriate strategy.
        
        Args:
            file_path: Path to the file
            content: File content
            
        Returns:
            List of chunk dictionaries with metadata
        """
        if not content or not content.strip():
            return []
        
        # Skip very large files
        if len(content) > self.MAX_FILE_SIZE:
            logger.warning(f"Skipping large file {file_path} ({len(content)} bytes)")
            return []
        
        # Skip binary files
        if self._is_binary(content):
            logger.warning(f"Skipping binary file {file_path}")
            return []
        
        language = self._detect_language(file_path)
        logger.info(f"Chunking {file_path} as {language}")
        
        chunks = []
        
        # Strategy 1: Try tree-sitter for supported languages
        if language in self.TREE_SITTER_LANGUAGES:
            try:
                chunks = self._chunk_with_treesitter(content, language, file_path)
                if chunks:
                    logger.info(f"  ✓ AST chunking: {len(chunks)} chunks")
                    return self._finalize_chunks(chunks, file_path, language)
            except Exception as e:
                logger.warning(f"  ✗ AST failed: {e}, falling back to recursive splitter")
        
        # Strategy 2: Use recursive splitter for code files or unsupported languages
        if language not in {'markdown', 'text'}:
            try:
                chunks = self._chunk_with_recursive_splitter(content, language, file_path)
                if chunks:
                    logger.info(f"  ✓ Recursive splitter: {len(chunks)} chunks")
                    return self._finalize_chunks(chunks, file_path, language)
            except Exception as e:
                logger.warning(f"  ✗ Recursive splitter failed: {e}, falling back to simple chunking")
        
        # Strategy 3: Simple chunking for markdown, text, or as final fallback
        chunks = self._chunk_simple(content, file_path)
        logger.info(f"  ✓ Simple chunking: {len(chunks)} chunks")
        return self._finalize_chunks(chunks, file_path, language)
    
    def _is_binary(self, content: str) -> bool:
        """Check if content is binary."""
        try:
            # Check for null bytes in first 1KB
            return '\x00' in content[:1024]
        except Exception:
            return False
    
    def _detect_language(self, file_path: str) -> str:
        """Detect language from file extension."""
        # Check for Makefile first (exact match)
        file_name = file_path.split('/')[-1].split('\\')[-1]
        if file_name == 'Makefile' or file_name == 'makefile':
            return 'make'
        
        ext = '.' + file_path.lower().split('.')[-1] if '.' in file_path else ''
        return self.EXTENSION_TO_LANGUAGE.get(ext, 'text')
    
    def _get_parser(self, language: str) -> Optional[Parser]:
        """Get or create a cached parser for the language."""
        if language not in self._parser_cache:
            try:
                # Get the language module
                lang_module = TREE_SITTER_MODULES.get(language)
                if not lang_module:
                    return None
                
                # Create parser with language
                parser = Parser()
                parser.set_language(Language(lang_module.language()))
                self._parser_cache[language] = parser
            except Exception:
                return None
        return self._parser_cache[language]
    
    def _chunk_with_treesitter(self, content: str, language: str, file_path: str) -> List[Dict]:
        """
        Chunk code using tree-sitter AST parsing.
        
        Args:
            content: File content
            language: Programming language
            file_path: File path for metadata
            
        Returns:
            List of chunk dictionaries
        """
        parser = self._get_parser(language)
        if not parser:
            return []
        
        try:
            tree = parser.parse(bytes(content, "utf8"))
            root_node = tree.root_node
        except Exception:
            return []
        
        chunks = []
        chunkable_types = self.CHUNKABLE_NODE_TYPES.get(language, set())
        
        def traverse_node(node: Node):
            """Recursively traverse AST and create chunks."""
            node_text = content[node.start_byte:node.end_byte]
            token_count = self._count_tokens(node_text)
            
            # Check if this is a chunkable node type
            if node.type in chunkable_types:
                if token_count <= self.max_tokens:
                    # Node fits in one chunk - create and STOP
                    chunks.append({
                        'content': node_text,
                        'start_line': node.start_point[0],
                        'end_line': node.end_point[0],
                        'node_type': node.type,
                        'chunk_type': 'ast',
                        'token_count': token_count,
                    })
                    return  # Don't process children
                else:
                    # Node too large - must recurse into children
                    if node.child_count == 0:
                        # Leaf node that's too large - needs manual splitting
                        oversized_chunks = self._chunk_oversized_node(
                            node_text, 
                            node.start_point[0], 
                            language
                        )
                        chunks.extend(oversized_chunks)
                        return
                    # Fall through to process children
            
            # Process children for non-chunkable or oversized chunkable nodes
            if node.child_count > 0:
                for child in node.children:
                    traverse_node(child)
            elif token_count > 0 and token_count <= self.max_tokens:
                # Leaf node that's not chunkable but reasonably sized
                chunks.append({
                    'content': node_text,
                    'start_line': node.start_point[0],
                    'end_line': node.end_point[0],
                    'node_type': node.type,
                    'chunk_type': 'ast',
                    'token_count': token_count,
                })
        
        traverse_node(root_node)
        
        # If no chunks created, fall back
        if not chunks:
            return []
        
        # Add overlap between chunks
        return self._add_overlap(chunks, content)
    
    def _chunk_oversized_node(self, node_text: str, start_line: int, language: str) -> List[Dict]:
        """Split oversized AST nodes using recursive splitter."""
        separators = self.LANGUAGE_SEPARATORS.get(language, ["\n\n", "\n", " "])
        
        # Use smaller chunks for splitting within a single function
        chunk_size = (self.max_tokens - self.overlap_tokens) * 4
        
        splitter = RecursiveCharacterTextSplitter(
            separators=separators,
            chunk_size=chunk_size,
            chunk_overlap=self.overlap_tokens * 4,
            length_function=len,
        )
        
        splits = splitter.split_text(node_text)
        chunks = []
        current_line = start_line
        
        for split_text in splits:
            lines_in_split = split_text.count('\n') + 1
            chunks.append({
                'content': split_text,
                'start_line': current_line,
                'end_line': current_line + lines_in_split - 1,
                'node_type': 'oversized_split',
                'chunk_type': 'ast_fallback',
                'token_count': self._count_tokens(split_text),
            })
            current_line += lines_in_split
        
        return chunks
    
    def _chunk_with_recursive_splitter(self, content: str, language: str, file_path: str) -> List[Dict]:
        """
        Chunk using language-aware recursive text splitting.
        """
        separators = self.LANGUAGE_SEPARATORS.get(language, ["\n\n", "\n", " ", ""])
        
        # Calculate character-based limits (approximate)
        # Average ~4 chars per token
        chunk_size = self.max_tokens * 4
        chunk_overlap = self.overlap_tokens * 4
        
        splitter = RecursiveCharacterTextSplitter(
            separators=separators,
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
            length_function=len,
        )
        
        text_chunks = splitter.split_text(content)
        
        chunks = []
        current_line = 0
        
        for i, chunk_text in enumerate(text_chunks):
            lines_in_chunk = chunk_text.count('\n') + 1
            token_count = self._count_tokens(chunk_text)
            
            # Skip if exceeds token limit (shouldn't happen, but safety check)
            if token_count > self.max_tokens * 1.1:  # 10% tolerance
                continue
            
            chunks.append({
                'content': chunk_text,
                'start_line': current_line,
                'end_line': current_line + lines_in_chunk - 1,
                'node_type': None,
                'chunk_type': 'recursive',
                'token_count': token_count,
            })
            
            current_line += lines_in_chunk
        
        return chunks
    
    def _chunk_simple(self, content: str, file_path: str) -> List[Dict]:
        """
        Simple line-based chunking for markdown and text files.
        """
        # Try splitting by paragraphs first
        paragraphs = re.split(r'\n\s*\n', content)
        
        chunks = []
        current_chunk = []
        current_tokens = 0
        current_line = 0
        
        for para in paragraphs:
            para_tokens = self._count_tokens(para)
            
            if para_tokens > self.max_tokens:
                # Paragraph too large, split by sentences
                sentences = re.split(r'([.!?]\s+)', para)
                for sentence in sentences:
                    sent_tokens = self._count_tokens(sentence)
                    
                    if current_tokens + sent_tokens > self.max_tokens and current_chunk:
                        # Save current chunk
                        chunk_text = ''.join(current_chunk)
                        lines_in_chunk = chunk_text.count('\n') + 1
                        
                        chunks.append({
                            'content': chunk_text,
                            'start_line': current_line,
                            'end_line': current_line + lines_in_chunk - 1,
                            'node_type': None,
                            'chunk_type': 'simple',
                            'token_count': current_tokens,
                        })
                        
                        current_line += lines_in_chunk
                        current_chunk = []
                        current_tokens = 0
                    
                    current_chunk.append(sentence)
                    current_tokens += sent_tokens
            else:
                # Check if adding paragraph exceeds limit
                if current_tokens + para_tokens > self.max_tokens and current_chunk:
                    chunk_text = ''.join(current_chunk)
                    lines_in_chunk = chunk_text.count('\n') + 1
                    
                    chunks.append({
                        'content': chunk_text,
                        'start_line': current_line,
                        'end_line': current_line + lines_in_chunk - 1,
                        'node_type': None,
                        'chunk_type': 'simple',
                        'token_count': current_tokens,
                    })
                    
                    current_line += lines_in_chunk
                    current_chunk = []
                    current_tokens = 0
                
                current_chunk.append(para)
                current_chunk.append('\n\n')
                current_tokens += para_tokens
        
        # Add remaining chunk
        if current_chunk:
            chunk_text = ''.join(current_chunk)
            lines_in_chunk = chunk_text.count('\n') + 1
            
            chunks.append({
                'content': chunk_text,
                'start_line': current_line,
                'end_line': current_line + lines_in_chunk - 1,
                'node_type': None,
                'chunk_type': 'simple',
                'token_count': current_tokens,
            })
        
        return chunks
    
    def _add_overlap(self, chunks: List[Dict], full_content: str) -> List[Dict]:
        """Add overlap between consecutive chunks while respecting token limits."""
        if len(chunks) <= 1:
            return chunks
        
        overlapped_chunks = []
        
        for i, chunk in enumerate(chunks):
            chunk_content = chunk['content']
            current_tokens = chunk['token_count']
            
            # Add prefix from previous chunk if space allows
            if i > 0 and self.overlap_tokens > 0:
                available_tokens = self.max_tokens - current_tokens
                overlap_size = min(self.overlap_tokens, available_tokens)
                
                if overlap_size > 0:
                    prev_content = chunks[i - 1]['content']
                    prev_tokens = self.encoder.encode(prev_content)
                    
                    if len(prev_tokens) > overlap_size:
                        overlap_tokens_list = prev_tokens[-overlap_size:]
                        overlap_text = self.encoder.decode(overlap_tokens_list)
                        chunk_content = overlap_text + "\n" + chunk_content
                        current_tokens = self._count_tokens(chunk_content)
            
            overlapped_chunks.append({
                **chunk,
                'content': chunk_content,
                'token_count': current_tokens,
            })
        
        return overlapped_chunks
    
    def _count_tokens(self, text: str) -> int:
        """Count tokens in text."""
        try:
            return len(self.encoder.encode(text))
        except Exception:
            # Fallback to approximate count
            return len(text) // 4
    
    def _compute_chunk_hash(self, content: str, file_path: str, start_line: int) -> str:
        """Compute SHA-256 hash for chunk ID."""
        data = f"{file_path}:{start_line}:{content}".encode('utf-8')
        return hashlib.sha256(data).hexdigest()
    
    def _finalize_chunks(self, chunks: List[Dict], file_path: str, language: str) -> List[Dict]:
        """Add final metadata and validate chunks."""
        total_chunks = len(chunks)
        finalized = []
        
        for i, chunk in enumerate(chunks):
            token_count = chunk['token_count']
            
            # Validate token count
            if token_count > self.max_tokens * 1.1:  # 10% tolerance
                logger.warning(
                    f"Chunk {i} in {file_path} exceeds token limit: "
                    f"{token_count} > {self.max_tokens}"
                )
                # Skip chunks that are too large
                continue
            
            finalized.append({
                'chunk_id': self._compute_chunk_hash(
                    chunk['content'], 
                    file_path, 
                    chunk['start_line']
                ),
                'file_path': file_path,
                'content': chunk['content'],
                'start_line': chunk['start_line'],
                'end_line': chunk['end_line'],
                'chunk_index': i,
                'total_chunks': total_chunks,
                'language': language,
                'chunk_type': chunk['chunk_type'],
                'token_count': chunk['token_count'],
                'node_type': chunk.get('node_type'),
            })
        
        return finalized
