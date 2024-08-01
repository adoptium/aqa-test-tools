import requests
import os, logging
from slack_bolt import App, request
from slack_sdk.errors import SlackApiError
from slackstyler import SlackStyler
from slack_bolt.adapter.flask import SlackRequestHandler
from flask import Flask, jsonify
from flask import request as flask_request

CHANNEL_BUILD = os.getenv("CHANNEL_BUILD")
CHANNEL_GC = os.getenv("CHANNEL_GC")
CHANNEL_JCLEXTENSIONS = os.getenv("CHANNEL_JCLEXTENSIONS")
CHANNEL_JVMTI = os.getenv("CHANNEL_JVMTI")
CHANNEL_TEST = os.getenv("CHANNEL_TEST")
CHANNEL_VM = os.getenv("CHANNEL_VM")
GENERAL_CHANNEL = os.getenv("GENERAL_CHANNEL")

PAT_TOKEN = os.getenv("PAT_TOKEN")
SLACK_APP_TOKEN = os.getenv("SLACK_APP_TOKEN")
SLACK_BOT_TOKEN = os.getenv("SLACK_BOT_TOKEN")
SIGNiNG_SECRET = os.getenv("SIGNING_SECRET")

SERVER_URL = os.getenv("SERVER_URL")

logging.basicConfig(level=logging.DEBUG)

# Initialize your app with your bot token and signing secret
app = App(
    token=SLACK_BOT_TOKEN,
    signing_secret=SIGNING_SECRET
)
styler = SlackStyler()

@app.event("url_verification")
def handle_challenge(request: request):
    json_body = request.body
    challenge = json_body.get("challenge")
    return {
        "statusCode": 200,
        "body": {
            "challenge": challenge
    }
}

def fetch_conversation_history(client, channel_id: str = GENERAL_CHANNEL, messages: int = 20):
    try:
        conversation_history = []
        result = client.conversations_history(channel=channel_id, limit=messages)
        conversation_history = result["messages"]
        
        while len(conversation_history) < messages and result.get("has_more"):
            result = client.conversations_history(channel=channel_id, 
                                                limit=messages - len(conversation_history), 
                                                cursor=result["response_metadata"]["next_cursor"])
            conversation_history.extend(result["messages"])
        
        return conversation_history
    except SlackApiError as e:
        logging.error("Error fetching conversation history: {}".format(e))
        return []

@app.event("app_mention")
def event_test(client, event, say):
    text = event['text']
    
    logging.debug("App mention event received")

    actions = ['summarize', 'interact', 'recommend']
    models = ['triagerx','chatgpt', 'gemini', 'llama3']
    model = None
    action = None

    for keyword in actions:
        if not action and f'/{keyword}' in text:
            text = text.replace(f'/{keyword}', '').strip()
            action = keyword

    for keyword in models:
        if not model and f'-{keyword}' in text:
            text = text.replace(f'-{keyword}', '').strip()
            model = keyword

    if None in [action, model]:
        print("Action or model is missing.")
        return
    
    issueData = {
        "title": "",
        "state": "open",
        "body": "",
        "labels": [],
        "assignees": []
    }

    if action in ['summarize', 'recommend']:
        issueURL = text
        issueData = getIssueData(issueURL)

    inputData = {
        "issueData": issueData,
        "commentsData": [],
        "model": model,
        "action": action,
        "userComment": text
    }

    if action == "interact":
        history = fetch_conversation_history(client)
        inputData["commentsData"] = history

    ####SEND inputData to our server####
    headers = {
        'Content-Type': 'application/json'
    }
    
    serverURL = SERVER_URL
    response = requests.post(serverURL, json=inputData, headers=headers)
    message = response.json()['response']
    try:
        response = client.chat_postMessage(channel=GENERAL_CHANNEL, blocks=[
            {
                "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": styler.convert(message)
                    }
            }
        ])
    except SlackApiError as e:
        print(f"Error posting message: {e}")
    
def getIssueData(issue_url):
    issue_number = issue_url.split('/').pop()
    owner = issue_url.split('/')[3]
    repo = issue_url.split('/')[4]
    # GitHub API URL for the issue
    url = f'https://api.github.com/repos/{owner}/{repo}/issues/{issue_number}'

    headers = {
        'Authorization': f'token {PAT_TOKEN}',
        'Accept': 'application/vnd.github.v3+json'
    }
    # Send the request
    response = requests.get(url, headers=headers)

    # Check if the request was successful
    if response.status_code == 200:
        issue_data = response.json()
        return issue_data
    else:
        print(f'Failed to fetch issue data: {response.status_code}')

flask_app = Flask(__name__)
handler = SlackRequestHandler(app)

@flask_app.route("/slack/events", methods=["POST"])
def slack_events():
    return handler.handle(flask_request)

components_channel_mapping = {
    "comp:build": CHANNEL_BUILD,
    "comp:gc": CHANNEL_GC,
    "comp:jclextensions": CHANNEL_JCLEXTENSIONS,
    "comp:jvmti": CHANNEL_JVMTI,
    "comp:test": CHANNEL_TEST,
    "comp:vm": CHANNEL_VM,
}

@app.route('/send-message', methods=['POST'])
def send_message():
    data = flask_request.json
    component = data.get('component')
    channel_id = components_channel_mapping.get(component)
    message = data.get('message')

    try:
        response = app.client.chat_postMessage(channel=channel_id, text=message)
        return jsonify({'success': True, 'detail': 'Message sent successfully'}), 200
    except SlackApiError as e:
        # You can add more error handling here based on SlackApiError
        return jsonify({'success': False, 'detail': str(e.response['error'])}), 400

if __name__ == "__main__":
    flask_app.run(port=3000)
