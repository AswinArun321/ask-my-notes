
import { useEffect, useRef, useState } from "react";

import Header from "./components/Header";
import ChatMessage from "./components/ChatMessage";
import ChatComposer from "./components/ChatComposer";
import UploadNotice from "./components/UploadNotice";
import Voice from "./Voice";

import "./App.css";

const API = import.meta.env.VITE_API_URL || "http://localhost:8000";

const SUGGESTIONS = [
    {
        title: "Summarize key points",
        question: "Give me a concise summary of the key points in the uploaded notes.",
        agent: false
    },
    {
        title: "Minimum internship duration",
        question: "What is the minimum internship duration?",
        agent: false
    },
    {
        title: "Project report structure",
        question: "What are the chapters included in the project report?",
        agent: false
    },
    {
        title: "Calculate total hours (Agent)",
        question: "If an internship is 8 weeks with 5 days a week at 7 hours per day, how many total hours is that?",
        agent: true
    }
];

export default function App() {

    // --------------------------------------------------
    // 1. APPLICATION STATES
    // --------------------------------------------------

    const [question, setQuestion] = useState("");
    const [messages, setMessages] = useState([]);

    const [isAsking, setIsAsking] = useState(false);
    const [isUploading, setIsUploading] = useState(false);

    const [agentMode, setAgentMode] = useState(() => {
        return localStorage.getItem("amn_agent_mode") === "true";
    });

    const [indexedPieces, setIndexedPieces] = useState(null);
    const [countStatus, setCountStatus] = useState("loading");

    const [uploadNotice, setUploadNotice] = useState(null);

    const [theme, setTheme] = useState(() => {
        return localStorage.getItem("amn_theme") || "light";
    });

    // --------------------------------------------------
    // 2. REFERENCES
    // --------------------------------------------------

    const chatEndRef = useRef(null);
    const welcomeUploadRef = useRef(null);

    // --------------------------------------------------
    // 3. THEME MANAGEMENT
    // --------------------------------------------------

    useEffect(() => {
        document.documentElement.setAttribute("data-theme", theme);
        localStorage.setItem("amn_theme", theme);
    }, [theme]);

    function toggleTheme() {
        setTheme((prev) =>
            prev === "dark" ? "light" : "dark"
        );
    }

    // --------------------------------------------------
    // 4. AGENT MODE MANAGEMENT
    // --------------------------------------------------

    function toggleAgentMode() {
        setAgentMode((prev) => {
            const next = !prev;

            localStorage.setItem(
                "amn_agent_mode",
                String(next)
            );

            return next;
        });
    }

    // --------------------------------------------------
    // 5. FETCH INDEXED DOCUMENT COUNT
    // --------------------------------------------------

    async function fetchIndexedCount() {
        setCountStatus("loading");

        try {
            const res = await fetch(`${API}/`);

            if (!res.ok) {
                throw new Error(
                    `Server returned HTTP ${res.status}`
                );
            }

            const data = await res.json();

            setIndexedPieces(data.pieces ?? 0);
            setCountStatus("loaded");

        } catch (error) {
            console.error(
                "Failed to fetch chunk count:",
                error
            );

            setCountStatus("unavailable");
        }
    }

    // --------------------------------------------------
    // 6. INITIAL APPLICATION LOAD
    // --------------------------------------------------

    useEffect(() => {
        let isMounted = true;

        async function initialLoad() {
            try {
                const res = await fetch(`${API}/`);

                if (!res.ok) {
                    throw new Error(
                        `Server returned HTTP ${res.status}`
                    );
                }

                const data = await res.json();

                if (isMounted) {
                    setIndexedPieces(data.pieces ?? 0);
                    setCountStatus("loaded");
                }

            } catch (error) {
                console.error(
                    "Failed to fetch initial chunk count:",
                    error
                );

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

    // --------------------------------------------------
    // 7. AUTO SCROLL CHAT
    // --------------------------------------------------

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({
            behavior: "smooth"
        });
    }, [messages, isAsking]);

    // --------------------------------------------------
    // 8. ADD MESSAGE TO CHAT
    // --------------------------------------------------

    function addMessage(msg) {
        setMessages((prev) => [
            ...prev,
            msg
        ]);
    }

    // --------------------------------------------------
    // 9. ASK QUESTION - RAG / AGENT
    // --------------------------------------------------

    async function handleAsk(
        promptText,
        forceAgentMode = null
    ) {
        const text = (promptText ?? question).trim();

        if (!text || isAsking) return;

        // Clear input composer
        if (!promptText) {
            setQuestion("");
        }

        // Determine selected mode
        const useAgent = forceAgentMode !== null
            ? forceAgentMode
            : agentMode;

        // Add user message
        addMessage({
            role: "user",
            text
        });

        setIsAsking(true);

        // Select backend endpoint
        const endpoint = useAgent
            ? `${API}/agent`
            : `${API}/ask`;

        try {
            const res = await fetch(endpoint, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    question: text
                })
            });

            let data;

            try {
                data = await res.json();
            } catch {
                throw new Error(
                    "Invalid response format received from server."
                );
            }

            if (!res.ok) {
                throw new Error(
                    data?.detail ||
                    `Error from server (HTTP ${res.status})`
                );
            }

            // Agent response
            if (useAgent) {
                addMessage({
                    role: "bot",
                    text: data.answer ||
                        "No response received from agent.",
                    steps: Array.isArray(data.steps)
                        ? data.steps
                        : [],
                    isAgent: true
                });
            }

            // Original RAG response
            else {
                addMessage({
                    role: "bot",
                    text: data.answer ||
                        "No answer returned.",
                    sources: Array.isArray(data.sources)
                        ? data.sources
                        : [],
                    isAgent: false
                });
            }

        } catch (error) {
            addMessage({
                role: "bot",
                text: `Unable to get answer: ${error.message}. Please verify the backend service is running.`,
                isError: true,
                isAgent: useAgent
            });

        } finally {
            setIsAsking(false);
        }
    }

    // --------------------------------------------------
    // 10. PDF UPLOAD
    // --------------------------------------------------

    async function handleUpload(file) {
        if (!file || isUploading) return;

        // Validate PDF
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
                throw new Error(
                    "Invalid response format received from server."
                );
            }

            if (!res.ok) {
                throw new Error(
                    data?.detail ||
                    `Upload failed with status ${res.status}`
                );
            }

            setUploadNotice({
                type: "success",
                message: data.message ||
                    `Successfully ingested ${file.name}.`
            });

            // Refresh indexed chunks
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

    // --------------------------------------------------
    // 11. CLEAR CHAT
    // --------------------------------------------------

    function handleClearChat() {
        setMessages([]);
        setQuestion("");
        setUploadNotice(null);
    }

    // --------------------------------------------------
    // 12. APPLICATION UI
    // --------------------------------------------------

    return (
        <div className={`app-root ${theme}`}>

            {/* APPLICATION HEADER */}

            <Header
                indexedPieces={indexedPieces}
                countStatus={countStatus}
                onRefreshCount={fetchIndexedCount}
                theme={theme}
                onToggleTheme={toggleTheme}
                messagesCount={messages.length}
                onClearChat={handleClearChat}
                agentMode={agentMode}
                onToggleAgentMode={toggleAgentMode}
            />

            {/* LIVE VOICE COMPONENT */}

            <div className="app-voice-container">
                <Voice />
            </div>

            {/* MAIN CONTENT */}

            <main className="app-main">

                {/* UPLOAD NOTIFICATION */}

                <UploadNotice
                    notice={uploadNotice}
                    isUploading={isUploading}
                    onDismiss={() => setUploadNotice(null)}
                />

                {/* WELCOME SCREEN */}

                {messages.length === 0 ? (

                    <section
                        className="welcome-card"
                        aria-label="Welcome"
                    >

                        <div
                            className="welcome-icon"
                            aria-hidden="true"
                        >
                            {agentMode ? "🤖" : "📄"}
                        </div>

                        <h2 className="welcome-title">
                            {agentMode
                                ? "Study Buddy AI Agent"
                                : "Ask your PDF notes"}
                        </h2>

                        <p className="welcome-desc">
                            {agentMode
                                ? "Ask anything! The agent autonomously searches your notes, calculates math, checks dates, or saves study tasks using its tool suite."
                                : "Upload PDF documents and ask questions about their content. Answers are grounded in retrieved passages and reference their source pages."}
                        </p>

                        {/* WELCOME PDF UPLOAD */}

                        <div className="welcome-upload-wrap">

                            <input
                                ref={welcomeUploadRef}
                                type="file"
                                accept=".pdf,application/pdf"
                                hidden
                                onChange={(e) => {
                                    const file = e.target.files?.[0];

                                    if (file) {
                                        handleUpload(file);
                                    }

                                    e.target.value = "";
                                }}
                                disabled={isUploading || isAsking}
                            />

                            <button
                                type="button"
                                className="welcome-upload-btn"
                                onClick={() =>
                                    welcomeUploadRef.current?.click()
                                }
                                disabled={isUploading || isAsking}
                            >
                                <span aria-hidden="true">
                                    📎
                                </span>

                                Upload a PDF to begin
                            </button>

                        </div>

                        {/* SAMPLE QUESTIONS */}

                        <div className="suggestions-section">

                            <span className="suggestions-label">
                                Sample prompts:
                            </span>

                            <div className="suggestions-grid">

                                {SUGGESTIONS.map((item) => (

                                    <button
                                        type="button"
                                        key={item.title}
                                        className="suggestion-pill"
                                        onClick={() =>
                                            handleAsk(
                                                item.question,
                                                item.agent
                                            )
                                        }
                                        disabled={isAsking}
                                    >

                                        <span className="suggestion-text">
                                            {item.agent ? "🤖 " : ""}
                                            {item.title}
                                        </span>

                                        <span
                                            className="suggestion-arrow"
                                            aria-hidden="true"
                                        >
                                            →
                                        </span>

                                    </button>

                                ))}

                            </div>

                        </div>

                    </section>

                ) : (

                    /* CONVERSATION HISTORY */

                    <section
                        className="conversation-flow"
                        aria-label="Conversation history"
                    >

                        {messages.map((msg, index) => (

                            <ChatMessage
                                key={index}
                                message={msg}
                            />

                        ))}

                        {/* THINKING INDICATOR */}

                        {isAsking && (

                            <div
                                className="message-row bot loading"
                                role="status"
                                aria-live="polite"
                            >

                                <div
                                    className="message-avatar"
                                    aria-hidden="true"
                                >
                                    {agentMode ? "🤖" : "✦"}
                                </div>

                                <div className="message-body">

                                    <span className="message-author">
                                        {agentMode
                                            ? "Study Buddy (Agent)"
                                            : "Ask My Notes"}
                                    </span>

                                    <div className="thinking-indicator">

                                        <span className="pulse-dot"></span>
                                        <span className="pulse-dot"></span>
                                        <span className="pulse-dot"></span>

                                        <span className="thinking-label">
                                            {agentMode
                                                ? "Agent thinking & selecting tools..."
                                                : "Thinking..."}
                                        </span>

                                    </div>

                                </div>

                            </div>

                        )}

                        <div ref={chatEndRef} />

                    </section>

                )}

            </main>

            {/* CHAT COMPOSER */}

            <ChatComposer
                question={question}
                setQuestion={setQuestion}
                onSubmit={() => handleAsk()}
                onUpload={handleUpload}
                isAsking={isAsking}
                isUploading={isUploading}
                agentMode={agentMode}
            />

        </div>
    );
}
