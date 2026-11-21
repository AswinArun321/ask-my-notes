import SourceReferences from "./SourceReferences";

export default function ChatMessage({ message }) {
    const isBot = message.role === "bot";
    const isAgent = message.isAgent || (message.steps && message.steps.length > 0);

    return (
        <article className={`message-row ${message.role}`}>
            <div className="message-avatar" aria-hidden="true">
                {isBot ? (isAgent ? "🤖" : "✦") : "You"}
            </div>

            <div className="message-body">
                <header className="message-header">
                    <span className="message-author">
                        {isBot ? (isAgent ? "Study Buddy (Agent)" : "Ask My Notes") : "You"}
                    </span>
                    {isBot && isAgent && (
                        <span className="agent-badge">Agent Mode</span>
                    )}
                </header>

                <div className={`message-bubble ${message.isError ? "error" : ""}`}>
                    {message.text}
                </div>

                {/* Display tools used by the AI Agent */}
                {isBot && message.steps && message.steps.length > 0 && (
                    <div className="agent-tools-used" aria-label="Tools used by agent">
                        <span className="tools-label">🛠 Tools used:</span>
                        <div className="tools-list">
                            {message.steps.map((tool, idx) => (
                                <span key={idx} className="tool-chip">
                                    {tool}
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {/* Display PDF source citations for RAG */}
                {isBot && message.sources && message.sources.length > 0 && (
                    <SourceReferences sources={message.sources} />
                )}
            </div>
        </article>
    );
}
