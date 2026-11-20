export default function UploadNotice({ notice, isUploading, onDismiss }) {
    if (isUploading) {
        return (
            <div className="upload-notice uploading" role="status" aria-live="polite">
                <span className="spinner-icon" aria-hidden="true"></span>
                <span>Uploading and indexing PDF document...</span>
            </div>
        );
    }

    if (!notice) return null;

    return (
        <div
            className={`upload-notice ${notice.type}`}
            role={notice.type === "error" ? "alert" : "status"}
            aria-live="polite"
        >
            <span className="notice-icon" aria-hidden="true">
                {notice.type === "success" ? "✓" : "⚠"}
            </span>
            <span className="notice-message">{notice.message}</span>
            <button
                type="button"
                className="notice-dismiss-btn"
                onClick={onDismiss}
                aria-label="Dismiss notification"
            >
                ×
            </button>
        </div>
    );
}
