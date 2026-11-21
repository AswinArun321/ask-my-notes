
# live_config.py
# Shared Gemini Live settings and Ask My Notes tool

import os
import asyncio

from dotenv import load_dotenv
from google import genai
from google.genai import types

from tools import search_notes


# Load environment variables from backend/.env
load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

if not GEMINI_API_KEY:
    raise ValueError(
        "GEMINI_API_KEY is missing. Add it to backend/.env"
    )


# Gemini client - explicitly use v1beta
gemini = genai.Client(
    api_key=GEMINI_API_KEY,
    http_options=types.HttpOptions(
        api_version="v1beta"
    )
)


# Gemini Live API model
MODEL = os.getenv(
    "GEMINI_LIVE_MODEL",
    "gemini-3.8-live"
)


# Describe the search_notes tool to Gemini
search_notes_tool = {
    "name": "search_notes",
    "description": "Search the student's uploaded PDF notes for a topic.",
    "parameters": {
        "type": "OBJECT",
        "properties": {
            "query": {
                "type": "STRING",
                "description": "The topic or question to search in the notes."
            }
        },
        "required": ["query"]
    }
}


# Gemini Live API configuration
CONFIG = types.LiveConnectConfig(
    response_modalities=["AUDIO"],

    system_instruction=(
        "You are Study Buddy, a friendly voice tutor. "
        "Keep answers short and conversational. "
        "Use the search_notes tool for questions about the student's notes. "
        "Base answers on the retrieved notes. "
        "If the information is not found, say so clearly. "
        "Do not invent information."
    ),

    tools=[
        {
            "function_declarations": [
                search_notes_tool
            ]
        }
    ],

    input_audio_transcription=types.AudioTranscriptionConfig(),

    output_audio_transcription=types.AudioTranscriptionConfig(),
)


# Execute Gemini's search_notes function call
async def answer_tool_call(session, tool_call):
    replies = []

    for fc in tool_call.function_calls:
        print(f"\nTool call: {fc.name}({fc.args})")

        if fc.name == "search_notes":
            try:
                result = await asyncio.to_thread(
                    search_notes,
                    fc.args.get("query", "")
                )
            except Exception as error:
                result = f"Search failed: {error}"
        else:
            result = "Unknown tool"

        replies.append(
            types.FunctionResponse(
                id=fc.id,
                name=fc.name,
                response={"result": str(result)}
            )
        )

    await session.send_tool_response(
        function_responses=replies
    )
