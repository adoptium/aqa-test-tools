import os
import re
import sys
import tiktoken
import subprocess
from dotenv import load_dotenv
from langchain.schema import Document
from langchain_community.document_loaders import GithubFileLoader

if __name__ == "__main__":
    sys.path.append(os.path.dirname(os.path.abspath(__file__)))
    from store import FaissStore
    from embedding import Embedder
else:
    from .store import FaissStore
    from .embedding import Embedder

load_dotenv()
GITHUB_TOKEN = os.getenv("GITHUB_TOKEN")

loader = GithubFileLoader(
    repo="adoptium/aqa-tests",  # repo name
    branch="master",  # branch name
    access_token=GITHUB_TOKEN,
    github_api_url="https://api.github.com",
    file_filter=lambda file_path: (
        file_path.endswith((".md", ".markdown", ".txt"))
        and not file_path.startswith("functional/MBCS_Tests/")
    ),  # file types to load, excluding functional/MBCS_Tests
)
documents = loader.load()

openj9_loader = GithubFileLoader(
    repo="eclipse-openj9/openj9",
    branch="master",
    access_token=GITHUB_TOKEN,
    github_api_url="https://api.github.com",
    file_filter=lambda file_path: file_path.endswith(
        ("test/README.md", "test/docs/OpenJ9TestUserGuide.md")
    ),
)
openj9_documents = openj9_loader.load()

documents = documents + openj9_documents

# Load wiki files from aqa-tests

base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
wiki_dir = os.path.join(base_dir, "data", "aqa-tests.wiki")

# Ensure the wiki repo is present in VitAI/data; clone if missing, pull if present
GIT_WIKI_URL = "https://github.com/adoptium/aqa-tests.wiki.git"
data_dir = os.path.join(base_dir, "data")
os.makedirs(data_dir, exist_ok=True)

_INVALID_WIN_CHARS = re.compile(r'[<>:"/\\|?*]')
_RESERVED_WIN_NAMES = {
    "CON", "PRN", "AUX", "NUL",
    *(f"COM{i}" for i in range(1, 10)),
    *(f"LPT{i}" for i in range(1, 10)),
}


def _invalid_windows_component(name: str) -> bool:
    if _INVALID_WIN_CHARS.search(name):
        return True
    if name.endswith(" ") or name.endswith("."):
        return True
    base = name.split(".")[0].upper()
    if base in _RESERVED_WIN_NAMES:
        return True
    return False


def _is_invalid_windows_path(path: str) -> bool:
    # check each path component
    for comp in path.replace("\\", "/").split("/"):
        if _invalid_windows_component(comp):
            return True
    return False


def _sparse_checkout_excluding_invalid(repo_dir: str):
    # ensure git config to relax NTFS checks and longpaths (best-effort)
    subprocess.run(["git", "-C", repo_dir, "config", "core.protectNTFS", "false"], check=False)
    subprocess.run(["git", "-C", repo_dir, "config", "core.longpaths", "true"], check=False)

    # list all files in HEAD (no working-tree required)
    res = subprocess.run(["git", "-C", repo_dir, "ls-tree", "-r", "--name-only", "HEAD"], capture_output=True, text=True)
    if res.returncode != 0:
        print("Unable to list files in repo for sparse checkout:", res.stderr)
        return

    all_files = [f.strip() for f in res.stdout.splitlines() if f.strip()]
    allowed = [f for f in all_files if not _is_invalid_windows_path(f)]
    if not allowed:
        print("No safe files available to checkout on this Windows host.")
        return

    # enable sparse-checkout and write allowed file list
    subprocess.run(["git", "-C", repo_dir, "config", "core.sparseCheckout", "true"], check=True)
    sparse_path = os.path.join(repo_dir, ".git", "info", "sparse-checkout")
    os.makedirs(os.path.dirname(sparse_path), exist_ok=True)
    with open(sparse_path, "w", encoding="utf-8") as fh:
        for p in allowed:
            fh.write(p + "\n")

    # checkout only allowed files
    co = subprocess.run(["git", "-C", repo_dir, "checkout", "HEAD"], capture_output=True, text=True)
    if co.returncode != 0:
        print("Sparse checkout failed:", co.stderr)
    else:
        print("Sparse checkout completed, excluded invalid Windows filenames.")


if not os.path.isdir(wiki_dir):
    print(f"Cloning wiki repository to: {wiki_dir}")
    try:
        # try a normal clone but relax NTFS/longpaths for this command
        subprocess.run(
            [
                "git",
                "-c",
                "core.protectNTFS=false",
                "-c",
                "core.longpaths=true",
                "clone",
                GIT_WIKI_URL,
                wiki_dir,
            ],
            check=True,
            capture_output=True,
            text=True,
        )
    except subprocess.CalledProcessError as e:
        stderr = (e.stderr or "") if isinstance(e, subprocess.CalledProcessError) else str(e)
        print("Error cloning wiki repo:", stderr.strip())
        # If git reports "Clone succeeded, but checkout failed." or unable to create files,
        # repo dir may exist; attempt a sparse checkout that excludes windows-invalid names.
        if os.path.isdir(wiki_dir):
            print("Repo created but checkout failed; falling back to sparse checkout that excludes invalid Windows filenames.")
            try:
                _sparse_checkout_excluding_invalid(wiki_dir)
            except Exception as ex:
                print("Fallback sparse-checkout failed:", ex)
else:
    # Update existing repo
    try:
        print(f"Updating wiki repository at: {wiki_dir}")
        subprocess.run(
            [
                "git",
                "-C",
                wiki_dir,
                "-c",
                "core.protectNTFS=false",
                "-c",
                "core.longpaths=true",
                "pull",
            ],
            check=True,
            capture_output=True,
            text=True,
        )
    except subprocess.CalledProcessError as e:
        stderr = (e.stderr or "") if isinstance(e, subprocess.CalledProcessError) else str(e)
        print("Error updating wiki repo:", stderr.strip())
        # if pull failed due to checkout problems, try sparse-checkout fallback
        if "unable to create file" in stderr or "checkout failed" in stderr:
            print("Pull created checkout problems; attempting sparse checkout excluding invalid Windows filenames.")
            try:
                _sparse_checkout_excluding_invalid(wiki_dir)
            except Exception as ex:
                # handle the fallback error so the except block is not empty
                print("Fallback sparse-checkout failed during pull handling:", ex)

for root, _, files in os.walk(wiki_dir):
    for fname in files:
        if fname.lower().endswith((".md", ".markdown")):
            fp = os.path.join(root, fname)
            try:
                with open(fp, "r", encoding="utf-8", errors="replace") as fh:
                    content = fh.read()
                rel = os.path.relpath(fp, base_dir).replace("\\", "/")
                documents.append(Document(page_content=content, metadata={"source": f"wiki:{rel}"}))
            except Exception:
                continue

# Load AQAvit blogs from adoprium.net 

aqavit_blogs = {
    "content/asciidoc-pages/docs/aqavit-verification/index.adoc",
    "content/asciidoc-pages/docs/qvs-policy/index.adoc",
}

blogs = GithubFileLoader(
    repo="adoptium/adoptium.net",
    branch="main",
    access_token=GITHUB_TOKEN,
    github_api_url="https://api.github.com",
    file_filter=lambda file_path: file_path.replace("\\", "/") in aqavit_blogs,
)

blog_documents = blogs.load()

documents = documents + blog_documents

# Token-based chunking 
encoder = tiktoken.get_encoding("cl100k_base")

def split_text_to_token_chunks(text: str, chunk_tokens: int, overlap_tokens: int):
    """
    Split `text` into pieces where each piece is <= chunk_tokens (by token count),
    with `overlap_tokens` overlap between consecutive chunks.
    Returns list[str].
    """
    if chunk_tokens <= 0:
        raise ValueError("chunk_tokens must be > 0")
    if overlap_tokens < 0:
        raise ValueError("overlap_tokens must be >= 0")
    if overlap_tokens >= chunk_tokens:
        raise ValueError("overlap_tokens must be smaller than chunk_tokens")

    tokens = encoder.encode(text)
    if not tokens:
        return []

    chunks = []
    start = 0
    step = chunk_tokens - overlap_tokens
    while start < len(tokens):
        end = min(start + chunk_tokens, len(tokens))
        chunk_text = encoder.decode(tokens[start:end])
        chunks.append(chunk_text)
        if end == len(tokens):
            break
        start += step
    return chunks

TARGET_TOKENS = 1000
OVERLAP_TOKENS = 200 # 20%

# Create token-based chunks while preserving original metadata and source info
token_chunks = []
for d in documents:
    text = d.page_content
    parts = split_text_to_token_chunks(text, TARGET_TOKENS, OVERLAP_TOKENS)
    if not parts:
        continue
    for part in parts:
        token_chunks.append(Document(page_content=part, metadata=d.metadata))

documents = token_chunks  # replaced original documents with token-chunks

embedder = Embedder()

# prepare texts and metadatas from Document objects
texts = [d.page_content for d in documents]
metadatas = [d.metadata for d in documents]

# batch-embed (list[list[float]])
BATCH_SIZE = 50
all_embeddings = []
for i in range(0, len(texts), BATCH_SIZE):
    batch_texts = texts[i : i + BATCH_SIZE]
    batch_embs = embedder.embed(batch_texts)
    all_embeddings.extend(batch_embs)

if not all_embeddings:
    raise RuntimeError("No embeddings produced")

# persist to FAISS
base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
vector_store_dir = os.path.join(base_dir, "VectorStore")
store = FaissStore(store_dir=vector_store_dir)
store.build_from_embeddings(
    embeddings=all_embeddings,
    metadatas=metadatas,
    texts=texts,
)

print(f"Saved FAISS store to: {vector_store_dir}")