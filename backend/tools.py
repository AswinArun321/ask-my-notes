
"""
tools.py
Study Buddy Agent - Tools

Available tools:
1. search_notes() - Search uploaded PDF notes
2. calculate()   - Perform mathematical calculations
3. today()       - Get today's date
4. add_task()    - Save study tasks
"""

import ast
import datetime
import math
import operator
from pathlib import Path

# Import collection from ingest.py
# Supports both package and direct execution imports.

try:
    from .ingest import collection
except ImportError:
    from ingest import collection


# ==================================================
# 1. SYSTEM PROMPT
# ==================================================

SYSTEM_PROMPT = """
You are Study Buddy, a friendly and helpful study agent.

Your purpose is to help students understand their study materials.

Use your tools whenever they help:

1. search_notes:
   Use this for questions about the student's uploaded
   PDF notes or study materials.

2. calculate:
   Use this whenever the student asks for mathematical
   calculations.

3. today:
   Use this when the student asks about today's date
   or the current day of the week.

4. add_task:
   Use this when the student wants to save a study task
   or create a to-do item.

Instructions:
- Answer in simple and understandable words.
- Be friendly and supportive.
- Use information from the student's notes when relevant.
- Mention the source filename and page number when
  answering from notes.
- Never invent information that is not in the notes.
- Explain calculations clearly when necessary.
- Confirm when a task has been successfully saved.
"""


# ==================================================
# 2. SEARCH NOTES TOOL
# ==================================================

def search_notes(query: str) -> str:
    """
    Search the student's PDF notes and return
    the three best matching results.

    Args:
        query: Question or topic to search.

    Returns:
        Matching text with source filename and page.
    """

    if not query or not query.strip():
        return "Please provide something to search for."

    try:
        results = collection.query(
            query_texts=[query.strip()],
            n_results=3
        )

        documents = results.get("documents", [[]])
        metadatas = results.get("metadatas", [[]])

        if not documents or not documents[0]:
            return "Nothing found in the notes."

        found = []

        for text, info in zip(
            documents[0],
            metadatas[0]
        ):
            info = info or {}

            source = info.get("source", "Unknown file")
            page = info.get("page", "Unknown")

            found.append(
                f"[Source: {source} | Page: {page}]\n{text}"
            )

        return "\n\n".join(found)

    except Exception as e:
        return f"Error searching notes: {str(e)}"


# ==================================================
# 3. CALCULATE TOOL
# ==================================================

def calculate(expression: str) -> str:
    """
    Perform mathematical calculations.

    Supports:
    + Addition
    - Subtraction
    * Multiplication
    / Division
    () Brackets

    Only numbers and basic mathematical operators
    are permitted.

    Args:
        expression: Mathematical expression.

    Returns:
        Calculated result.
    """

    if not expression or not expression.strip():
        return "Please provide a mathematical expression."

    if len(expression) > 200:
        return "Expression is too long."

    allowed_operators = {
        ast.Add: operator.add,
        ast.Sub: operator.sub,
        ast.Mult: operator.mul,
        ast.Div: operator.truediv,
        ast.UAdd: operator.pos,
        ast.USub: operator.neg,
    }

    def safe_eval(node):

        # Expression
        if isinstance(node, ast.Expression):
            return safe_eval(node.body)

        # Numbers only
        elif isinstance(node, ast.Constant):

            if (
                isinstance(node.value, (int, float))
                and not isinstance(node.value, bool)
            ):
                return node.value

        # Binary operations
        elif isinstance(node, ast.BinOp):

            op_type = type(node.op)

            if op_type in allowed_operators:

                left = safe_eval(node.left)
                right = safe_eval(node.right)

                return allowed_operators[op_type](
                    left, right
                )

        # Unary operations
        elif isinstance(node, ast.UnaryOp):

            op_type = type(node.op)

            if op_type in allowed_operators:

                return allowed_operators[op_type](
                    safe_eval(node.operand)
                )

        raise ValueError("Invalid mathematical expression.")

    try:

        tree = ast.parse(expression, mode="eval")

        result = safe_eval(tree)

        if not math.isfinite(result):
            return "The result is too large or invalid."

        return str(round(result, 4))

    except ZeroDivisionError:
        return "Cannot divide by zero."

    except Exception:
        return (
            "That maths has a mistake in it. "
            "Use only numbers, +, -, *, / and brackets."
        )


# ==================================================
# 4. TODAY TOOL
# ==================================================

def today() -> str:
    """
    Get today's date and the day of the week.

    Returns:
        Current date in readable format.
    """

    return datetime.date.today().strftime(
        "%A, %d %B %Y"
    )


# ==================================================
# 5. ADD TASK TOOL
# ==================================================

def add_task(task: str, due: str) -> str:
    """
    Save a study task with its due date
    to the student's to-do list.

    Args:
        task: Description of the study task.
        due: Task due date.

    Returns:
        Confirmation message.
    """

    if not task or not task.strip():
        return "Please provide a task description."

    if not due or not due.strip():
        return "Please provide a due date."

    try:

        # Save tasks.txt inside the backend folder
        backend_dir = Path(__file__).resolve().parent

        task_file = backend_dir / "tasks.txt"

        with open(
            task_file,
            "a",
            encoding="utf-8"
        ) as f:

            f.write(
                f"- {task.strip()} (due: {due.strip()})\n"
            )

        return (
            f"Saved: {task.strip()} "
            f"(due: {due.strip()})"
        )

    except OSError as e:
        return f"Error saving task: {str(e)}"


# ==================================================
# 6. AVAILABLE TOOLS
# ==================================================

TOOLS = {
    "search_notes": search_notes,
    "calculate": calculate,
    "today": today,
    "add_task": add_task
}
