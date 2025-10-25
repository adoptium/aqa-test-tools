import os
from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()
GITHUB_TOKEN = os.getenv("GITHUB_TOKEN")

endpoint = "https://models.github.ai/inference"
default_model = "openai/text-embedding-3-large"

class Embedder:
    """
    Simple embedding helper that wraps the OpenAI client used in this project.
    Usage:
      e = Embedder()                     # uses env GITHUB_TOKEN, default endpoint/model
      embs = e.embed("single string")    # returns [[float,...]]
      embs = e.embed(["one","two"])      # returns [[...],[...]]
    """

    def __init__(self):
        self.api_key = GITHUB_TOKEN
        if not self.api_key:
            raise ValueError("API key required (pass api_key or set GITHUB_TOKEN in env)")
        self.base_url = endpoint
        self.model_name = default_model
        self.client = OpenAI(base_url=self.base_url, api_key=self.api_key)

    def embed(self, texts):
        """
        Embed a single string or a list/tuple of strings.
        Returns a list of embeddings (each embedding is a list of floats).
        """
        if isinstance(texts, str):
            inputs = [texts]
        elif isinstance(texts, (list, tuple)):
            inputs = list(texts)
        else:
            raise TypeError("texts must be a str or a list/tuple of str")

        resp = self.client.embeddings.create(input=inputs, model=self.model_name)
        return [item.embedding for item in resp.data]

    def embed_with_metadata(self, texts, metadata=None):
        """
        Embed texts and return a list of dicts: {text, embedding, metadata}
        metadata may be a single object or a list parallel to texts.
        """
        if isinstance(texts, str):
            inputs = [texts]
        else:
            inputs = list(texts)

        resp = self.client.embeddings.create(input=inputs, model=self.model_name)
        results = []
        for i, item in enumerate(resp.data):
            md = None
            if metadata is not None:
                if isinstance(metadata, (list, tuple)):
                    md = metadata[i] if i < len(metadata) else None
                else:
                    md = metadata
            results.append({"text": inputs[i], "embedding": item.embedding, "metadata": md})
        return results

# example quick-run when invoked directly
if __name__ == "__main__":
    embedder = Embedder()
    sample = ["first phrase", "second phrase", "third phrase"]
    embeddings = embedder.embed(sample)
    for index, vec in enumerate(embeddings):
        print(f"item[{index}]: length={len(vec)}")
