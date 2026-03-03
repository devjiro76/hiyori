import { useState, useRef, useEffect } from 'react'
import type { SessionState } from '../hooks/useSession'
import type { AgentResponse } from '../lib/types'
import type { ToolResult } from '../lib/agent'
import { ChatHistory, type ChatMessage } from './ChatHistory'

interface ChatBubbleProps {
  session: SessionState
  isProcessing: boolean
  onSend: (message: string) => Promise<{
    result: { text: string; response: AgentResponse }
    displayText: string
  } | { error: string } | null>
  onTurnResponse: (response: AgentResponse) => void
  emotionReaction?: string | null
  onEmotionReactionDone?: () => void
  toolStatus?: { name: string; descriptionKo: string; status: 'running' | 'done' | 'error' } | null
  lastToolResults?: ToolResult[]
  onInputFocusChange?: (focused: boolean) => void
  onOpenSettings?: () => void
  settingsOpen?: boolean
}

export function ChatBubble({
  session,
  isProcessing,
  onSend,
  onTurnResponse,
  emotionReaction,
  onEmotionReactionDone,
  toolStatus,
  lastToolResults,
  onInputFocusChange,
  onOpenSettings,
  settingsOpen,
}: ChatBubbleProps) {
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [floatingText, setFloatingText] = useState<string | null>(null)
  const [floatingDuration, setFloatingDuration] = useState(3.5)
  const [historyOpen, setHistoryOpen] = useState(false)
  const floatingTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const reactionTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => {
    if (!emotionReaction) return
    if (reactionTimerRef.current) clearTimeout(reactionTimerRef.current)
    reactionTimerRef.current = setTimeout(() => onEmotionReactionDone?.(), 1800)
    return () => { if (reactionTimerRef.current) clearTimeout(reactionTimerRef.current) }
  }, [emotionReaction, onEmotionReactionDone])

  useEffect(() => {
    if (session.status === 'idle') setMessages([])
  }, [session.status])

  async function handleSend() {
    if (!input.trim() || isProcessing || session.status !== 'active') return
    const userMsg = input.trim()
    setMessages(prev => [...prev, { role: 'user', text: userMsg }])
    setInput('')

    const result = await onSend(userMsg)
    if (result && 'error' in result) {
      // Error is handled by session.status = 'error' in useSession
    } else if (result) {
      if (lastToolResults && lastToolResults.length > 0) {
        setMessages(prev => [...prev, { role: 'tool', text: '', toolResults: lastToolResults }])
      }
      setMessages(prev => [...prev, { role: 'assistant', text: result.displayText }])
      showFloating(result.displayText)
      onTurnResponse(result.result.response)
    }
  }

  function showFloating(text: string) {
    if (floatingTimerRef.current) clearTimeout(floatingTimerRef.current)
    const cleaned = text.replace(/^[\u201C\u201D""]+|[\u201C\u201D""]+$/g, '')
    const truncated = cleaned.length > 100 ? cleaned.slice(0, 100) + '...' : cleaned
    const ms = Math.min(5000, Math.max(2000, cleaned.length * 50))
    setFloatingDuration(ms / 1000)
    setFloatingText(truncated)
    floatingTimerRef.current = setTimeout(() => setFloatingText(null), ms)
  }

  const ready = session.status === 'active'

  return (
    <>
      {/* Speech bubble */}
      {floatingText && (
        <div
          className="speech-bubble"
          key={floatingText}
          style={{ animationDuration: `${floatingDuration}s` }}
        >
          {floatingText}
        </div>
      )}

      {/* Emotion reaction */}
      {emotionReaction && (
        <div className="emotion-reaction" key={emotionReaction + Date.now()}>
          {emotionReaction}
        </div>
      )}

      {/* Tool status indicator */}
      {toolStatus?.status === 'running' && (
        <div className="tool-status">
          <span className="tool-status-icon">&#9881;</span>
          <span>{toolStatus.descriptionKo}...</span>
        </div>
      )}

      {/* Loading indicator */}
      {(session.status === 'creating' || isProcessing) && (
        <div className="session-loading">
          <span className="dots"><span /><span /><span /></span>
        </div>
      )}

      {/* Error indicator */}
      {session.status === 'error' && !settingsOpen && (
        <div className="confirm-overlay">
          <div className="confirm-panel">
            <div className="confirm-icon">&#9888;</div>
            <h3 className="confirm-title">Setup Required</h3>
            <p className="confirm-desc">
              {session.error || 'Could not start session'}
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
      )}

      {/* Chat history overlay */}
      {historyOpen && (
        <ChatHistory
          messages={messages}
          isProcessing={isProcessing}
          onClose={() => setHistoryOpen(false)}
          onOpenSettings={onOpenSettings}
        />
      )}

      {/* Input bar */}
      <div className="input-layer">
        <div className="input-bar">
          <button
            onClick={() => setHistoryOpen(!historyOpen)}
            className="history-btn"
            aria-label="Toggle chat history"
          >
            {historyOpen ? '\u2715' : '\u2630'}
          </button>
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.nativeEvent.isComposing && handleSend()}
            onFocus={() => onInputFocusChange?.(true)}
            onBlur={() => onInputFocusChange?.(false)}
            placeholder={ready ? 'Talk to Hyori...' : 'Connecting...'}
            className="chat-input no-drag"
            disabled={!ready || isProcessing}
          />
          <button
            onClick={handleSend}
            className="send-btn no-drag"
            disabled={!ready || isProcessing || !input.trim()}
          >
            {isProcessing ? '...' : '\u2191'}
          </button>
        </div>
      </div>
    </>
  )
}
