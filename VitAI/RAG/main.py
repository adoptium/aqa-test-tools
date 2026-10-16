"""
CLI tool for indexing GitHub repositories into vector stores.

Usage:
    python main.py --repo owner/repo --exclude node_modules,dist
    python main.py --repo owner/repo --search "query text"
    python main.py --repo owner/repo --delete
"""

import os
import sys
import signal
import logging
import base64
import shutil
from typing import List, Dict, Any, Optional
from pathlib import Path

import click
import requests
from rich.console import Console
from rich.progress import Progress, SpinnerColumn, TextColumn, BarColumn, TaskProgressColumn, TimeRemainingColumn
from dotenv import load_dotenv

from indexer import CodeChunker
from embedding import Embedder
from store import FaissStore
from merkle_tree import MerkleTreeStore

load_dotenv()
console = Console()
interrupted = False


def signal_handler(signum, frame):
    global interrupted
    interrupted = True
    console.print("\n[yellow]Interrupted by user. Cleaning up...[/yellow]")
    sys.exit(1)


signal.signal(signal.SIGINT, signal_handler)
signal.signal(signal.SIGTERM, signal_handler)


def setup_logging(verbose: bool):
    level = logging.DEBUG if verbose else logging.INFO
    logging.basicConfig(level=level, format='%(asctime)s - %(levelname)s - %(message)s')


def parse_repo_url(repo_input: str) -> str:
    """Parse repository URL into owner/repo format."""
    repo = repo_input.strip().rstrip('/').replace('https://github.com/', '').replace('http://github.com/', '').replace('github.com/', '').removesuffix('.git')
    if len(repo.split('/')) != 2:
        raise ValueError(f"Invalid repository format: {repo_input}. Expected 'owner/repo'")
    return repo


def github_api_call(url: str, token: str) -> Dict:
    """Make GitHub API call with error handling."""
    response = requests.get(url, headers={'Authorization': f'token {token}', 'Accept': 'application/vnd.github.v3+json'})
    if response.status_code == 404:
        raise Exception("Repository not found (404)")
    elif response.status_code == 403:
        raise Exception("GitHub API rate limit exceeded")
    elif response.status_code != 200:
        raise Exception(f"API request failed: {response.status_code}")
    return response.json()


def fetch_repo_files(repo_url: str, github_token: str) -> Dict[str, Any]:
    """Fetch repository files from GitHub API using tree endpoint."""
    owner, repo = parse_repo_url(repo_url).split('/')
    base_url = f'https://api.github.com/repos/{owner}/{repo}'
    
    repo_info = github_api_call(base_url, github_token)
    default_branch = repo_info['default_branch']
    
    branch_info = github_api_call(f'{base_url}/branches/{default_branch}', github_token)
    commit_sha = branch_info['commit']['sha']
    
    tree_data = github_api_call(f'{base_url}/git/trees/{commit_sha}?recursive=1', github_token)
    
    files = []
    for item in tree_data.get('tree', []):
        if item['type'] == 'blob':
            try:
                content_data = github_api_call(f"{base_url}/contents/{item['path']}?ref={default_branch}", github_token)
                content = base64.b64decode(content_data['content']).decode('utf-8')
                files.append({'path': item['path'], 'content': content, 'sha': item['sha'], 'size': item['size']})
            except (UnicodeDecodeError, KeyError, Exception):
                logging.debug(f"Skipping file: {item['path']}")
    
    return {'files': files, 'default_branch': default_branch, 'commit_sha': commit_sha}


def filter_files(files: List[Dict], exclude_patterns: List[str]) -> List[Dict]:
    """Filter files based on exclude patterns."""
    if not exclude_patterns:
        return files
    return [f for f in files if not any(f"/{p}/" in f"/{f['path']}/" or f['path'].startswith(f"{p}/") for p in exclude_patterns)]


def format_number(n: int) -> str:
    return f"{n:,}"


def print_error(message: str, details: Optional[str] = None):
    console.print(f"[bold red]Error:[/bold red] {message}")
    if details:
        console.print(f"   {details}")
    sys.exit(1)


def get_env_config():
    """Get configuration from environment variables."""
    return {
        'github_token': os.getenv('GITHUB_TOKEN'),
        'vector_store_dir': os.getenv('VECTOR_STORE_DIR', './VectorStore'),
        'merkle_db_path': os.getenv('MERKLE_DB_PATH', './merkle_trees.db')
    }


def process_batch(items: List, processor, batch_size: int, description: str):
    """Process items in batches with progress bar."""
    results = []
    with Progress(SpinnerColumn(), TextColumn("[progress.description]{task.description}"),
                 BarColumn(), TaskProgressColumn(), TimeRemainingColumn(),
                 console=console) as progress:
        task = progress.add_task(description, total=len(items))
        for i in range(0, len(items), batch_size):
            if interrupted:
                sys.exit(1)
            results.extend(processor(items[i:i + batch_size]))
            progress.update(task, advance=min(batch_size, len(items) - i))
    return results


@click.command()
@click.option('--repo', '-r', required=True, help='Repository URL or owner/repo format')
@click.option('--exclude', '-e', help='Comma-separated directories to exclude')
@click.option('--search', '-s', help='Search query text')
@click.option('--delete', '-d', is_flag=True, help='Delete repository index')
@click.option('--verbose', '-v', is_flag=True, help='Enable verbose logging')
def cli(repo, exclude, search, delete, verbose):
    """GitHub Repository Indexing CLI Tool."""
    setup_logging(verbose)
    
    if delete:
        handle_delete(repo)
    elif search:
        handle_search(repo, search)
    else:
        exclude_list = [e.strip() for e in exclude.split(',')] if exclude else []
        handle_index(repo, exclude_list, verbose)


def handle_index(repo_url, exclude, verbose):
    """Handle repository indexing."""
    try:
        repo_name = parse_repo_url(repo_url)
        config = get_env_config()
        
        if not config['github_token']:
            print_error("GITHUB_TOKEN environment variable not set", 
                       "Please set your GitHub personal access token: export GITHUB_TOKEN='your_token_here'")
        
        console.print(f"\n[bold cyan]Indexing repository:[/bold cyan] {repo_name}")
        if exclude:
            console.print(f"   [dim]Excluding:[/dim] {', '.join(exclude)}")
        
        # Initialize components
        chunker = CodeChunker()
        embedder = Embedder()
        store = FaissStore(base_dir=config['vector_store_dir'])
        merkle_store = MerkleTreeStore(db_path=config['merkle_db_path'])
        
        # Fetch files
        console.print("\n[bold]Fetching files from GitHub...[/bold]")
        
        with console.status("[bold green]Fetching repository..."):
            try:
                repo_data = fetch_repo_files(repo_url, config['github_token'])
            except Exception as e:
                hint = "Repository not found. Check the URL and your access permissions." if "404" in str(e) else \
                       "GitHub API rate limit exceeded. Please wait or use a token with higher limits." if "rate limit" in str(e).lower() else None
                print_error(f"Failed to fetch repository: {str(e)}", hint)
        
        filtered_files = filter_files(repo_data['files'], exclude)
        
        console.print(f"   [green]Fetched {format_number(len(filtered_files))} files[/green]" + 
                     (f" [dim](excluding {format_number(len(repo_data['files']) - len(filtered_files))} files)[/dim]" if exclude else ""))
        console.print(f"   [dim]Branch:[/dim] {repo_data['default_branch']} [dim](commit:[/dim] {repo_data['commit_sha'][:7]}[dim])[/dim]")
        
        if not filtered_files:
            print_error("No files to index after applying filters")
        
        # Detect changes
        console.print("\n[bold]Detecting changes...[/bold]")
        
        with console.status("[bold green]Computing file hashes..."):
            changes = merkle_store.detect_changes(repo_name, filtered_files, repo_data['commit_sha'])
        
        added, modified, deleted = len(changes.get('added', [])), len(changes.get('modified', [])), len(changes.get('deleted', []))
        
        if added == 0 and modified == 0 and deleted == 0:
            console.print("   [green]No changes detected[/green]\n[bold green]Repository is up to date[/bold green]")
            sys.exit(0)
        
        console.print(f"   [cyan]Added:[/cyan] {format_number(added)} files")
        console.print(f"   [yellow]Modified:[/yellow] {format_number(modified)} files")
        console.print(f"   [red]Deleted:[/red] {format_number(deleted)} files")
        
        files_to_process = [f for f in filtered_files if f['path'] in changes.get('added', []) or f['path'] in changes.get('modified', [])]
        
        # Chunk files
        console.print(f"\n[bold]Chunking code...[/bold]")
        
        def chunk_file(file):
            try:
                chunks = chunker.chunk_file(file['path'], file['content'])
                for chunk in chunks:
                    chunk['file_sha'] = file['sha']
                return chunks
            except Exception as e:
                if verbose:
                    console.print(f"   [yellow]Warning: Failed to chunk {file['path']}: {str(e)}[/yellow]")
                return []
        
        all_chunks = process_batch(files_to_process, lambda batch: [c for f in batch for c in chunk_file(f)], 1, "Chunking files...")
        
        console.print(f"   [green]Created {format_number(len(all_chunks))} chunks[/green]")
        
        if not all_chunks:
            print_error("No chunks generated from files")
        
        # Generate embeddings
        console.print(f"\n[bold]Generating embeddings...[/bold]")
        
        texts = [chunk['content'] for chunk in all_chunks]
        embeddings = process_batch(texts, embedder.embed, 50, "Embedding chunks...")
        
        console.print(f"   [green]Generated {format_number(len(embeddings))} embeddings[/green]")
        
        # Store in vector database
        console.print(f"\n[bold]Storing in vector database...[/bold]")
        
        # Add repo_name to all chunks
        for chunk in all_chunks:
            chunk['repo_name'] = repo_name
        
        with console.status("[bold green]Updating vector store..."):
            for deleted_file in changes.get('deleted', []):
                store.delete_file_chunks(repo_name, deleted_file)
            
            for file_path in changes.get('modified', []):
                file_chunks = [c for c in all_chunks if c['file_path'] == file_path]
                if file_chunks:
                    file_embeddings = [embeddings[all_chunks.index(c)] for c in file_chunks]
                    store.update_file_chunks(repo_name, file_path, file_embeddings, file_chunks, [c['content'] for c in file_chunks])
            
            added_chunks = [c for c in all_chunks if c['file_path'] in changes.get('added', [])]
            if added_chunks:
                added_embeddings = [embeddings[all_chunks.index(c)] for c in added_chunks]
                store.add_to_repo(repo_name, added_embeddings, added_chunks, [c['content'] for c in added_chunks])
        
        console.print(f"   [green]Stored {format_number(len(embeddings))} vectors[/green]")
        
        # Update Merkle tree
        with console.status("[bold green]Updating Merkle tree..."):
            tree = merkle_store.compute_tree(repo_name, filtered_files, repo_data['commit_sha'])
            merkle_store.save_tree(tree)
        
        # Display summary
        stats = store.get_repo_stats(repo_name)
        console.print(f"\n[bold]Summary:[/bold]")
        console.print(f"   [cyan]Repository:[/cyan] {repo_name}")
        console.print(f"   [cyan]Commit:[/cyan] {repo_data['commit_sha'][:7]}")
        console.print(f"   [cyan]Total chunks:[/cyan] {format_number(stats.get('total_vectors', 0))}")
        
        if 'chunks_by_language' in stats:
            top_langs = sorted(stats['chunks_by_language'].items(), key=lambda x: x[1], reverse=True)[:3]
            total = sum(stats['chunks_by_language'].values())
            console.print(f"   [cyan]Languages:[/cyan] {', '.join([f'{l} ({c}/{total*100:.0f}%)' for l, c in top_langs])}")
        
        console.print(f"\n[bold green]Successfully indexed {repo_name}[/bold green]")
        
    except ValueError as e:
        print_error(str(e))
    except KeyboardInterrupt:
        console.print("\n[yellow]Interrupted by user[/yellow]")
        sys.exit(1)
    except Exception as e:
        console.print(f"[bold red]Unexpected error:[/bold red] {str(e)}")
        if verbose:
            import traceback
            console.print(traceback.format_exc())
        sys.exit(1)


def handle_search(repo_name, query):
    """Handle repository search."""
    try:
        repo_name = parse_repo_url(repo_name)
        config = get_env_config()
        
        console.print(f"\n[bold cyan]Searching {repo_name} for:[/bold cyan] \"{query}\"\n")
        
        store = FaissStore(base_dir=config['vector_store_dir'])
        embedder = Embedder()
        
        try:
            stats = store.get_repo_stats(repo_name)
            if stats.get('total_vectors', 0) == 0:
                raise Exception("empty")
        except Exception:
            print_error(f"Repository '{repo_name}' is not indexed", f"Run: python main.py --repo {repo_name}")
        
        with console.status("[bold green]Generating query embedding..."):
            query_embedding = embedder.embed([query])[0]
        
        with console.status("[bold green]Searching..."):
            results = store.search(query_embedding, top_k=5, repo_name=repo_name)
        
        if not results:
            console.print("   [yellow]No results found[/yellow]")
            sys.exit(0)
        
        console.print(f"[bold]Results (top {len(results)}):[/bold]\n")
        
        for i, result in enumerate(results, 1):
            m = result.get('metadata', {})
            console.print(f"[bold cyan]{i}. [Score: {result.get('score', 0):.2f}][/bold cyan] {m.get('file_path', 'unknown')}:{m.get('start_line', 0)}-{m.get('end_line', 0)}")
            console.print(f"   [dim]Type:[/dim] {m.get('chunk_type', 'unknown')} [dim]|[/dim] [dim]Language:[/dim] {m.get('language', 'unknown')}")
            text = result.get('text', '')
            console.print(f"   [dim]{text[:200] + '...' if len(text) > 200 else text}[/dim]\n")
        
    except Exception as e:
        print_error(f"Search failed: {str(e)}")


def handle_delete(repo_name):
    """Handle deleting repository index."""
    try:
        repo_name = parse_repo_url(repo_name).replace('/', '_')
        config = get_env_config()
        repo_path = Path(config['vector_store_dir']) / repo_name
        
        if not repo_path.exists():
            print_error(f"Repository '{repo_name}' not found")
        
        if not click.confirm(f"Are you sure you want to delete index for '{repo_name}'?", default=False):
            console.print("Deletion cancelled")
            sys.exit(0)
        
        with console.status("[bold yellow]Deleting index..."):
            shutil.rmtree(repo_path)
        
        console.print(f"[bold green]Successfully deleted index for {repo_name}[/bold green]")
        
    except Exception as e:
        print_error(f"Failed to delete repository: {str(e)}")


if __name__ == "__main__":
    cli()

