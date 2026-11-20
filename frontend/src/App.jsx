
import { useState, useEffect } from "react";
import "./App.css";

const API = "http://localhost:8000";

function showSources(sources) {
    if (!sources || sources.length === 0) return "";

    const names = sources.map(
        (s) => `${s.source} - Page ${s.page}`
    );

    return [...new Set(names)].join(" · ");
}

function App() {
    // Application states
    const [question, setQuestion] = useState("");
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(false);
    const [notesCount, setNotesCount] = useState(0);
    const [darkMode, setDarkMode] = useState(false);

    // Fetch the number of stored pieces from FastAPI
    async function getNotesCount() {
        try {
            const res = await fetch(`${API}/`);
            if (!res.ok) throw new Error("Could not get notes count");

            const data = await res.json();
            setNotesCount(data.pieces);
        } catch (error) {
            console.error("Notes count error:", error);
        }
    }

    // Get notes count when the application opens
    useEffect(() => {
        getNotesCount();
    }, []);

    // Add a message to the chat
    function addMessage(msg) {
        setMessages((old) => [...old, msg]);
    }

    // Ask a question from the uploaded PDFs
    async function askQuestion() {
        if (!question.trim() || loading) return;

        const myQuestion = question.trim();

        addMessage({
            role: "user",
            text: myQuestion
        });

        setQuestion("");
        setLoading(true);

        try {
            const res = await fetch(`${API}/ask`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    question: myQuestion
                })
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.detail || "Server error");
            }

            addMessage({
                role: "bot",
                text: data.answer,
                sources: data.sources || []
            });

        } catch (error) {
            addMessage({
                role: "bot",
                text: `Oops! ${error.message}. Is the backend running?`
            });
        } finally {
            setLoading(false);
        }
    }

    // Upload a PDF file
    async function uploadPdf(e) {
        const input = e.target;
        const file = input.files?.[0];

        if (!file || loading) return;

        if (!file.name.toLowerCase().endsWith(".pdf")) {
            addMessage({
                role: "bot",
                text: "Please select a PDF file."
            });
            input.value = "";
            return;
        }

        const form = new FormData();
        form.append("file", file);

        setLoading(true);

        try {
            const res = await fetch(`${API}/upload`, {
                method: "POST",
                body: form
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.detail || "Upload failed");
            }

            addMessage({
                role: "bot",
                text: data.message
            });

            // Update notes counter after uploading
            await getNotesCount();

        } catch (error) {
            addMessage({
                role: "bot",
                text: `Upload failed: ${error.message}`
            });
        } finally {
            setLoading(false);
            input.value = "";
        }
    }

    // Clear all chat messages
    function clearChat() {
        setMessages([]);
        setQuestion("");
    }

    // Toggle dark mode
    function toggleDarkMode() {
        setDarkMode((old) => !old);
    }

    return (
        <div className={`app ${darkMode ? "dark" : ""}`}>

            {/* Header */}
            <header className="header">
                <div>
                    <h1>📚 Ask My Notes</h1>
                    <p className="subtitle">
                        Your personal PDF AI assistant
                    </p>
                </div>

                <div className="header-actions">
                    <button
                        className="theme-button"
                        onClick={toggleDarkMode}
                        title="Toggle dark mode"
                    >
                        {darkMode ? "☀️ Light" : "🌙 Dark"}
                    </button>

                    <button
                        className="clear-button"
                        onClick={clearChat}
                        disabled={messages.length === 0}
                    >
                        🗑 Clear Chat
                    </button>
                </div>
            </header>

            {/* Notes counter */}
            <div className="notes-counter">
                📄 {notesCount} pieces in your notes
                <button
                    className="refresh-button"
                    onClick={getNotesCount}
                    title="Refresh notes count"
                >
                    ↻
                </button>
            </div>

            {/* Chat messages */}
            <div className="chat">

                {messages.length === 0 && (
                    <div className="welcome">
                        <div className="welcome-icon">🤖</div>
                        <h2>Hello! How can I help you?</h2>
                        <p>
                            Upload a PDF or ask a question
                            about your existing notes.
                        </p>

                        <div className="suggestions">
                            <span>Try asking:</span>
                            <button
                                onClick={() =>
                                    setQuestion(
                                        "What is the minimum internship duration?"
                                    )
                                }
                            >
                                Minimum internship duration
                            </button>

                            <button
                                onClick={() =>
                                    setQuestion(
                                        "What are the chapters in the project report?"
                                    )
                                }
                            >
                                Project report chapters
                            </button>
                        </div>
                    </div>
                )}

                {messages.map((m, i) => (
                    <div
                        key={i}
                        className={`msg ${m.role}`}
                    >
                        <p>{m.text}</p>

                        {m.sources && m.sources.length > 0 && (
                            <small className="sources">
                                📄 Sources: {showSources(m.sources)}
                            </small>
                        )}
                    </div>
                ))}

                {loading && (
                    <div className="msg bot loading">
                        <span className="spinner"></span>
                        Processing your request...
                    </div>
                )}

            </div>

            {/* Input area */}
            <div className="ask-box">

                {/* PDF upload */}
                <label
                    className={`upload ${loading ? "disabled" : ""}`}
                    title="Upload a PDF"
                >
                    📎 PDF
                    <input
                        type="file"
                        accept=".pdf,application/pdf"
                        hidden
                        onChange={uploadPdf}
                        disabled={loading}
                    />
                </label>

                {/* Question input */}
                <input
                    type="text"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") askQuestion();
                    }}
                    placeholder="Ask something about your notes..."
                    disabled={loading}
                />

                {/* Ask button */}
                <button
                    className="ask-button"
                    onClick={askQuestion}
                    disabled={loading || !question.trim()}
                >
                    Ask
                </button>

            </div>

            <footer className="footer">
                Powered by FastAPI · ChromaDB · Groq
            </footer>

        </div>
    );
}

export default App;
