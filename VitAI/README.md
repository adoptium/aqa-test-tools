# VitAI - RAG-based assistant for AQAvit

VitAI is a Retrieval-Augmented Generation (RAG) system that allows users to ask natural language questions about the repo and receive accurate, context-aware, and up-to-date answers based on the codebase.

## Phase 1 Features:

1. Lightweight RAG pipeline using local vector store (`VectorStore/index.faiss`).
2. Modular components:
   - Embedding generation (`src/embedding.py`)
   - Index creation (`src/indexer.py`)
   - Persistent store management (`src/store.py`)
   - Orchestration / entry point (`src/main.py`)
3. Test using an adversarial LLM under `test/` to validate similarity and retrieval.

## Prerequisites

1. Python 3.10+

## Setup

1. Open Terminal at the `aqa-test-tools` repository root and run:

   ```bash
   cd VitAI
   ```

2. Install Python dependencies:

   ```bash
   pip install -r requirements.txt
   ```

3. Environment variables:
   1. Visit [GitHub Access Tokens](https://github.com/settings/personal-access-tokens/new?description=Used+to+call+GitHub+Models+APIs+to+easily+run+LLMs%3A+https%3A%2F%2Fdocs.github.com%2Fgithub-models%2Fquickstart%23step-2-make-an-api-call&name=GitHub+Models+token&user_models=read)
   2. Create the Personal Access Token with "read-only" access to "Models"
   3. Set the environment variable in `.env` file as `GITHUB_TOKEN`

## Command Line Interface (CLI)

1. Open Terminal at the `aqa-test-tools` repository root and run:
   ```bash
   cd VitAI
   ```
2. Run the command:
   ```bash
   python src/main.py
   ```
3. Enter your query and wait for the response from the LLM
4. To quit the program, enter `exit`, `quit`, or press Enter.

## Testing

1. Open Terminal at the `aqa-test-tools` repository root and run:
   ```bash
   cd VitAI
   ```
2. Run the command:
   ```bash
   python test/test-similarity.py
   ```
3. Observe the test results along with the justification for those results given by the adversarial LLM.

## Technical Details

- **Large Language Model** - microsoft/Phi-4 using Azure AI Interface SDK
- **Embeddings** - openai/text-embedding-3-large
- **Vector Store** - FAISS (Facebook AI Similarity Search)
- **Chunk Size** - 1000 tokens + 200 tokens overlap
- **Similarity Search** - Cosine similarity
- **Top K** - 2 nearest neighbors
- **Data**
  - `.txt`, `.md`, `.markdown` files and [Wiki's](https://github.com/adoptium/aqa-tests/
    wiki) from [adoptium/aqa-tests](https://github.com/adoptium/aqa-tests)
  - Excluded [MBCS_Tests](https://github.com/adoptium/aqa-tests/tree/master/functional/MBCS_Tests) directory due to noise
  - Blogs on AQAvit - [Blog 1](https://github.com/adoptium/adoptium.net/blob/main/content/asciidoc-pages/docs/aqavit-verification/index.adoc) and [Blog 2](https://github.com/adoptium/adoptium.net/blob/main/content/asciidoc-pages/docs/qvs-policy/index.adoc)
  - `.md` and `.markdown` file from:
    - [adoptium/TKG](https://github.com/adoptium/TKG)
    - [adoptium/aqa-systemtest](https://github.com/adoptium/aqa-systemtest)
    - [adoptium/aqa-test-tools](https://github.com/adoptium/aqa-test-tools)
    - [adoptium/STF](https://github.com/adoptium/STF)
    - [adoptium/bumblebench](https://github.com/adoptium/bumblebench)
    - [adoptium/run-aqa](https://github.com/adoptium/run-aqa)
    - [adoptium/openj9-systemtest](https://github.com/adoptium/openj9-systemtest)
    - [eclipse-openj9/openj9](https://github.com/eclipse-openj9/openj9)
- **Ideal Answers** - `data/ideal_answers.json` (manually curated for testing from [OpenJ9TestUserGuide.md](https://github.com/eclipse-openj9/openj9/blob/master/test/docs/OpenJ9TestUserGuide.md))

## How it works (high level)

1. `src/embedding.py` produces vector embeddings for text.
2. `src/indexer.py` consumes data from the data sources mentioned earlier and builds a FAISS index saved under `VectorStore/index.faiss` along with `VectorStore/metadata.json`.
3. `src/store.py` provides persistence helpers for loading/saving the vector store and associated metadata and acts as a retriever for nearest neighbor search.
4. `src/main.py` orchestrates a retrieval request: it embeds incoming text, queries the FAISS index for nearest neighbors, and passes context to the LLM to get the result.
