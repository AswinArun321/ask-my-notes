import { useEffect, useRef, useState } from "react";
import Header from "./components/Header";
import ChatMessage from "./components/ChatMessage";
import ChatComposer from "./components/ChatComposer";
import UploadNotice from "./components/UploadNotice";
import "./App.css";

const API = import.meta.env.VITE_API_URL || "http://localhost:8000";

const SUGGESTIONS = [
    {
        title: "Summarize key points",
        question: "Give me a concise summary of the key points in the uploaded notes."
    },
    {
        title: "Minimum internship duration",
        question: "What is the minimum internship duration?"
    },
    {
        title: "Project report structure",
        question: "What are the chapters included in the project report?"
    }
];

export default function App() {
    const [question, setQuestion] = useState("");
    const [messages, setMessages] = useState([]);
    const [isAsking, setIsAsking] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [indexedPieces, setIndexedPieces] = useState(null);
    const [countStatus, setCountStatus] = useState("loading"); // "loading" | "loaded" | "unavailable"
    const [uploadNotice, setUploadNotice] = useState(null);
    const [theme, setTheme] = useState(() => {
        return localStorage.getItem("amn_theme") || "light";
    });

    const chatEndRef = useRef(null);
    const welcomeUploadRef = useRef(null);

    // Apply theme to document
    useEffect(() => {
        document.documentElement.setAttribute("data-theme", theme);
        localStorage.setItem("amn_theme", theme);
    }, [theme]);

    function toggleTheme() {
        setTheme((prev) => (prev === "dark" ? "light" : "dark"));
    }

    // Fetch indexed chunks count from backend
    async function fetchIndexedCount() {
        setCountStatus("loading");
        try {
            const res = await fetch(`${API}/`);
            if (!res.ok) {
                throw new Error(`Server returned HTTP ${res.status}`);
            }
            const data = await res.json();
            setIndexedPieces(data.pieces ?? 0);
            setCountStatus("loaded");
        } catch (error) {
            console.error("Failed to fetch chunk count:", error);
            setCountStatus("unavailable");
        }
    }

    useEffect(() => {
        let isMounted = true;
        async function initialLoad() {
            try {
                const res = await fetch(`${API}/`);
                if (!res.ok) {
                    throw new Error(`Server returned HTTP ${res.status}`);
                }
                const data = await res.json();
                if (isMounted) {
                    setIndexedPieces(data.pieces ?? 0);
                    setCountStatus("loaded");
                }
            } catch (error) {
                console.error("Failed to fetch initial chunk count:", error);
                if (isMounted) {
                    setCountStatus("unavailable");
                }
            }
        }
        initialLoad();
        return () => {
            isMounted = false;
        };
    }, []);

    // Scroll to bottom when conversation updates
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, isAsking]);

    function addMessage(msg) {
        setMessages((prev) => [...prev, msg]);
    }

    async function handleAsk(promptText) {
        const text = (promptText ?? question).trim();
        if (!text || isAsking) return;

        // Clear composer if asked from input
        if (!promptText) {
            setQuestion("");
        }

        // Add user question
        addMessage({
            role: "user",
            text
        });

        setIsAsking(true);

        try {
            const res = await fetch(`${API}/ask`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ question: text })
            });

            let data;
            try {
                data = await res.json();
            } catch {
                throw new Error("Invalid response format received from server.");
            }

            if (!res.ok) {
                throw new Error(data?.detail || `Error from server (HTTP ${res.status})`);
            }

            addMessage({
                role: "bot",
                text: data.answer || "No answer returned.",
                sources: Array.isArray(data.sources) ? data.sources : []
            });
        } catch (error) {
            addMessage({
                role: "bot",
                text: `Unable to get answer: ${error.message}. Please verify the backend service is running.`,
                isError: true
            });
        } finally {
            setIsAsking(false);
        }
    }

    async function handleUpload(file) {
        if (!file || isUploading) return;

        if (!file.name.toLowerCase().endsWith(".pdf")) {
            setUploadNotice({
                type: "error",
                message: "Please select a valid PDF document."
            });
            return;
        }

        setUploadNotice(null);
        setIsUploading(true);

        const formData = new FormData();
        formData.append("file", file);

        try {
            const res = await fetch(`${API}/upload`, {
                method: "POST",
                body: formData
            });

            let data;
            try {
                data = await res.json();
            } catch {
                throw new Error("Invalid response format received from server.");
            }

            if (!res.ok) {
                throw new Error(data?.detail || `Upload failed with status ${res.status}`);
            }

            setUploadNotice({
                type: "success",
                message: data.message || `Successfully ingested ${file.name}.`
            });

            // Refresh chunk counter
            await fetchIndexedCount();
        } catch (error) {
            setUploadNotice({
                type: "error",
                message: `Upload failed: ${error.message}`
            });
        } finally {
            setIsUploading(false);
        }
    }

    function handleClearChat() {
        setMessages([]);
        setQuestion("");
        setUploadNotice(null);
    }

    return (
        <div className={`app-root ${theme}`}>
            <Header
                indexedPieces={indexedPieces}
                countStatus={countStatus}
                onRefreshCount={fetchIndexedCount}
                theme={theme}
                onToggleTheme={toggleTheme}
                messagesCount={messages.length}
                onClearChat={handleClearChat}
            />

            <main className="app-main">
                <UploadNotice
                    notice={uploadNotice}
                    isUploading={isUploading}
                    onDismiss={() => setUploadNotice(null)}
                />

                {messages.length === 0 ? (
                    <section className="welcome-card" aria-label="Welcome">
                        <div className="welcome-icon" aria-hidden="true"></div>
                        <h2 className="welcome-title">Ask your PDF notes</h2>
                        <p className="welcome-desc">
                            Upload PDF documents and ask questions about their content.
                            Answers are grounded in retrieved passages and reference their source pages.
                        </p>

                        <div className="welcome-upload-wrap">
                            <input
                                ref={welcomeUploadRef}
                                type="file"
                                accept=".pdf,application/pdf"
                                hidden
                                onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) handleUpload(file);
                                    e.target.value = "";
                                }}
                                disabled={isUploading || isAsking}
                            />
                            <button
                                type="button"
                                className="welcome-upload-btn"
                                onClick={() => welcomeUploadRef.current?.click()}
                                disabled={isUploading || isAsking}
                            >
                                <span aria-hidden="true"></span>
                                Upload a PDF to begin
                            </button>
                        </div>

                        <div className="suggestions-section">
                            <span className="suggestions-label">Sample questions:</span>
                            <div className="suggestions-grid">
                                {SUGGESTIONS.map((item) => (
                                    <button
                                        type="button"
                                        key={item.title}
                                        className="suggestion-pill"
                                        onClick={() => handleAsk(item.question)}
                                        disabled={isAsking}
                                    >
                                        <span className="suggestion-text">{item.title}</span>
                                        <span className="suggestion-arrow" aria-hidden="true">→</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </section>
                ) : (
                    <section className="conversation-flow" aria-label="Conversation history">
                        {messages.map((msg, index) => (
                            <ChatMessage key={index} message={msg} />
                        ))}

                        {isAsking && (
                            <div className="message-row bot loading" role="status" aria-live="polite">
                                <div className="message-avatar" aria-hidden="true">✦</div>
                                <div className="message-body">
                                    <span className="message-author">Ask My Notes</span>
                                    <div className="thinking-indicator">
                                        <span className="pulse-dot"></span>
                                        <span className="pulse-dot"></span>
                                        <span className="pulse-dot"></span>
                                        <span className="thinking-label">Thinking...</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div ref={chatEndRef} />
                    </section>
                )}
            </main>

            <ChatComposer
                question={question}
                setQuestion={setQuestion}
                onSubmit={() => handleAsk()}
                onUpload={handleUpload}
                isAsking={isAsking}
                isUploading={isUploading}
            />
        </div>
    );
}
