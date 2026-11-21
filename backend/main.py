
import os

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from groq import Groq

from ingest import collection, add_pdf
from agent_langchain import ask_agent

# Live Voice WebSocket router
from voice import router as voice_router


# --------------------------------------------------
# 1. LOAD ENVIRONMENT VARIABLES
# --------------------------------------------------

load_dotenv()

api_key = os.getenv("GROQ_API_KEY")

if not api_key:
    raise ValueError("GROQ_API_KEY is missing in .env file")

ai = Groq(api_key=api_key)


# --------------------------------------------------
# 2. CREATE FASTAPI APPLICATION
# --------------------------------------------------

app = FastAPI(
    title="PDF RAG Chatbot API",
    description=(
        "Ask questions from PDF documents using RAG, "
        "AI Agent, and Gemini Live Voice."
    ),
    version="3.0.0"
)


# --------------------------------------------------
# 3. ENABLE CORS FOR REACT FRONTEND
# --------------------------------------------------

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"]
)


# --------------------------------------------------
# 4. REQUEST MODEL
# --------------------------------------------------

class Question(BaseModel):
    question: str


# --------------------------------------------------
# 5. HOME ENDPOINT
# --------------------------------------------------

@app.get("/")
def home():
    return {
        "status": "running",
        "pieces": collection.count()
    }


# --------------------------------------------------
# 6. ASK QUESTION ENDPOINT - ORIGINAL RAG
# --------------------------------------------------

@app.post("/ask")
def ask(q: Question):

    try:
        if not q.question.strip():
            raise HTTPException(
                status_code=400,
                detail="Question cannot be empty"
            )

        # Search relevant PDF pieces in ChromaDB
        results = collection.query(
            query_texts=[q.question],
            n_results=4
        )

        pieces = results["documents"][0]
        sources = results["metadatas"][0]

        # Check whether relevant notes were found
        if not pieces or not any(p.strip() for p in pieces):
            return {
                "answer": "Not found in your notes.",
                "sources": []
            }

        # Combine retrieved text pieces
        notes = "\n\n".join(pieces)

        # Prepare prompt for Groq
        prompt = f"""
You are a friendly and helpful teacher.

Answer the question using ONLY the information
provided in the notes below.

Instructions:
1. Explain in simple and understandable words.
2. Give a clear and direct answer.
3. Use bullet points when appropriate.
4. Give a short example if useful.
5. Do not invent information.
6. If the answer is not available in the notes,
   reply exactly: "Not found in your notes."

NOTES:
{notes}

QUESTION:
{q.question}

ANSWER:
"""

        # Generate AI response
        reply = ai.chat.completions.create(
            model="openai/gpt-oss-20b",
            messages=[
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            temperature=0.2
        )

        answer = reply.choices[0].message.content

        return {
            "answer": answer,
            "sources": sources
        }

    except HTTPException:
        raise

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )


# --------------------------------------------------
# 7. AGENT ENDPOINT - LANGCHAIN AGENT
# --------------------------------------------------

@app.post("/agent")
def agent(q: Question):

    try:
        if not q.question.strip():
            raise HTTPException(
                status_code=400,
                detail="Question cannot be empty"
            )

        # Call LangChain agent
        answer, steps = ask_agent(q.question)

        return {
            "answer": answer,
            "steps": steps
        }

    except HTTPException:
        raise

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )


# --------------------------------------------------
# 8. PDF UPLOAD ENDPOINT
# --------------------------------------------------

@app.post("/upload")
def upload(file: UploadFile = File(...)):

    try:
        # Validate uploaded file
        if not file.filename or not file.filename.lower().endswith(".pdf"):
            raise HTTPException(
                status_code=400,
                detail="Only PDF files are allowed."
            )

        # Create docs folder if it does not exist
        os.makedirs("docs", exist_ok=True)

        # Get filename safely
        name = os.path.basename(file.filename)

        # Save uploaded PDF
        path = os.path.join("docs", name)

        with open(path, "wb") as f:
            f.write(file.file.read())

        # Extract, split and store PDF pieces
        count = add_pdf(path)

        return {
            "message": f"Added {name} ({count} pieces). Ask me!"
        }

    except HTTPException:
        raise

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )

    finally:
        file.file.close()


# --------------------------------------------------
# 9. LIVE VOICE WEBSOCKET ROUTER
# --------------------------------------------------

app.include_router(voice_router)


# --------------------------------------------------
# 10. APPLICATION INFORMATION
# --------------------------------------------------

@app.get("/health")
def health():
    return {
        "status": "healthy",
        "service": "Ask My Notes",
        "features": [
            "PDF RAG",
            "LangChain Agent",
            "PDF Upload",
            "Gemini Live Voice"
        ]
    }
