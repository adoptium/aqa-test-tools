import os
import time
import tiktoken
import threading
from collections import deque
from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()
GITHUB_TOKEN = os.getenv("GITHUB_TOKEN")

endpoint = "https://models.github.ai/inference"
default_model = "openai/text-embedding-3-large"

class RateLimiter:
    """
    Rate limiter for API requests with:
    - Requests per minute limit
    - Maximum concurrent requests
    - Token per request limit
    """
    def __init__(self, requests_per_minute=15, max_concurrent=5, max_tokens_per_request=64000):
        self.requests_per_minute = requests_per_minute
        self.max_concurrent = max_concurrent
        self.max_tokens_per_request = max_tokens_per_request
        
        self.request_times = deque()
        self.active_requests = 0
        self.lock = threading.Lock()
        self.encoder = tiktoken.get_encoding("cl100k_base")
    
    def estimate_tokens(self, text):
        """Count tokens using tiktoken with fallback"""
        try:
            return len(self.encoder.encode(text))
        except Exception:
            # Fallback to approximate count
            return len(text) // 4
    
    def wait_if_needed(self, texts):
        """Block until rate limits allow the request"""
        if isinstance(texts, str):
            texts = [texts]
        
        # Check token limit
        total_tokens = sum(self.estimate_tokens(t) for t in texts)
        if total_tokens > self.max_tokens_per_request:
            raise ValueError(f"Request exceeds token limit: {total_tokens} > {self.max_tokens_per_request}")
        
        while True:
            with self.lock:
                now = time.time()
                
                # Remove requests older than 1 minute
                while self.request_times and now - self.request_times[0] > 60:
                    self.request_times.popleft()
                
                # Check if we can proceed
                if (len(self.request_times) < self.requests_per_minute and 
                    self.active_requests < self.max_concurrent):
                    self.request_times.append(now)
                    self.active_requests += 1
                    return
            
            # Wait a bit before retrying
            time.sleep(0.1)
    
    def release(self):
        """Release a concurrent request slot"""
        with self.lock:
            self.active_requests = max(0, self.active_requests - 1)

class Embedder:
    """
    Simple embedding helper that wraps the OpenAI client used in this project.
    Usage:
      e = Embedder()                     # uses env GITHUB_TOKEN, default endpoint/model
      embs = e.embed("single string")    # returns [[float,...]]
      embs = e.embed(["one","two"])      # returns [[...],[...]]
    """

    def __init__(self, requests_per_minute=15, max_concurrent=5, max_tokens_per_request=64000):
        self.api_key = GITHUB_TOKEN
        if not self.api_key:
            raise ValueError("API key required (pass api_key or set GITHUB_TOKEN in env)")
        self.base_url = endpoint
        self.model_name = default_model
        self.client = OpenAI(base_url=self.base_url, api_key=self.api_key)
        self.rate_limiter = RateLimiter(
            requests_per_minute=requests_per_minute,
            max_concurrent=max_concurrent,
            max_tokens_per_request=max_tokens_per_request
        )

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

        # Wait for rate limit clearance
        self.rate_limiter.wait_if_needed(inputs)
        
        try:
            resp = self.client.embeddings.create(input=inputs, model=self.model_name)
            return [item.embedding for item in resp.data]
        finally:
            self.rate_limiter.release()

    def embed_with_metadata(self, texts, metadata=None):
        """
        Embed texts and return a list of dicts: {text, embedding, metadata}
        metadata may be a single object or a list parallel to texts.
        """
        if isinstance(texts, str):
            inputs = [texts]
        else:
            inputs = list(texts)

        # Wait for rate limit clearance
        self.rate_limiter.wait_if_needed(inputs)
        
        try:
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
        finally:
            self.rate_limiter.release()
