# Slack Chatbot

A Slack chatbot designed to interact with users, recommend developers for issues, and summarize issues. 

## Features

- Responds to Slack events such as `app_mention` and `url_verification`.
- Sends messages to specific channels based on component mappings.
- Recommends developers for github issues using the TriagerX model.
- Summarizes github issues using the llama3 model.
- Interacts with users and has the ability to fetch the conversation history.


## Installation

1. Clone the repository:
    ```bash
    git clone https://github.com/adoptium/aqa-test-tools.git
    cd TriagerXChatbot
    ```

2. Create and activate a virtual environment:
    ```bash
    python3 -m venv venv
    source venv/bin/activate
    ```

3. Install the dependencies:
    - `requests`: Used for making HTTP requests.
    - `os`: Provides a way of using operating system dependent functionality like reading environment variables.
    - `logging`: Used for logging messages to the console or a file.
    - `slack_bolt`: A framework for building Slack apps. It provides the `App` class to initialize the Slack app and handle events.
    - `slack_sdk.errors.SlackApiError`: Used for handling Slack API errors.
    - `slackstyler`: A library for styling Slack messages.
    - `slack_bolt.adapter.flask.SlackRequestHandler`: An adapter to handle Slack requests using Flask.
    - `flask`: A micro web framework for Python used to create the web server.
    - `flask.request`: Used to handle incoming HTTP requests in Flask.
    ```bash
    pip install -r requirements.txt
    ```
## Configuration

1. Create a `.env` file in the root directory and add your Slack bot token, signing secret, and other necessary environment variables:
    ```env
    SLACK_BOT_TOKEN=xoxb-your-slack-bot-token
    SIGNING_SECRET=your-signing-secret
    CHANNEL_BUILD=your-channel-id
    CHANNEL_GC=your-channel-id
    CHANNEL_JCLEXTENSIONS=your-channel-id
    CHANNEL_JVMTI=your-channel-id
    CHANNEL_TEST=your-channel-id
    CHANNEL_VM=your-channel-id
    GENERAL_CHANNEL=your-general-channel-id
    PAT_TOKEN=your-personal-access-token
    SERVER_URL=your-server-url
    ```

## Usage 

1. Run the Flask app:
    ```bash
    python main.py
    ```

2. The app will start on port 3000. You can interact with the bot by mentioning it in Slack or by sending POST requests to the `/send-message` endpoint.

## How to Use in Slack

To interact with the chatbot in your Slack channel, you will have three options for actions and four options for models. Note that the `recommend` action only works with the `triagerx` model. You can tag the bot and follow this format:

@your-bot-name <action> <model> <additional-parameters>

### Actions
- `summarize`
- `interact`
- `recommend` (only works with `triagerx`)

### Models
- `triagerx`
- `chatgpt`
- `gemini`
- `llama3`

### Examples

- To summarize using the `chatgpt` model:
    ```
    @your-bot-name /summarize -chatgpt "github issue link"
    ```

- To interact using the `llama3` model:
    ```
    @your-bot-name /interact -llama3 "What you would like to say"
    ```

- To recommend using the `triagerx` model:
    ```
    @your-bot-name /recommend -triagerx "github issue link"
    ```

The bot will process the request and respond in the channel accordingly.
## Project Structure

- `main.py`: The main entry point of the Slack chatbot application.
- `requirements.txt`: A file containing the list of dependencies required by the project.
- `.env`: Environment variables file (not included in the repository, to be created by the user).

## License
Distributed under the MIT License. See [LICENSE](LICENSE) for more information.

## Credits
- **Created by the Tigers-X team**: [Lujain Hasna](https://github.com/coolujain), [Bel Ami Gisage Warakoze](https://github.com/Belami02), [Fatima Al-Kharaz](https://github.com/ftm-2005), [George Chkhaidze](https://github.com/GioChkhaidze), and [Diyorbek Ibragimov](https://github.com/diyorbekibragimov).
- **Course Instructors**: Stephen Walli (Microsoft) and Prof. Eduardo Feo Flushing (CMUQ)
- **Course Mentors**: Lan Xia (IBM), Longyu Zhang (IBM), and Shelley Lambert (Red Hat)
- **TriagerX Model Creators**: Dr. Gias Udin (IBM) and Afif (University of Calgary).
