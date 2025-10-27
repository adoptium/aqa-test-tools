import os
import sys
from dotenv import load_dotenv
from langchain_core.prompts import PromptTemplate
from azure.ai.inference import ChatCompletionsClient
from azure.ai.inference.models import SystemMessage, UserMessage
from azure.core.credentials import AzureKeyCredential

if __name__ == "__main__":
    sys.path.append(os.path.dirname(os.path.abspath(__file__)))
    from store import FaissStore
    from embedding import Embedder
else:
    from .store import FaissStore
    from .embedding import Embedder

load_dotenv()
GITHUB_TOKEN = os.getenv("GITHUB_TOKEN")

endpoint = "https://models.github.ai/inference"
model = "microsoft/Phi-4"

client = ChatCompletionsClient(
    endpoint=endpoint,
    credential=AzureKeyCredential(GITHUB_TOKEN),
)

embedder = Embedder()
store = FaissStore()

prompt = PromptTemplate(
    template = """
    Context: {context}
    Query: {query}
    """,
    input_variables = ["context", "query"]
)


def _build_context_string(hits):
    # build a context string from search hits (include source if available)
    if not hits:
        return "No relevant documents found."
    context_parts = []
    for i, h in enumerate(hits, start=1):
        src = h.get("metadata") if isinstance(h.get("metadata"), str) else (h.get("metadata", {}).get("source") if h.get("metadata") else None)
        src_label = f"[{src}]" if src else f"[hit:{i}]"
        text = h.get("text") or (h.get("metadata", {}).get("text") if h.get("metadata") else h.get("text", ""))
        context_parts.append(f"{src_label} {text}")
    return "\n\n".join(context_parts)


def get_rag_answer(query: str, top_k: int = 2):
    # embed, retrieve, prompt the LLM, and return answer, context, and query embedding
    embedded_query = embedder.embed(query)
    q_emb = embedded_query[0] if embedded_query else []
    hits = store.search(q_emb, top_k)
    context_str = _build_context_string(hits)

    final_prompt = prompt.format(context=context_str, query=query)

    try:
        response = client.complete(
            model=model,
            messages=[
                SystemMessage("You are VitAI, a Retrieval-Augmented Generation (RAG) system that answers questions about the adoptium/aqa-tests repo. Provide one concise, comprehensive answer only. Do NOT ask clarifying or follow-up questions, do NOT offer next steps or suggestions, and do NOT produce any additional messages — output exactly one answer (no conversation)."),
                UserMessage(final_prompt),
            ],
            temperature=0.0,
        )
        answer = response.choices[0].message.content
    except Exception as e:
        answer = f"LLM request failed: {e}"

    return answer, context_str, q_emb

# CLI
if __name__ == "__main__":
    while True:
        try:
            query = input("Please enter your query: ")
        except (EOFError, KeyboardInterrupt):
            print("\nExiting.")
            break
        if query.strip().lower() in ("quit", "exit", ""):
            break

        answer, context_str, _ = get_rag_answer(query)
        print("\nAnswer:\n")
        print(answer)
        print()
