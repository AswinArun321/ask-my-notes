
"""
agent_langchain.py

Study Buddy AI Agent
Built using LangChain, LangGraph and Groq.

Features:
1. Search uploaded PDF notes.
2. Perform mathematical calculations.
3. Retrieve today's date.
4. Save study tasks.
5. Automatically select and execute tools.
6. Return answers with tool execution details.
"""

import os
from pathlib import Path

from dotenv import load_dotenv
from groq import APIConnectionError, APITimeoutError, RateLimitError
from langchain.agents import create_agent
from langchain_groq import ChatGroq

from tools import (
    SYSTEM_PROMPT,
    search_notes,
    calculate,
    today,
    add_task
)


# ==================================================
# STEP 11: LOAD ENVIRONMENT VARIABLES
# ==================================================

BASE_DIR = Path(__file__).resolve().parent

load_dotenv(BASE_DIR / ".env")

GROQ_API_KEY = os.getenv("GROQ_API_KEY")

if not GROQ_API_KEY:
    raise ValueError(
        "GROQ_API_KEY not found!\n"
        "Please add your Groq API key to backend/.env"
    )


# ==================================================
# STEP 12: INITIALIZE GROQ MODEL
# ==================================================

MODEL = "openai/gpt-oss-120b"

llm = ChatGroq(
    model=MODEL,
    temperature=0,
    timeout=60,
    max_retries=2,
    max_tokens=512
)


# ==================================================
# STEP 13: REGISTER AGENT TOOLS
# ==================================================

TOOLS = [
    search_notes,
    calculate,
    today,
    add_task
]


# ==================================================
# CREATE LANGCHAIN AGENT
# ==================================================

agent = create_agent(
    model=llm,
    tools=TOOLS,
    system_prompt=SYSTEM_PROMPT
)


# ==================================================
# ASK THE AGENT
# ==================================================

def ask_agent(question: str):
    """
    Send a question to the Study Buddy agent.

    The agent automatically decides whether to use
    any of the available tools.

    Returns:
        answer: Final response from the agent.
        steps: Names of tools used by the agent.
    """

    if not question or not question.strip():
        return "Please enter a question.", []

    try:

        # Send question to the agent
        result = agent.invoke(
            {
                "messages": [
                    {
                        "role": "user",
                        "content": question.strip()
                    }
                ]
            }
        )

        # Retrieve all conversation messages
        messages = result.get("messages", [])

        # ------------------------------------------
        # COLLECT TOOL NAMES
        # ------------------------------------------

        steps = []

        for message in messages:

            tool_calls = getattr(
                message,
                "tool_calls",
                []
            ) or []

            for call in tool_calls:

                name = call.get("name")

                if name:
                    steps.append(name)

        # ------------------------------------------
        # GET FINAL ANSWER
        # ------------------------------------------

        answer = None

        for message in reversed(messages):

            # Look for the final AI response
            if (
                getattr(message, "type", None) == "ai"
                and not getattr(message, "tool_calls", [])
                and message.content
            ):

                answer = message.content
                break

        if answer is None:
            answer = "I couldn't generate a final answer."

        # Handle text-block responses
        if isinstance(answer, list):

            text_parts = []

            for part in answer:

                if isinstance(part, dict):
                    if part.get("type") == "text":
                        text_parts.append(part.get("text", ""))
                else:
                    text_parts.append(str(part))

            answer = "\n".join(text_parts)

        return answer, steps

    except RateLimitError as e:

        print(f"\n[Groq Rate Limit] {e}")

        return (
            "Groq API rate limit reached. "
            "Please wait and try again."
        ), []

    except APITimeoutError as e:

        print(f"\n[Groq Timeout] {e}")

        return (
            "The Groq API request timed out. "
            "Please check your connection and try again."
        ), []

    except APIConnectionError as e:

        print(f"\n[Connection Error] {e}")

        return (
            "Unable to connect to Groq. "
            "Please check your internet connection."
        ), []

    except Exception as e:

        print(f"\n[Agent Error] {type(e).__name__}: {e}")

        return (
            "Sorry, something went wrong while "
            "processing your question."
        ), []


# ==================================================
# RUN THE AGENT
# ==================================================

def main():

    print("=" * 55)
    print("          STUDY BUDDY - LANGCHAIN AGENT")
    print("=" * 55)

    print("\nModel:", MODEL)
    print("Framework: LangChain + LangGraph")
    print("LLM Provider: Groq")

    print("\nAvailable tools:")

    for tool in TOOLS:
        print(" -", tool.__name__)

    print("\nAgent is ready!")
    print("Type 'quit' or 'exit' to stop.")

    # ----------------------------------------------
    # INTERACTIVE CHAT LOOP
    # ----------------------------------------------

    while True:

        try:

            question = input("\nYou: ").strip()

            if question.lower() in ("quit", "exit"):

                print("\nStudy Buddy: Goodbye! Happy studying.")
                break

            if not question:
                continue

            # Ask the agent
            answer, steps = ask_agent(question)

            # Display tools used
            print("\nTools used:")

            if steps:

                for step in steps:
                    print("  [TOOL]", step)

            else:
                print("  None")

            # Display final response
            print("\nAgent:", answer)

        except KeyboardInterrupt:

            print("\n\nStudy Buddy: Session interrupted.")
            break

        except EOFError:

            print("\nStudy Buddy: Goodbye!")
            break


# ==================================================
# APPLICATION ENTRY POINT
# ==================================================

if __name__ == "__main__":
    main()
