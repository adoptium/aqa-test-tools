# ChatGPT-Gemini Server

This API provides a set of functionalities to process GitHub issue data using various AI models including OpenAI's ChatGPT, Gemini, and Meta's LLaMA-3. It can summarize issues, interact with user comments, and recommend actions based on the issue's content. This project is designed to assist developers and project managers in managing GitHub issues more efficiently by leveraging the power of AI.

## Goal
It is created as a part of the summer course "Applied Software Engineering in the Real World" taught by Stephen Walli, a principal program manager of the CTO Office at Azure, and Prof. Eduardo Feo Flushing, a Computer Science Professor at Carnegie Mellon University in Qatar.

It is both a pleasure and honor to be mentored by three of the active Adoptium team members: Lan Xia, Longyu Zhang, and Shelley Lambert. We thank them for their guidance, patience, and belief in our work. 

## Features
- Summarize Issues: Generate concise summaries of GitHub issues to quickly understand the problem.
- Interact with Comments: Automatically generate responses to user comments on issues.
- Recommend Actions: Suggest potential actions or developers to assign based on the issue content.

## Prerequisites
Before you begin, ensure you have met the following requirements:
- Python 3.8 or higher
- FastAPI
- Uvicorn (for running the API server)
- OpenAI API key (for ChatGPT)
- Gemini API key (for Gemini model)
- Hugging Face API token (for LLaMA-3 model)

## Installation & Setup
1. **Clone the repository**
```bash
git clone https://github.com/adoptium/aqa-test-tools.git
```
2. **Navigate to the project directory**
```bash
cd TriagerXServer
```
3. **Install dependencies**
```bash
pip install -r requirements.txt
```
4. **Set up environment variables** 

Create a .env file in the root directory and add your API keys and tokens:
```bash
OPENAI_API_KEY=your_openai_api_key
GEMINI_API_KEY=your_gemini_api_key
HUGGING_FACE_TOKEN=your_hugging_face_token
```
5. Run the API server
```bash
uvicorn main:app --reload
```

## Usage

The API provides a /process endpoint that accepts POST requests with issue data in JSON format. Here's an example of how to use it with curl:
```bash
curl -X 'POST' \
    'http://127.0.0.1:8000/process' \
    -H 'accept: application/json' \
    -H 'Content-Type: application/json' \
    -d '{
    "model": "gemini",
    "action": "summarize",
    "userComment": "",
    "issueData": {
        "title": "Issue Title Here",
        "body": "Issue Description Here",
        "state": "open",
        "labels": [{"name": "bug"}],
        "assignees": [{"login": "user1"}]
    },
    "commentsData": []
}'
```

## License
Distributed under the Apache License Version 2.0. See [LICENSE](../LICENSE) for more information.

## Credits
- **Created by the Tigers-X team**: [Lujain Hasna](https://github.com/coolujain), [Bel Ami Gisage Warakoze](https://github.com/Belami02), [Fatima Al-Kharaz](https://github.com/ftm-2005), [George Chkhaidze](https://github.com/GioChkhaidze), and [Diyorbek Ibragimov](https://github.com/diyorbekibragimov).
- **Course Instructors**: Stephen Walli (Microsoft) and Prof. Eduardo Feo Flushing (CMUQ)
- **Course Mentors**: Lan Xia (IBM), Longyu Zhang (IBM), and Shelley Lambert (Red Hat)
- **TriagerX Model Creators**: Dr. Gias Udin (IBM) and Afif (University of Calgary).
