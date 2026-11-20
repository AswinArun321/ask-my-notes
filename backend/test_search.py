
# test_search.py
# Checks whether ChromaDB can find relevant PDF content

from ingest import collection

# Get question from user
question = input("Ask something: ")

# Search for the 3 most relevant chunks
results = collection.query(
    query_texts=[question],
    n_results=3
)

# Display retrieved results
for text, info in zip(
    results["documents"][0],
    results["metadatas"][0]
):

    print(
        "\n---",
        info["source"],
        "| page",
        info["page"],
        "---"
    )

    print(text[:300])
