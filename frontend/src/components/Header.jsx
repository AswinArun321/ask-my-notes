export default function Header({
    indexedPieces,
    countStatus,
    onRefreshCount,
    theme,
    onToggleTheme,
    messagesCount,
    onClearChat
}) {
    let piecesLabel = "";
    if (countStatus === "loading") {
        piecesLabel = "Checking index...";
    } else if (countStatus === "unavailable") {
        piecesLabel = "Index unavailable";
    } else {
        piecesLabel = `${indexedPieces ?? 0} indexed pieces`;
    }

    return (
        <header className="app-header">
            <div className="header-brand">
                <div className="brand-badge" aria-hidden="true">✦</div>
                <div>
                    <h1 className="brand-title">Ask My Notes</h1>
                    <p className="brand-tagline">PDF Assistant</p>
                </div>
            </div>

            <div className="header-status">
                <span
                    className={`status-pill ${countStatus}`}
                    title="Number of indexed text chunks in vector database"
                >
                    <span className="status-dot" aria-hidden="true"></span>
                    {piecesLabel}
                </span>

                <button
                    type="button"
                    className="action-btn icon-btn"
                    onClick={onRefreshCount}
                    title="Refresh indexed chunk count"
                    aria-label="Refresh indexed chunk count"
                >
                    ↻
                </button>
            </div>

            <div className="header-actions">
                <button
                    type="button"
                    className="action-btn theme-toggle-btn"
                    onClick={onToggleTheme}
                    title={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
                    aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
                >
                    {theme === "dark" ? "☀️ Light" : "🌙 Dark"}
                </button>

                <button
                    type="button"
                    className="action-btn clear-chat-btn"
                    onClick={onClearChat}
                    disabled={messagesCount === 0}
                    title={messagesCount === 0 ? "No messages to clear" : "Clear conversation"}
                >
                    Clear chat
                </button>
            </div>
        </header>
    );
}
