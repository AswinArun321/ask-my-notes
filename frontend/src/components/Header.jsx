export default function Header({
    indexedPieces,
    countStatus,
    onRefreshCount,
    theme,
    onToggleTheme,
    messagesCount,
    onClearChat,
    agentMode,
    onToggleAgentMode
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
                    <p className="brand-tagline">PDF Assistant & Study Buddy</p>
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
                    className={`action-btn agent-toggle-btn ${agentMode ? "active" : ""}`}
                    onClick={onToggleAgentMode}
                    title={agentMode ? "Agent Mode is ON (uses tools). Click to switch to normal RAG." : "Agent Mode is OFF. Click to enable AI Agent."}
                    aria-label="Toggle AI Agent mode"
                >
                    <span className="agent-icon" aria-hidden="true">🤖</span>
                    <span>{agentMode ? "Agent: ON" : "Agent: OFF"}</span>
                </button>

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
