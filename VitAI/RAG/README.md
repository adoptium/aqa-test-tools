# VitAI RAG (Retrieval-Augmented Generation) System

A scalable and efficient codebase indexing and retrieval system for GitHub repositories, built using advanced AST-based chunking, vector embeddings, and semantic search capabilities.

## Overview

This RAG system enables intelligent code search and retrieval across multiple GitHub repositories by creating vector embeddings of code chunks and storing them in FAISS vector databases. The system uses tree-sitter for AST-based code parsing and supports incremental updates through Merkle tree-based change detection.

## Architecture

The system is built on several key components:

- **Indexer**: Advanced code chunking using tree-sitter AST parsing with fallback strategies
- **Embeddings**: Vector representations of code chunks using sentence transformers
- **Vector Store**: FAISS-based efficient similarity search
- **Merkle Tree**: Incremental update detection for repositories
- **CLI**: Command-line interface for repository management

### Codebase Indexing Strategy

The indexing logic is inspired by the approach detailed in [How Cursor Indexes Codebases Fast](https://read.engineerscodex.com/p/how-cursor-indexes-codebases-fast), which provides insights into efficient codebase indexing techniques.

## Features

- **Multi-language Support**: Supports 25+ programming languages including Python, Java, JavaScript, TypeScript, C/C++, Go, Rust, and more
- **AST-based Chunking**: Intelligent code chunking that respects language syntax and structure
- **Incremental Updates**: Only re-indexes changed files using Merkle tree-based change detection
- **Semantic Search**: Find relevant code snippets using natural language queries
- **Efficient Storage**: FAISS vector databases for fast similarity search
- **Progress Tracking**: Rich terminal UI with progress bars and detailed logging

## Indexed Repositories

The following repositories have been indexed and are available for search:

- **adoptium/aqa-tests**: Central project for AQAvit (Application Quality Assurance Verification Initiative)
- **adoptium/aqa-systemtest**: System verification tests for the Adoptium project
- **adoptium/aqa-test-tools**: Test workflow tools and utilities
- **adoptium/TKG**: Lightweight test harness (TestKitGen)
- **adoptium/STF**: System Test Framework for Java testing
- **adoptium/bumblebench**: Microbenchmarking framework for performance testing
- **adoptium/openj9-systemtest**: OpenJ9-specific system tests
- **adoptium/run-aqa**: GitHub action for running AQA tests
- **documentation**: Additional documentation resources

## Installation

Install the required dependencies:

```bash
pip install -r requirements.txt
```

Set up your environment variables in a `.env` file:

```bash
GITHUB_TOKEN=your_github_personal_access_token
```

## Usage

### Indexing a Repository

Index a new repository or update an existing one:

```bash
python main.py --repo owner/repo
```

Exclude specific directories:

```bash
python main.py --repo owner/repo --exclude node_modules,dist,build
```

### Searching a Repository

Search for code snippets using natural language:

```bash
python main.py --repo owner/repo --search "function to parse JSON files"
```

### Deleting an Index

Remove a repository index:

```bash
python main.py --repo owner/repo --delete
```

### Verbose Logging

Enable detailed logging for debugging:

```bash
python main.py --repo owner/repo --verbose
```

## Code Chunking Strategy

The system uses a multi-tiered chunking approach:

1. **AST-based Chunking**: Primary strategy using tree-sitter for syntax-aware chunking (functions, classes, methods)
2. **Recursive Splitting**: Language-aware recursive text splitting for unsupported languages or failed AST parsing
3. **Simple Chunking**: Paragraph/sentence-based splitting for markdown and text files

### Supported Languages

Python, JavaScript, TypeScript, Java, C, C++, Go, Rust, Ruby, Bash, Groovy, Make, HTML, XML, YAML, JSON, SQL, Perl, PHP, TOML, INI, and more.

## Configuration

Default configuration:

- **Max Tokens per Chunk**: 1000 tokens
- **Overlap Tokens**: 200 tokens
- **Max File Size**: 1MB
- **Embedding Model**: OpenAI/text-embedding-3-large
- **Vector Store**: FAISS with cosine similarity

## Components

### indexer.py

Advanced code chunker with tree-sitter AST parsing and multiple fallback strategies. Handles token limits, overlapping chunks, and language-specific syntax.

### embedding.py

Generates vector embeddings for code chunks using sentence-transformers, enabling semantic similarity search.

### store.py

FAISS-based vector store implementation with support for adding, updating, deleting, and searching code chunks across repositories.

### merkle_tree.py

Merkle tree implementation for efficient change detection, enabling incremental repository updates without re-indexing unchanged files.

### main.py

CLI tool providing a user-friendly interface for repository indexing, searching, and management operations.

## Directory Structure

```
VitAI/RAG/
├── .env                    # Environment variables
├── embedding.py            # Vector embedding generation
├── indexer.py              # Code chunking and parsing
├── main.py                 # CLI interface
├── merkle_tree.py          # Change detection
├── store.py                # Vector store management
├── requirements.txt        # Python dependencies
├── README.md               # This file
└── VectorStore/            # FAISS vector databases
    ├── adoptium_aqa-tests/
    ├── adoptium_TKG/
    ├── adoptium_STF/
    └── ...
```

## Acknowledgments

The codebase indexing approach is inspired by the techniques described in [How Cursor Indexes Codebases Fast](https://read.engineerscodex.com/p/how-cursor-indexes-codebases-fast).
