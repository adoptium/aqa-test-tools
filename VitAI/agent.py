"""VitAI agent that mirrors the TypeScript agentic workflow in Python."""

from __future__ import annotations

import json
import os
import time
import textwrap
from collections import deque
from dataclasses import dataclass, field
from typing import Any, Deque, Dict, List, Optional
from dotenv import load_dotenv

load_dotenv()

import requests

# Optional dependency: google-genai client
try:  # pragma: no cover - exercised only when dependency is available
    from google import genai  # type: ignore
    from google.genai.types import FunctionDeclaration, Schema, Tool, Type, GenerateContentConfig, ToolConfig, FunctionCallingConfig, FunctionCallingConfigMode  # type: ignore
except Exception:  # pragma: no cover - keeps import optional for environments without google-genai
    genai = None  # type: ignore
    FunctionDeclaration = None  # type: ignore
    Schema = None  # type: ignore
    Tool = None  # type: ignore
    Type = None  # type: ignore


REPOSITORIES = [
    {"owner": "adoptium", "repo": "aqa-tests", "description": "The central project for AQAvit (Adoptium Quality Assurance)."},
    {"owner": "adoptium", "repo": "TKG", "description": "A lightweight test harness for running a diverse set of tests or commands."},
    {"owner": "adoptium", "repo": "aqa-systemtest", "description": "System verification tests."},
    {"owner": "adoptium", "repo": "aqa-test-tools", "description": "Various test tools that improve workflow."},
    {"owner": "adoptium", "repo": "STF", "description": "System Test Framework for running system tests."},
    {"owner": "adoptium", "repo": "bumblebench", "description": "A microbenchmarking test framework."},
    {"owner": "adoptium", "repo": "run-aqa", "description": "A GitHub action for running AQA tests."},
    {"owner": "adoptium", "repo": "openj9-systemtest", "description": "System verification tests for OpenJ9."},
    {"owner": "eclipse-openj9", "repo": "openj9", "description": "The Eclipse OpenJ9 JVM project."},
]


@dataclass
class ThinkingStep:
    """Container for a single Thought → Action → Observation cycle."""

    thought: str
    action: Dict[str, Any]
    observation: str


@dataclass
class AgentTurn:
    """Represents one agent turn comprised of multiple thinking steps."""

    thinking_steps: List[ThinkingStep] = field(default_factory=list)
    final_answer: Optional[str] = None
    status: str = "thinking"
    error: Optional[str] = None


class VitAIReactAgent:
    """Python port of the VitAI TypeScript agent."""

    def __init__(
        self,
        *,
        max_iterations: int = 100,
        model: str = "gemini-2.5-flash",
        github_timeout: int = 30,
    ) -> None:
        if genai is None or any(obj is None for obj in (FunctionDeclaration, Schema, Tool, Type)):
            raise RuntimeError(
                "google-genai is required for VitAIReactAgent. Install the 'google-genai' package and set GEMINI_API_KEY."
            )

        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise RuntimeError("GEMINI_API_KEY environment variable is not set.")

        self.repositories = [f"{item['owner']}/{item['repo']}" for item in REPOSITORIES]
        self.max_iterations = max_iterations
        self.model = model
        self.github_timeout = github_timeout
        self.github_token = os.getenv("GITHUB_TOKEN")

        self._client = genai.Client(api_key=api_key)
        self._request_timestamps: Deque[float] = deque()
        self._last_turn: Optional[AgentTurn] = None

        self._tools = [
            Tool(
                function_declarations=[
                    FunctionDeclaration(
                        name="search_code",
                        description="Searches for code within a specific GitHub repository.",
                        parameters=Schema(
                            type=Type.OBJECT,
                            properties={
                                "repository": Schema(
                                    type=Type.STRING,
                                    description='The repository to search, formatted as "owner/repo".',
                                ),
                                "query": Schema(
                                    type=Type.STRING,
                                    description="The search query.",
                                ),
                            },
                            required=["repository", "query"],
                        ),
                    ),
                    FunctionDeclaration(
                        name="read_file",
                        description="Reads the content of a specific file from a GitHub repository.",
                        parameters=Schema(
                            type=Type.OBJECT,
                            properties={
                                "repository": Schema(
                                    type=Type.STRING,
                                    description='The repository the file belongs to, formatted as "owner/repo".',
                                ),
                                "path": Schema(
                                    type=Type.STRING,
                                    description="The full path to the file within the repository.",
                                ),
                            },
                            required=["repository", "path"],
                        ),
                    ),
                    FunctionDeclaration(
                        name="list_directory_contents",
                        description="Lists the contents (files and directories) of a specific directory within a GitHub repository.",
                        parameters=Schema(
                            type=Type.OBJECT,
                            properties={
                                "repository": Schema(
                                    type=Type.STRING,
                                    description='The repository to inspect, formatted as "owner/repo".',
                                ),
                                "path": Schema(
                                    type=Type.STRING,
                                    description='The path to the directory to list. Use "." or "/" for the root directory.',
                                ),
                            },
                            required=["repository", "path"],
                        ),
                    ),
                    FunctionDeclaration(
                        name="finish_answer",
                        description="Call this function when you have enough information to answer the user's question.",
                        parameters=Schema(
                            type=Type.OBJECT,
                            properties={
                                "answer": Schema(
                                    type=Type.STRING,
                                    description="The final, comprehensive answer to the user's question in Markdown format.",
                                )
                            },
                            required=["answer"],
                        ),
                    ),
                ]
            )
        ]

    @property
    def last_turn(self) -> Optional[AgentTurn]:
        """Expose the last agent turn for inspection/debugging."""

        return self._last_turn

    def query(self, question: str) -> str:
        """Execute the ReAct loop and return the final answer or error."""

        if not question.strip():
            raise ValueError("Question must not be empty.")

        repos = self.repositories
        if not repos:
            raise ValueError("At least one repository must be configured.")

        agent_turn = AgentTurn(status="thinking")
        self._last_turn = agent_turn

        history: List[str] = []
        iteration = 0

        while iteration < self.max_iterations:
            iteration += 1
            self._respect_rate_limit()

            prompt = self._build_prompt(question, history, repos)
            thought, function_call = self._call_model(prompt)

            if not function_call:
                agent_turn.status = "error"
                agent_turn.error = f"The agent got stuck. Last thought: {thought or '(none)'}"
                return agent_turn.error

            history.append(f"Thought: {thought}")

            tool_name = function_call.name
            args = self._normalize_args(function_call.args)

            history.append(
                f"Action: Calling tool {tool_name} with arguments {json.dumps(args, ensure_ascii=False)}"
            )

            if tool_name == "finish_answer":
                answer = args.get("answer", "")
                agent_turn.final_answer = answer
                agent_turn.status = "done"
                return answer

            observation = self._execute_tool(tool_name, args)
            history.append(observation)

            agent_turn.thinking_steps.append(
                ThinkingStep(thought=thought or "", action={"tool": tool_name, "args": args}, observation=observation)
            )

        agent_turn.status = "error"
        agent_turn.error = "The agent reached the maximum number of iterations without finding an answer."
        return agent_turn.error

    def _respect_rate_limit(self) -> None:
        """Honor the 10 requests/minute rate limit used in the TypeScript version."""

        now = time.time() * 1000.0
        one_minute_ago = now - 60_000

        while self._request_timestamps and self._request_timestamps[0] <= one_minute_ago:
            self._request_timestamps.popleft()

        if len(self._request_timestamps) >= 10:
            oldest = self._request_timestamps[0]
            wait_ms = oldest - one_minute_ago
            if wait_ms > 0:
                time.sleep(wait_ms / 1000.0)

        self._request_timestamps.append(time.time() * 1000.0)

    def _build_prompt(self, question: str, history: List[str], repositories: List[str]) -> str:
        repo_list_for_prompt = "\n".join(
            f"- {repo}: {self._repo_description(repo)}" for repo in repositories
        )
        context = "\n\n".join(history)

        prompt = textwrap.dedent(
            f"""You are VitAI, an expert AI developer assistant. Your goal is to answer the user's question by navigating and understanding code in a specific set of GitHub repositories.

**Core Mission:** Autonomously use the tools at your disposal to gather information and formulate a complete, accurate answer to the user's question.

**Operational Cycle (ReAct Pattern):**
You operate in a loop of Thought, Action, and Observation.
1.  **Thought:** Analyze the user's question and the conversation history. Formulate a plan. This might involve exploring the file system with `list_directory_contents`, searching with `search_code`, or reading a specific file with `read_file`. Your thought process should be clear and justify your next action.
2.  **Action:** Based on your thought, you MUST call exactly one of the available tools.
3.  **Observation:** After you take an action, the system will provide an observation, which is the result of that action. Use this new information to inform your next Thought.

**Critical Rules for Tool Calling:**
- You MUST always provide a "Thought" before calling a tool.
- You MUST call exactly one tool per turn.
- To explore the repository, use `list_directory_contents` to avoid guessing file paths.
- To complete your mission and provide the final answer to the user, you MUST call the 'finish_answer' tool. This is the only way to end the process.
- If you are not sure about file content or codebase structure, use your tools to read files and gather the relevant information: do NOT guess or make up an answer.

**Available Repositories:**
This is the exclusive list of repositories you can interact with.
{repo_list_for_prompt}

---

# Tool Reference

## functions.search_code
- **Description:** Performs a lexical (keyword-based) search for code within a single specified repository.
- **When to Use:**
    - To get a broad overview of where a term or feature is mentioned.
    - To find file paths that seem relevant to the user's query when you don't know where to start exploring.
- **Parameters:**
    - `repository`: string - The repository to search, formatted as "owner/repo". MUST be one of the available repositories.
    - `query`: string - The keywords to search for. Be specific for better results.
- **Example:**
    - **Thought:** The user is asking about system tests. I should start by searching for "system test" in the 'adoptium/aqa-systemtest' repository to find relevant entry points.
    - **Action:** `search_code({{ repository: 'adoptium/aqa-systemtest', query: 'system test execution' }})`

## functions.read_file
- **Description:** Reads the content of a single, specific file from a repository.
- **When to Use:**
    - After using `search_code` or `list_directory_contents` and identifying a promising file path.
    - To understand the implementation details within a specific file.
- **Parameters:**
    - `repository`: string - The repository the file belongs to, formatted as "owner/repo".
    - `path`: string - The full path to the file within the repository (e.g., 'STF/scripts/runSystemTests.sh').
- **Example:**
    - **Thought:** The search results showed that 'STF/scripts/runSystemTests.sh' is highly relevant. I need to read this file to understand how the tests are actually run.
    - **Action:** `read_file({{ repository: 'adoptium/aqa-systemtest', path: 'STF/scripts/runSystemTests.sh' }})`

## functions.list_directory_contents
- **Description:** Lists the contents (files and directories) of a single directory from a repository.
- **When to Use:**
    - To explore the file structure of a repository when you are unsure where to look.
    - To find the names of files in a directory before attempting to read one. This helps avoid errors from trying to read a file that does not exist.
    - ALWAYS prefer using this to explore before using `read_file` on a path you haven't seen before.
- **Parameters:**
    - `repository`: string - The repository the directory belongs to, formatted as "owner/repo".
    - `path`: string - The path to the directory to list (e.g., 'STF/scripts' or '.').
- **Example:**
    - **Thought:** I need to find the main test execution script, but I'm not sure where it is. I'll start by listing the contents of the 'STF' directory which seems like a good place to start.
    - **Action:** `list_directory_contents({{ repository: 'adoptium/aqa-systemtest', path: 'STF' }})`

## functions.finish_answer
- **Description:** Concludes the mission and provides the final, comprehensive answer to the user.
- **When to Use:**
    - When you are confident you have gathered all necessary information from searching and reading files.
    - This is the FINAL step. Do not use any other tools after this.
- **Parameters:**
    - `answer`: string - The final answer in well-formatted Markdown. The answer should be detailed, accurate, and directly address the user's original question.
- **Example:**
    - **Thought:** I have read the main script for running tests and examined the configuration files. I now have a complete understanding of the process. I can formulate the final answer.
    - **Action:** `finish_answer({{ answer: 'To run system tests in aqa-systemtest, you need to execute the `runSystemTests.sh` script located in the `STF/scripts` directory. Here are the steps:\n\n1. **Prerequisite**: ...\n2. **Execution**: ...\n\nHere is a relevant code snippet from the script:\n\n```bash\n# ... code snippet ...\n```' }})`

---

**User Question:** "{question}"

**History:**
{context}

Based on the user question and the history, what is your next Thought and Action?"""
        )

        return prompt

    def _repo_description(self, repo: str) -> str:
        for entry in REPOSITORIES:
            full_name = f"{entry['owner']}/{entry['repo']}"
            if full_name == repo:
                return entry["description"]
        return "(No description available.)"

    def _call_model(self, prompt: str) -> tuple[str, Any]:
        config = GenerateContentConfig(
            tools=self._tools,
            tool_config=ToolConfig(
                function_calling_config=FunctionCallingConfig(
                    mode=FunctionCallingConfigMode.AUTO,
                )
            ),
        )
        response = self._client.models.generate_content(
            model=self.model,
            contents=[{"role": "user", "parts": [{"text": prompt}]}],
            config=config,
        )

        thought_parts: List[str] = []
        function_call = None

        for candidate in getattr(response, "candidates", []) or []:
            content = getattr(candidate, "content", None)
            if not content:
                continue
            for part in getattr(content, "parts", []) or []:
                text = getattr(part, "text", None)
                if text:
                    thought_parts.append(text)
                call = getattr(part, "function_call", None)
                if call and not function_call:
                    function_call = call
            if function_call:
                break

        thought = "\n".join(t.strip() for t in thought_parts if t.strip())
        return thought, function_call

    def _normalize_args(self, args: Any) -> Dict[str, Any]:
        if args is None:
            return {}
        if hasattr(args, "items"):
            return {str(key): self._normalize_args(value) for key, value in args.items()}
        if isinstance(args, list):
            return {str(index): self._normalize_args(value) for index, value in enumerate(args)}
        return args

    def _execute_tool(self, tool_name: str, args: Dict[str, Any]) -> str:
        if tool_name == "search_code":
            return self._tool_search_code(args)
        if tool_name == "read_file":
            return self._tool_read_file(args)
        if tool_name == "list_directory_contents":
            return self._tool_list_directory(args)
        return f"Observation: Unknown tool \"{tool_name}\" was called."

    def _tool_search_code(self, args: Dict[str, Any]) -> str:
        if not self.github_token:
            return (
                "Observation: Your GITHUB_TOKEN is not configured. Please set it as an environment variable to use the GitHub search functionality."
            )

        repository = args.get("repository", "")
        query = args.get("query", "")
        owner_repo = repository.split("/")
        if len(owner_repo) != 2:
            return 'Observation: Invalid repository format. Please use "owner/repo".'

        url = "https://api.github.com/search/code"
        params = {"q": f"{query} repo:{repository}"}
        headers = self._github_headers("application/vnd.github.v3.text-match+json")

        try:
            response = requests.get(url, params=params, headers=headers, timeout=self.github_timeout)
        except Exception as exc:
            return (
                f"Observation: Error searching GitHub for query \"{query}\" in {repository}. Reason: {exc}"
            )

        if not response.ok:
            return (
                f"Observation: Error searching GitHub for query \"{query}\" in {repository}. Reason: {response.status_code} - {response.text}"
            )

        try:
            data = response.json()
        except ValueError:
            return (
                f"Observation: Error searching GitHub for query \"{query}\" in {repository}. Reason: Invalid JSON response."
            )

        items = (data.get("items") or [])[:5]
        if not items:
            return (
                f"Observation: No results found for query \"{query}\" in repository {repository}. Try a broader query or a different repository."
            )

        results = []
        for item in items:
            snippets = []
            for match in item.get("text_matches") or []:
                fragment = match.get("fragment")
                if fragment:
                    snippets.append(fragment.strip())
            results.append(
                {
                    "path": item.get("path"),
                    "score": item.get("score"),
                    "snippets": "\n...\n".join(snippets) if snippets else "No snippets available.",
                }
            )

        return (
            "Observation: Found {count} files. The most relevant files and code snippets are:\n{payload}".format(
                count=len(results), payload=json.dumps(results, indent=2, ensure_ascii=False)
            )
        )

    def _tool_read_file(self, args: Dict[str, Any]) -> str:
        if not self.github_token:
            return (
                "Observation: Your GITHUB_TOKEN is not configured. Please set it as an environment variable to use the GitHub search functionality."
            )

        repository = args.get("repository", "")
        path = args.get("path", "")
        owner_repo = repository.split("/")
        if len(owner_repo) != 2:
            return 'Observation: Invalid repository format. Please use "owner/repo".'

        url = f"https://api.github.com/repos/{owner_repo[0]}/{owner_repo[1]}/contents/{path}"
        headers = self._github_headers("application/vnd.github.v3.raw")

        try:
            response = requests.get(url, headers=headers, timeout=self.github_timeout)
        except Exception as exc:
            return (
                f"Observation: Error reading file \"{path}\" from repository {repository}. Reason: {exc}"
            )

        if not response.ok:
            return (
                f"Observation: Error reading file \"{path}\" from repository {repository}. Reason: {response.status_code} - {response.text}"
            )

        content = response.text
        truncated = content[:4000]
        return (
            f"Observation: Content of file \"{path}\" from repository {repository}:\n\n```\n{truncated}\n```"
        )

    def _tool_list_directory(self, args: Dict[str, Any]) -> str:
        if not self.github_token:
            return (
                "Observation: Your GITHUB_TOKEN is not configured. Please set it as an environment variable to use this functionality."
            )

        repository = args.get("repository", "")
        path = args.get("path", "")
        owner_repo = repository.split("/")
        if len(owner_repo) != 2:
            return 'Observation: Invalid repository format. Please use "owner/repo".'

        url = f"https://api.github.com/repos/{owner_repo[0]}/{owner_repo[1]}/contents/{path}"
        headers = self._github_headers("application/vnd.github.v3+json")

        try:
            response = requests.get(url, headers=headers, timeout=self.github_timeout)
        except Exception as exc:
            return (
                f"Observation: Error listing directory \"{path}\" from repository {repository}. Reason: {exc}"
            )

        if not response.ok:
            return (
                f"Observation: Error listing directory \"{path}\" from repository {repository}. Reason: {response.status_code} - {response.text}"
            )

        try:
            data = response.json()
        except ValueError:
            return (
                f"Observation: Error listing directory \"{path}\" from repository {repository}. Reason: Invalid JSON response."
            )

        if not isinstance(data, list):
            return (
                f"Observation: The path \"{path}\" in repository {repository} is a file, not a directory. Use read_file to see its content."
            )

        contents = []
        for item in data:
            entry_type = item.get("type")
            marker = "d" if entry_type == "dir" else "f"
            contents.append(f"[{marker}] {item.get('name')}")

        listing = "\n".join(contents)
        return f"Observation: Contents of \"{path}\" in repository {repository}:\n{listing}"

    def _github_headers(self, accept: str) -> Dict[str, str]:
        headers = {"Accept": accept, "User-Agent": "VitAI-Agent"}
        if self.github_token:
            headers["Authorization"] = f"Bearer {self.github_token}"
        return headers


def create_agent(
    *,
    max_iterations: int = 100,
) -> VitAIReactAgent:
    """Factory that mirrors the original helper used by the MCP entrypoint."""

    return VitAIReactAgent(max_iterations=max_iterations)
