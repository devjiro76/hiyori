type HistoryMode = 'hidden' | 'behind' | 'front'

const HISTORY_ICONS: Record<HistoryMode, string> = {
  hidden: '\u2630',  // ☰ hamburger
  behind: '\u25CB',  // ○ circle (behind)
  front: '\u25CF',   // ● filled circle (front)
}

interface InputBarProps {
  value: string
  onChange: (value: string) => void
  onSend: () => void
  onCycleHistory: () => void
  historyMode: HistoryMode
  onFocusChange?: (focused: boolean) => void
  ready: boolean
  isProcessing: boolean
}

export function InputBar({
  value,
  onChange,
  onSend,
  onCycleHistory,
  historyMode,
  onFocusChange,
  ready,
  isProcessing,
}: InputBarProps) {
  return (
    <div className="input-layer">
      <div className="input-bar">
        <button
          onClick={onCycleHistory}
          className="history-btn"
          aria-label="Cycle chat history mode"
        >
          {HISTORY_ICONS[historyMode]}
        </button>
        <input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.nativeEvent.isComposing && onSend()}
          onFocus={() => onFocusChange?.(true)}
          onBlur={() => onFocusChange?.(false)}
          placeholder={ready ? 'Talk to Hyori...' : 'Connecting...'}
          className="chat-input no-drag"
          disabled={!ready || isProcessing}
        />
        <button
          onClick={onSend}
          className="send-btn no-drag"
          disabled={!ready || isProcessing || !value.trim()}
        >
          {isProcessing ? '...' : '\u2191'}
        </button>
      </div>
    </div>
  )
}
