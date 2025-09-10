import os
import tiktoken
from .store import FaissStore
from dotenv import load_dotenv
from .embedding import Embedder
from langchain.schema import Document
from langchain_community.document_loaders import GithubFileLoader

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

# cloned aqa-tests wiki's to VitAI/data directory
# the below code loads those wiki files and later adds them to the FAISS store

# base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
# wiki_dir = os.path.join(base_dir, "data", "aqa-tests.wiki")

# documents = []  # will be filled with Document objects

# for root, _, files in os.walk(wiki_dir):
#     for fname in files:
#         if fname.lower().endswith((".md", ".markdown")):
#             fp = os.path.join(root, fname)
#             try:
#                 with open(fp, "r", encoding="utf-8", errors="replace") as fh:
#                     content = fh.read()
#                 rel = os.path.relpath(fp, base_dir).replace("\\", "/")
#                 documents.append(Document(page_content=content, metadata={"source": f"wiki:{rel}"}))
#             except Exception:
#                 continue

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