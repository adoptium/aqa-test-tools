import os
import sys
from github import Github

try:
    with open("comment.md", "r", encoding="utf-8") as f:
        comment_body = f.read()

    token = os.environ["GITHUB_TOKEN"]
    repo_name = os.environ["GITHUB_REPOSITORY"]
    issue_number = int(os.environ["ISSUE_NUMBER"])

    g = Github(token)
    repo = g.get_repo(repo_name)
    issue = repo.get_issue(number=issue_number)

    comment = issue.create_comment(comment_body)
    print(f"✅ Comment created: {comment.html_url}")

except Exception as e:
    print(f"❌ Error creating comment: {e}")
    sys.exit(1)
