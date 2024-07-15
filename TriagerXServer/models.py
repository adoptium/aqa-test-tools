from pydantic import BaseModel

class RequestData(BaseModel):
    title: str = ""
    description: str = ""
    status: str = "open"
    assignees: list = []
    labels: list = []
    model: str = "chatgpt"
    action: str = "interact"
    userComment: str = ""
    previousComments: list = []