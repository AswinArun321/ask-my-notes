import { useRef } from "react";

export default function ChatComposer({
    question,
    setQuestion,
    onSubmit,
    onUpload,
    isAsking,
    isUploading,
    agentMode
}) {
    const fileInputRef = useRef(null);

    function handleSubmit(e) {
        e.preventDefault();
        onSubmit();
    }

    function handleFileChange(e) {
        const file = e.target.files?.[0];
        if (file) {
            onUpload(file);
        }
        e.target.value = "";
    }

    return (
        <section className="composer-container" aria-label="Ask question">
            <form className="composer-form" onSubmit={handleSubmit}>
                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,application/pdf"
                    hidden
                    onChange={handleFileChange}
                    disabled={isUploading || isAsking}
                />

                <button
                    type="button"
                    className="composer-btn upload-btn"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading || isAsking}
                    title="Upload a PDF file"
                    aria-label="Upload PDF"
                >
                    <span className="btn-icon" aria-hidden="true">📎</span>
                    <span className="btn-text">PDF</span>
                </button>

                <input
                    type="text"
                    className="composer-input"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    placeholder={
                        agentMode
                            ? "Ask Study Buddy Agent (notes, calculations, date, tasks)..."
                            : "Ask a question about your documents..."
                    }
                    disabled={isAsking}
                    aria-label="Question prompt"
                />

                <button
                    type="submit"
                    className="composer-btn send-btn"
                    disabled={isAsking || !question.trim()}
                    title="Send question"
                    aria-label="Send question"
                >
                    <span aria-hidden="true">↑</span>
                </button>
            </form>

            <footer className="composer-footer">
                <span>
                    {agentMode
                        ? "🤖 AI Agent Mode: Autonomous reasoning with tools (search_notes, calculate, today, add_task)"
                        : "Answers are grounded in indexed PDF passages. Verify important details."}
                </span>
            </footer>
        </section>
    );
}
