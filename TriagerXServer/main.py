from fastapi import FastAPI, HTTPException, Body
from openai import OpenAI
from huggingface_hub import InferenceClient
import google.generativeai as genai
from typing import Dict
from models import RequestData
import json
import requests
import uvicorn
import os

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
HUGGING_FACE_TOKEN = os.getenv("HUGGING_FACE_TOKEN")

app = FastAPI()

# Configuring models with their corresponding API keys
OpenAI_client = OpenAI(api_key=OPENAI_API_KEY)

genai.configure(api_key=GEMINI_API_KEY)
def generate_gemini_config(max_output_tokens):
    return {
        'temperature': 1,
        'top_p': 0.95,
        'top_k': 64,
        'max_output_tokens': max_output_tokens,
        'response_mime_type': "text/plain"
    }

Gemini_client = genai.GenerativeModel(model_name='gemini-1.5-flash', 
                                    generation_config=generate_gemini_config(512))

Llama_client = InferenceClient(
    "meta-llama/Meta-Llama-3-8B-Instruct",
    token=HUGGING_FACE_TOKEN,
)

responseRequiredFields = ['model', 'action', 'userComment', 'issueData', 'commentsData']
issueDataRequiredFields = ['title', 'body', 'state', 'labels', 'assignees']

def formatComments(comments, modelName):
    formattedComments = []

    #TODO check for errors

    if len(comments) == 0:
        return []

    slack = False
    for comment in comments:
        if 'url' in comment and comment['url'].startswith('https://api.github.com'):
            # It's github
            login = comment['user']['login']
            if login == 'github-actions[bot]':
                role = "assistant" if modelName == "chatgpt" or modelName == "llama3" else "model"
            else:
                role = "user"
        else:
            # It's slack
            slack = True
            if "bot_id" in comment:
                role = "assistant" if modelName == "chatgpt" or modelName == "llama3" else "model"
            else:
                role = "user"
                
        if modelName == "gemini":
            formattedComment = {
                "role": role,
                "parts": [
                    comment['text'].strip() if slack else comment['body'].strip()
                ],
            }
        elif modelName == 'chatgpt': 
            formattedComment = {
                "role": role,
                "content": [
                    {
                        "type": "text",
                        "text": comment['text'].strip() if slack else comment['body'].strip()
                    }
                ]
            }
        elif modelName == 'llama3':
            formattedComment = {
                "role": role,
                "content": comment['text'].strip() if slack else comment['body'].strip()
            }

        formattedComments.append(formattedComment)

    return formattedComments

def filterIssue(response):
    if response is None:
        raise HTTPException(status_code=400, detail='Invalid input: response is None')

    for requiredField in responseRequiredFields:
        if requiredField not in response:
            raise HTTPException(status_code=400, 
                                detail=f'Invalid input: {requiredField} is not provided') 
    
    for requiredField in responseRequiredFields[:3]:
        if not isinstance(response[requiredField], str):
            response[requiredField] = ''

    issueData = response.get('issueData')
    commentsData = response.get('commentsData')

    if issueData is None or commentsData is None:
        raise HTTPException(status_code=400, 
                            detail='Invalid issue data: issueData or commentsData is None')

    for requiredField in issueDataRequiredFields:
        if requiredField not in issueData:
            raise HTTPException(status_code=400, 
                                detail=f'Invalid input: {requiredField} is not provided')
    
    for requiredField in issueDataRequiredFields[:3]:
        if not isinstance(issueData[requiredField], str):
            issueData[requiredField] = ''

    input = RequestData(
        title=issueData.get('title'),
        description = issueData.get('body'),
        status = issueData.get('state'),
        model = response.get('model'),
        action = response.get('action'),
        userComment = response.get('userComment'),
        labels = [label['name'] for label in issueData.get('labels', [])],
        assignees = [assignee['login'] for assignee in issueData.get('assignees', [])],
        previousComments = formatComments(commentsData, response['model']),
    )

    return input

@app.post('/process')
def process_request(input: Dict = Body(...)):
    input = filterIssue(input)

    if input.action not in ['summarize', 'interact', 'recommend']:
        raise HTTPException(status_code=400, detail='Invalid action')
    if input.model not in ['gemini', 'chatgpt', 'llama3', 'triagerx']:
        raise HTTPException(status_code=400, detail='Invalid model')
    if input.status not in ['open', 'closed']:
        raise HTTPException(status_code=400, detail='Invalid status')

    if input.action == 'summarize':
        return summarize(input.title, 
                        input.description,
                        input.model)
    elif input.action == 'interact':
        return interact(input.title,
                        input.description, 
                        input.model, 
                        input.previousComments,
                        input.userComment)
    elif input.action == 'recommend':
        return recommend(input.title,
                        input.description,
                        input.model)
    
def generate_summarize_prompt(title: str, description: str):
    summarize_prompt = """As a highly proficient debugger for the OpenJ9 project, your goal is to summarize the provided error message. Please include the following in your summary:
    - A clear explanation of the error
    - Potential root causes
    - Specific areas of the code that might be affected
    - Recommended steps for debugging and resolving the issue
    - Any additional insights that could help the development team understand and address the problem efficiently
    

    Please, keep it short.

    ### Issue Title:
    {}

    ### Issue Description:
    {}
        
    """.format(title, description)
    return summarize_prompt

def summarize(title: str, description: str, model: str):
    if model == "chatgpt":
        prompt = generate_summarize_prompt(title, description)

        if len(prompt) > 14000:
            prompt = prompt[:14000]
    
        response = OpenAI_client.completions.create(
            model="gpt-3.5-turbo-instruct",
            prompt=prompt,
            temperature=1,
            max_tokens=512,
            top_p=1,
            frequency_penalty=0,
            presence_penalty=0
        )
        return {"response": response.choices[0].text}    
    elif model == "gemini":
        return {"response": Gemini_client.generate_content(generate_summarize_prompt(title, description)).text}
    elif model == "llama3":
        prompt = generate_summarize_prompt(title, description)

        if len(prompt) > 29900:
            prompt = prompt[:29900]
        
        response = Llama_client.chat_completion(
            messages=[{"role": "user", "content": prompt}],
            max_tokens=512,
            stream=False,
        )
        return {"response": response.choices[0].message.content}

def recommend(title: str, description: str, model: str):
    if model != "triagerx":
        raise HTTPException(status_code=400, detail='Invalid model for recommend')

    input = {
        "issue_title": title,
        "issue_description": description
    }
    response = requests.post(
        'http://140.211.168.122/recommendation',
        data=json.dumps(input),
        headers={
            'accept': 'application/json',
            'Content-Type': 'application/json',
        }
    )
    response_data = response.json()
    recommended_components = response_data.get('recommended_components', [])
    recommended_developers = response_data.get('recommended_developers', [])
    result_string = f"Recommended Components: {', '.join(recommended_components)}\nRecommended Developers: {', '.join(recommended_developers)}\n"
    return {"response": result_string}

def generate_interact_prompt(title: str, description: str) -> str:
    prompt = """You are an expert debugger specializing in the OpenJ9 open-source project. 
    Your task is to respond professionally and accurately to a comment on a GitHub issue, even if the comment includes unrelated questions. 
    The response should be based on the issue title and description.
    
    Here is the information you may need:

    ### Issue Title:
    {}

    ### Issue Description:
    {}

    Consider the following guidelines while crafting your response:
    1. Understand the context provided by the issue title and description.
    2. Address the specific concerns or questions raised in the user's comment.
    3. Provide a clear and concise response, including any necessary technical details.
    4. Offer actionable suggestions or solutions if applicable.
    5. Maintain a professional and courteous tone throughout the response.
    6. Please keep it brief and to the point.
    7. Feel free to answer any unrelated questions posed by the user.
    """.format(title, description)
    return prompt

def interact(title: str, description: str, model: str, previousComments: list, userComment: str):
    if model == "chatgpt":
        response = OpenAI_client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {
                    "role": "system",
                    "content": generate_interact_prompt(title, description)
                }, 
                *previousComments,
                {
                    "role": "user",
                    "content": userComment
                }
            ],
            temperature=1,
            top_p=1,
            frequency_penalty=0,
            presence_penalty=0
        )
        return {"response": response.choices[0].message.content}

    elif model == "gemini":
        response = Gemini_client.generate_content([
            {
                "role": "user",
                "parts": [generate_interact_prompt(title, description)]
            },
            *previousComments,
            {
                "role": "user",
                "parts": [userComment]
            }
        ])
        return {"response": response.text}

    elif model == "llama3":
        response = Llama_client.chat_completion(
            messages=[
                {
                    "role": "system",
                    "content": generate_interact_prompt(title, description)
                }, 
                *previousComments,
                {
                    "role": "user",
                    "content": userComment
                }
            ],
        )
        
        return {"response": response.choices[0].message.content}
    
if __name__ == '__main__':
    uvicorn.run('main:app', host='0.0.0.0', port=3000)
