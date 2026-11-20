import SourceReferences from "./SourceReferences";

export default function ChatMessage({ message }) {
    const isBot = message.role === "bot";

    return (
        <article className={`message-row ${message.role}`}>
            <div className="message-avatar" aria-hidden="true">
                {isBot ? "✦" : "You"}
            </div>

            <div className="message-body">
                <header className="message-header">
                    <span className="message-author">
                        {isBot ? "Ask My Notes" : "You"}
                    </span>
                </header>

                <div className={`message-bubble ${message.isError ? "error" : ""}`}>
                    {message.text}
                </div>

                {isBot && message.sources && message.sources.length > 0 && (
                    <SourceReferences sources={message.sources} />
                )}
            </div>
        </article>
    );
}
