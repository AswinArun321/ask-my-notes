
from tools import (
    search_notes,
    calculate,
    today,
    add_task
)

print("\n--- TEST 1: CALCULATE ---")
print(calculate("(72 + 85 + 90) / 3"))

print("\n--- TEST 2: TODAY ---")
print(today())

print("\n--- TEST 3: ADD TASK ---")
print(add_task(
    "Complete Python assignment",
    "25 November 2026"
))

print("\n--- TEST 4: SEARCH NOTES ---")
print(search_notes("Explain machine learning"))
