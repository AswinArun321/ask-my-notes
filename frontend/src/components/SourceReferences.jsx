export default function SourceReferences({ sources }) {
    if (!sources || sources.length === 0) {
        return null;
    }

    // Deduplicate sources based on filename and page number
    const uniqueSources = [];
    const seen = new Set();

    for (const item of sources) {
        if (!item || !item.source) continue;
        const key = `${item.source}::${item.page}`;
        if (!seen.has(key)) {
            seen.add(key);
            uniqueSources.push(item);
        }
    }

    if (uniqueSources.length === 0) {
        return null;
    }

    return (
        <details className="source-details">
            <summary className="source-summary">
                <span className="source-summary-icon" aria-hidden="true">📎</span>
                <span>
                    {uniqueSources.length} source {uniqueSources.length === 1 ? "reference" : "references"}
                </span>
            </summary>
            <ul className="source-list">
                {uniqueSources.map((item, index) => (
                    <li className="source-item" key={`${item.source}-${item.page}-${index}`}>
                        <span className="source-file-icon" aria-hidden="true">📄</span>
                        <div className="source-info">
                            <span className="source-name" title={item.source}>{item.source}</span>
                            {item.page !== undefined && item.page !== null && (
                                <span className="source-page">Page {item.page}</span>
                            )}
                        </div>
                    </li>
                ))}
            </ul>
        </details>
    );
}
