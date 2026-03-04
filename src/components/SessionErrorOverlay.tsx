interface SessionErrorOverlayProps {
  error: string | null
  onOpenSettings?: () => void
}

export function SessionErrorOverlay({ error, onOpenSettings }: SessionErrorOverlayProps) {
  return (
    <div className="confirm-overlay">
      <div className="confirm-panel">
        <div className="confirm-icon">&#9888;</div>
        <h3 className="confirm-title">Setup Required</h3>
        <p className="confirm-desc">
          {error || 'Could not start session'}
        </p>
        {onOpenSettings && (
          <div className="confirm-actions">
            <button className="confirm-ok-btn" onClick={onOpenSettings}>
              Open Settings
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
