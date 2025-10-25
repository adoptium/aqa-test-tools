import os
import json
from dotenv import load_dotenv
import sys
from azure.ai.inference import ChatCompletionsClient
from azure.ai.inference.models import SystemMessage, UserMessage
from azure.core.credentials import AzureKeyCredential
sys.path.append(os.path.join(os.path.dirname(__file__), "..", "src"))
from src import Embedder, get_rag_answer

load_dotenv()
GITHUB_TOKEN = os.getenv("GITHUB_TOKEN")

endpoint = "https://models.github.ai/inference"
model = "mistral-ai/Mistral-Large-2411"

client = ChatCompletionsClient(
    endpoint=endpoint,
    credential=AzureKeyCredential(GITHUB_TOKEN),
)

embedder = Embedder()

# adversarial LLM evaluation

def load_ideal_qas(path: str | None = None):
    base_dir = os.path.dirname(__file__)
    default_path = os.path.normpath(os.path.join(base_dir, "..", "data", "ideal_answers.json"))
    data_path = path or default_path
    try:
        with open(data_path, "r", encoding="utf-8") as f:
            items = json.load(f)
    except Exception:
        return []

    questions = [it.get("question", "") for it in items]
    try:
        q_embs = embedder.embed(questions)
    except Exception:
        q_embs = [[] for _ in questions]

    out = []
    for it, emb in zip(items, q_embs):
        out.append({
            "question": it.get("question", ""),
            "answer": it.get("answer", ""),
            "q_embedding": emb or [],
        })
    return out


def judge_answer(question: str, candidate_answer: str, ideal_answer: str, context: str, *, temperature: float = 0.0):
    system_msg = (
        "You are an adversarial evaluator. Be strict and skeptical. "
        "Given a user question, an ideal (ground-truth) answer, a candidate answer, and retrieved context, "
        "scrutinize the candidate for factual errors, omissions, contradictions, lack of alignment with the ideal answer, "
        "and ungrounded claims not supported by the context. Return a score out of 10 and jusfity the score by pointing out the mistakes/errors "
        "made in the candidate answer."
    )

    user_msg = (
        f"Question:\n{question}\n\n"
        f"IdealAnswer:\n{ideal_answer}\n\n"
        f"CandidateAnswer:\n{candidate_answer}\n\n"
        f"RetrievedContext:\n{context}\n\n"
        "Evaluation criteria:\n"
        "- Accuracy vs. ideal answer\n"
        "- Completeness (key steps/points present)\n"
        "- Faithfulness to retrieved context (no hallucinations)\n"
        "- Relevance (no off-topic content)\n"
        "Output: Score and justification"
    )

    try:
        resp = client.complete(
            model=model,
            messages=[
                SystemMessage(system_msg),
                UserMessage(user_msg),
            ],
            temperature=temperature,
        )
        content = resp.choices[0].message.content or "{}"
        return content
    except Exception as e:
        return {"error": f"Judge request failed: {e}"}


# batch test runner
if __name__ == "__main__":
    ideal_items = load_ideal_qas()
    if not ideal_items:
        print("No ideal Q/A found. Ensure data/ideal_answers.json exists and is valid.")
        raise SystemExit(1)

    for i, item in enumerate(ideal_items, start=1):
        q = item.get("question", "").strip()
        ideal = item.get("answer", "").strip()
        if not q:
            continue
        answer, context, _ = get_rag_answer(q)
        evaluation = judge_answer(q, answer, ideal, context)
        print("*" * 80)
        print("Question:", q)
        print("-" * 80)
        print("Ideal Answer:\n", ideal)
        print("-" * 80)
        print("RAG Answer:\n", answer)
        print("-" * 80)
        print(evaluation)