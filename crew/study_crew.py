
"""
Ask My Notes - CrewAI Study Planner

Two-agent workflow:
1. Notes Researcher: Searches the student's uploaded notes.
2. Study Coach: Creates a 3-day study plan and a 5-question quiz.
"""

import os
import json
import urllib.request
import urllib.error

from pathlib import Path
from dotenv import load_dotenv

from crewai import Agent, Task, Crew, Process, LLM
from crewai.tools import tool


# ==========================================================
# STEP 1: LOAD ENVIRONMENT VARIABLES
# ==========================================================

BASE_DIR = Path(__file__).resolve().parent
PROJECT_DIR = BASE_DIR.parent

BACKEND_ENV = PROJECT_DIR / "backend" / ".env"

load_dotenv(BACKEND_ENV)

GROQ_API_KEY = os.getenv("GROQ_API_KEY")

if not GROQ_API_KEY:
    raise ValueError(
        "GROQ_API_KEY not found. Check backend/.env"
    )


# ==========================================================
# STEP 2: CONFIGURE GROQ LLM
# ==========================================================

llm = LLM(
    model="groq/openai/gpt-oss-120b",
    api_key=GROQ_API_KEY,
    temperature=0.3
)


# ==========================================================
# STEP 3: CREATE CUSTOM ASK MY NOTES TOOL
# ==========================================================

@tool("Ask My Notes")
def ask_my_notes(question: str) -> str:
    """
    Search the student's uploaded PDF notes and answer
    a question using the existing Ask My Notes backend.
    """

    url = "http://localhost:8000/ask"

    payload = json.dumps({
        "question": question
    }).encode("utf-8")

    request = urllib.request.Request(
        url,
        data=payload,
        headers={
            "Content-Type": "application/json"
        },
        method="POST"
    )

    try:
        with urllib.request.urlopen(
            request,
            timeout=60
        ) as response:

            result = json.loads(
                response.read().decode("utf-8")
            )

            answer = result.get(
                "answer",
                "No answer returned by the backend."
            )

            sources = result.get("sources", [])

            if sources:
                return (
                    f"Answer:\n{answer}\n\n"
                    f"Sources:\n{json.dumps(sources, ensure_ascii=False)}"
                )

            return answer

    except urllib.error.HTTPError as error:
        details = error.read().decode("utf-8", errors="replace")
        return f"Backend HTTP error {error.code}: {details}"

    except urllib.error.URLError as error:
        return (
            "Could not connect to Ask My Notes backend. "
            f"Make sure FastAPI is running. Details: {error.reason}"
        )

    except (json.JSONDecodeError, KeyError) as error:
        return f"Invalid backend response: {error}"


# ==========================================================
# STEP 4: CREATE AGENT 1 - NOTES RESEARCHER
# ==========================================================

researcher = Agent(
    role="Notes Researcher",

    goal=(
        "Find the most important facts about {topic} "
        "in the student's uploaded notes."
    ),

    backstory=(
        "You are a careful academic researcher. "
        "You search the student's notes using the Ask My Notes tool. "
        "You only report information supported by the notes. "
        "You organize findings clearly and avoid inventing facts."
    ),

    tools=[ask_my_notes],

    llm=llm,

    verbose=True
)


# ==========================================================
# STEP 5: CREATE AGENT 2 - STUDY COACH
# ==========================================================

coach = Agent(
    role="Study Coach",

    goal=(
        "Turn the research into a simple three-day study plan "
        "and a short quiz."
    ),

    backstory=(
        "You are a friendly and experienced study coach. "
        "You help students understand difficult topics using "
        "simple explanations, structured study schedules, "
        "and useful practice questions."
    ),

    llm=llm,

    verbose=True
)


# ==========================================================
# STEP 6: CREATE TASK 1 - RESEARCH TASK
# ==========================================================

research_task = Task(
    description=(
        "Research the topic {topic} using the student's uploaded notes. "
        "Use the Ask My Notes tool two or three times with relevant "
        "questions to gather useful information. "
        "Identify the most important concepts, definitions, "
        "facts, and explanations. "
        "Do not invent information that is not supported by the notes."
    ),

    expected_output=(
        "A structured bullet list containing 5 to 8 important points "
        "about the topic, based on the student's uploaded notes. "
        "Include source information when available."
    ),

    agent=researcher
)


# ==========================================================
# STEP 7: CREATE TASK 2 - STUDY PLAN TASK
# ==========================================================

STUDY_PLAN_FILE = BASE_DIR / "study_plan.md"

plan_task = Task(
    description=(
        "Using the researcher's findings, prepare a complete "
        "three-day study plan for {topic}. "
        "Organize the plan into Day 1, Day 2, and Day 3. "
        "For each day, include topics to study, important concepts, "
        "and a short revision activity. "
        "After the study plan, create a five-question quiz "
        "with answers based on the research. "
        "Do not introduce unsupported facts."
    ),

    expected_output=(
        "A well-formatted Markdown study plan containing: "
        "1. Topic overview. "
        "2. Important concepts. "
        "3. Day 1 study schedule. "
        "4. Day 2 study schedule. "
        "5. Day 3 study schedule. "
        "6. Five quiz questions. "
        "7. Quiz answers."
    ),

    agent=coach,

    context=[research_task],

    output_file=str(STUDY_PLAN_FILE)
)


# ==========================================================
# STEP 8: CREATE THE CREW
# ==========================================================

study_crew = Crew(
    agents=[
        researcher,
        coach
    ],

    tasks=[
        research_task,
        plan_task
    ],

    process=Process.sequential,

    max_rpm=3,

    verbose=True
)


# ==========================================================
# STEP 9: RUN THE CREW
# ==========================================================

def generate_study_plan(topic: str):

    if not topic or not topic.strip():
        raise ValueError("Please enter a valid topic.")

    print("\n" + "=" * 60)
    print("ASK MY NOTES - CREWAI STUDY PLANNER")
    print("=" * 60)

    print(f"\nSelected topic: {topic}")

    print("\nStarting the AI agent team...\n")

    result = study_crew.kickoff(
        inputs={
            "topic": topic.strip()
        }
    )

    print("\n" + "=" * 60)
    print("STUDY PLAN GENERATED SUCCESSFULLY")
    print("=" * 60)

    print(result)

    print(f"\nStudy plan saved to:\n{STUDY_PLAN_FILE}")

    return result


# ==========================================================
# STEP 10: MAIN PROGRAM
# ==========================================================

if __name__ == "__main__":

    print("\nWelcome to Ask My Notes - Study Planner!")

    topic = input(
        "\nEnter the topic you want to study: "
    ).strip()

    try:
        generate_study_plan(topic)

    except Exception as error:
        print("\nAn error occurred while running the crew:")
        print(error)
