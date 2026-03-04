import { useRef, useEffect } from 'react'

interface ToolResultSimple {
  name: string
  status: 'ok' | 'fail'
  descriptionKo?: string
  success?: boolean
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'tool'
  text: string
  toolResults?: ToolResultSimple[]
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

  console.log('[ChatHistory] Rendering with', messages.length, 'messages')

  return (
    <div className="history-overlay" onClick={onClose}>
      <div className="history-list" ref={listRef} onClick={e => e.stopPropagation()}>
        {messages.length === 0 && !isProcessing && (
          <div style={{ color: '#888', textAlign: 'center', padding: '20px' }}>
            No messages yet
          </div>
        )}
        {messages.map((msg) => {
          if (msg.role === 'tool' && msg.toolResults) {
            return (
              <div key={msg.id} className="bubble bubble--tool">
                {msg.toolResults.map((tr, j) => {
                  const isOk = tr.status === 'ok' || tr.success
                  return (
                    <div key={j} className={`tool-result tool-result--${isOk ? 'ok' : 'fail'}`}>
                      <span className="tool-result-icon">{isOk ? '\u2713' : '\u2717'}</span>
                      <span className="tool-result-name">{tr.descriptionKo || tr.name}</span>
                    </div>
                  )
                })}
              </div>
            )
          }
          return (
            <div key={msg.id} className={`bubble bubble--${msg.role}${msg.isError ? ' bubble--error' : ''}`}>
              <div className="bubble-content">
                <span>{msg.text}</span>
                {msg.isError && onOpenSettings && (
                  <button onClick={onOpenSettings} className="bubble-settings-btn">
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
