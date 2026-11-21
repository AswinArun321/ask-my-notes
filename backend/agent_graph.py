
"""
agent_graph.py

Study Buddy AI Agent using LangGraph.

Workflow:
START -> THINK -> TOOL CHECK
                  |
             Tool required?
              /       \
            YES        NO
             |          |
           TOOLS       END
             |
          THINK again
"""

import os
from pathlib import Path

from dotenv import load_dotenv
from groq import APIConnectionError, APITimeoutError, RateLimitError

from langchain_groq import ChatGroq
from langchain_core.messages import SystemMessage, HumanMessage
from langgraph.graph import StateGraph, MessagesState, START, END
from langgraph.prebuilt import ToolNode, tools_condition

from tools import (
    SYSTEM_PROMPT,
    search_notes,
    calculate,
    today,
    add_task
)


# ==================================================
# 1. LOAD ENVIRONMENT VARIABLES
# ==================================================

BASE_DIR = Path(__file__).resolve().parent

load_dotenv(BASE_DIR / ".env")

GROQ_API_KEY = os.getenv("GROQ_API_KEY")

if not GROQ_API_KEY:
    raise ValueError(
        "GROQ_API_KEY not found in backend/.env"
    )


# ==================================================
# 2. INITIALIZE GROQ MODEL
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
# 3. REGISTER TOOLS
# ==================================================

TOOLS = [
    search_notes,
    calculate,
    today,
    add_task
]

# Allow the LLM to call the registered tools
llm_with_tools = llm.bind_tools(TOOLS)


# ==================================================
# 4. THINK NODE
# ==================================================

def think(state: MessagesState):
    """
    THINK:
    The LLM reads the conversation and decides
    whether it needs to call a tool or answer.
    """

    messages = [
        SystemMessage(content=SYSTEM_PROMPT)
    ] + state["messages"]

    response = llm_with_tools.invoke(messages)

    return {
        "messages": [response]
    }


# ==================================================
# 5. CREATE TOOL NODE
# ==================================================

# ACT:
# Executes the tools requested by the LLM.

tool_node = ToolNode(TOOLS)


# ==================================================
# 6. BUILD THE LANGGRAPH WORKFLOW
# ==================================================

workflow = StateGraph(MessagesState)

# Add nodes
workflow.add_node("think", think)

workflow.add_node("tools", tool_node)

# Start -> Think
workflow.add_edge(START, "think")

# Think -> Tools OR End
workflow.add_conditional_edges(
    "think",
    tools_condition,
    {
        "tools": "tools",
        END: END
    }
)

# Tools -> Think again
workflow.add_edge("tools", "think")


# ==================================================
# 7. COMPILE THE GRAPH
# ==================================================

agent = workflow.compile()


# ==================================================
# 8. ASK THE AGENT
# ==================================================

def ask_agent(question: str):
    """
    Send a question to the LangGraph agent.

    Returns:
        answer: Final response.
        steps: Tools used during execution.
    """

    if not question or not question.strip():
        return "Please enter a question.", []

    try:

        # Run the graph
        result = agent.invoke(
            {
                "messages": [
                    HumanMessage(content=question.strip())
                ]
            },
            config={
                "recursion_limit": 25
            }
        )

        messages = result["messages"]

        # Collect tool calls
        steps = []

        for message in messages:

            for call in getattr(message, "tool_calls", []) or []:

                steps.append(call["name"])

        # Find final AI response
        answer = None

        for message in reversed(messages):

            if (
                getattr(message, "type", None) == "ai"
                and not getattr(message, "tool_calls", [])
                and message.content
            ):

                answer = message.content
                break

        if answer is None:
            answer = "I couldn't generate an answer."

        # Handle text-block responses
        if isinstance(answer, list):

            answer = "\n".join(
                part.get("text", "")
                if isinstance(part, dict)
                else str(part)
                for part in answer
            )

        return answer, steps

    except RateLimitError:
        return (
            "Groq API rate limit reached. Please try again later."
        ), []

    except APITimeoutError:
        return (
            "Groq API request timed out. Check your connection."
        ), []

    except APIConnectionError:
        return (
            "Unable to connect to Groq. Check your internet connection."
        ), []

    except Exception as e:

        print(
            f"\n[GRAPH ERROR] {type(e).__name__}: {e}"
        )

        return "An error occurred while running the agent.", []


# ==================================================
# 9. DISPLAY THE GRAPH
# ==================================================

def show_graph():

    print("\nLANGGRAPH WORKFLOW")
    print("------------------")
    print("START")
    print("  |")
    print("THINK")
    print("  |")
    print("TOOL REQUIRED?")
    print("  |")
    print(" YES -> TOOLS -> THINK")
    print("  |")
    print("  NO")
    print("  |")
    print(" END")


# ==================================================
# 10. RUN THE AGENT
# ==================================================

def main():

    print("=" * 55)
    print("          STUDY BUDDY - LANGGRAPH AGENT")
    print("=" * 55)

    print("\nModel:", MODEL)
    print("Framework: LangGraph")
    print("Provider: Groq")

    print("\nAvailable tools:")

    for tool in TOOLS:
        print(" -", tool.__name__)

    show_graph()

    print("\nAgent is ready!")
    print("Type 'quit' or 'exit' to stop.")

    while True:

        try:

            question = input("\nYou: ").strip()

            if question.lower() in ("quit", "exit"):

                print("\nStudy Buddy: Goodbye!")
                break

            if not question:
                continue

            answer, steps = ask_agent(question)

            print("\nTools used:")

            if steps:

                for step in steps:
                    print("  [TOOL]", step)

            else:
                print("  None")

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
