import { useEffect } from 'react'
import type { ToolDef } from '../lib/agent'
import './ConfirmDialog.css'

interface ConfirmDialogProps {
  tool: ToolDef
  args: Record<string, string>
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({ tool, args, onConfirm, onCancel }: ConfirmDialogProps) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel()
      if (e.key === 'Enter') onConfirm()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onConfirm, onCancel])

  const argEntries = Object.entries(args)

  return (
    <div className="confirm-overlay" onClick={onCancel}>
      <div className="confirm-panel" onClick={e => e.stopPropagation()}>
        <div className="confirm-icon">&#9888;</div>
        <h3 className="confirm-title">{tool.descriptionKo}</h3>
        <p className="confirm-desc">Run this action?</p>
        {argEntries.length > 0 && (
          <div className="confirm-args">
            {argEntries.map(([key, value]) => (
              <div key={key} className="confirm-arg">
                <span className="confirm-arg-key">{key}:</span>
                <code className="confirm-arg-value">{value}</code>
              </div>
            ))}
          </div>
        )}
        <div className="confirm-risk">
          Risk: <span className={`risk-badge risk-badge--${tool.risk}`}>{tool.risk}</span>
        </div>
        <div className="confirm-actions">
          <button className="confirm-cancel-btn" onClick={onCancel}>Cancel</button>
          <button className="confirm-ok-btn" onClick={onConfirm}>Run</button>
        </div>
      </div>
    </div>
  )
}
