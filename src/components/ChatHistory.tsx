import { useRef, useEffect } from 'react'
import type { ToolResult } from '../lib/agent'

export interface ChatMessage {
  role: 'user' | 'assistant' | 'tool'
  text: string
  toolResults?: ToolResult[]
  isError?: boolean
}

interface ChatHistoryProps {
  messages: ChatMessage[]
  isProcessing: boolean
  onClose: () => void
  onOpenSettings?: () => void
}

export function ChatHistory({ messages, isProcessing, onClose, onOpenSettings }: ChatHistoryProps) {
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  return (
    <div className="history-overlay" onClick={onClose}>
      <div className="history-list" ref={listRef} onClick={e => e.stopPropagation()}>
        {messages.map((msg, i) => {
          if (msg.role === 'tool' && msg.toolResults) {
            return (
              <div key={i} className="bubble bubble--tool">
                {msg.toolResults.map((tr, j) => (
                  <div key={j} className={`tool-result tool-result--${tr.success ? 'ok' : 'fail'}`}>
                    <span className="tool-result-icon">{tr.success ? '\u2713' : '\u2717'}</span>
                    <span className="tool-result-name">{tr.descriptionKo}</span>
                  </div>
                ))}
              </div>
            )
          }
          return (
            <div key={i} className={`bubble bubble--${msg.role}${msg.isError ? ' bubble--error' : ''}`}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>{msg.text}</span>
                {msg.isError && onOpenSettings && (
                  <button
                    onClick={onOpenSettings}
                    style={{
                      padding: '4px 8px',
                      fontSize: '12px',
                      whiteSpace: 'nowrap',
                      backgroundColor: '#f87171',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                    }}
                  >
                    Settings
                  </button>
                )}
              </div>
            </div>
          )
        })}
        {isProcessing && (
          <div className="bubble bubble--assistant">
            <span className="dots"><span /><span /><span /></span>
          </div>
        )}
      </div>
    </div>
  )
}
