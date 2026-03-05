import { useState, useRef, useEffect } from 'react'
import './ChatBubble.css'
import type { SessionState } from '../hooks/useSession'
import type { AgentResponse } from '../lib/types'
import type { ToolResult } from '../lib/agent'
import { useChatHistory } from '../hooks/useChatHistory'
import { SpeechBubble } from './SpeechBubble'
import { EmotionReaction } from './EmotionReaction'
import { ToolStatusIndicator } from './ToolStatusIndicator'
import { SessionErrorOverlay } from './SessionErrorOverlay'
import { InputBar } from './InputBar'

interface ChatBubbleProps {
  session: SessionState
  isProcessing: boolean
  streamingText?: string | null
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
  onSpeak?: (text: string) => void
  isListening?: boolean
}

export function ChatBubble({
  session,
  isProcessing,
  streamingText,
  onSend,
  onTurnResponse,
  emotionReaction,
  onEmotionReactionDone,
  toolStatus,
  lastToolResults,
  onInputFocusChange,
  onOpenSettings,
  settingsOpen,
  onSpeak,
  isListening,
}: ChatBubbleProps) {
  const [input, setInput] = useState('')
  const [historyMode, setHistoryMode] = useState<'hidden' | 'behind' | 'front'>('hidden')
  const { messages, addMessage } = useChatHistory()
  const historyListRef = useRef<HTMLDivElement>(null)
  const [floatingText, setFloatingText] = useState<string | null>(null)
  const [floatingDuration, setFloatingDuration] = useState(3.5)
  const floatingTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const reactionTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  // Auto-scroll chat history to bottom
  useEffect(() => {
    // Small delay to ensure DOM is rendered after historyMode change
    requestAnimationFrame(() => {
      const el = historyListRef.current
      if (el) el.scrollTop = el.scrollHeight
    })
  }, [messages, isProcessing, historyMode])

  useEffect(() => {
    if (!emotionReaction) return
    if (reactionTimerRef.current) clearTimeout(reactionTimerRef.current)
    reactionTimerRef.current = setTimeout(() => onEmotionReactionDone?.(), 1800)
    return () => { if (reactionTimerRef.current) clearTimeout(reactionTimerRef.current) }
  }, [emotionReaction, onEmotionReactionDone])

  async function handleSend() {
    if (!input.trim() || isProcessing || session.status !== 'active') return
    const userMsg = input.trim()
    await addMessage({ id: crypto.randomUUID(), role: 'user', text: userMsg })
    setInput('')

    const result = await onSend(userMsg)
    if (result && 'error' in result) {
      // Error is handled by session.status = 'error' in useSession
    } else if (result) {
      if (lastToolResults && lastToolResults.length > 0) {
        await addMessage({
          id: crypto.randomUUID(),
          role: 'tool',
          text: '',
          toolResults: lastToolResults.map(t => ({ name: t.name, status: t.success ? 'ok' as const : 'fail' as const, descriptionKo: t.descriptionKo }))
        })
      }
      await addMessage({ id: crypto.randomUUID(), role: 'assistant', text: result.displayText })
      showFloating(result.displayText)
      onTurnResponse(result.result.response)
      onSpeak?.(result.displayText)
    }
  }

  function showFloating(text: string) {
    if (floatingTimerRef.current) clearTimeout(floatingTimerRef.current)
    const cleaned = text.replace(/^[\u201C\u201D""]+|[\u201C\u201D""]+$/g, '')
    const truncated = cleaned.length > 100 ? cleaned.slice(0, 100) + '...' : cleaned
    // Duration doubled (2x) for better readability
    const ms = Math.min(10000, Math.max(4000, cleaned.length * 100))
    setFloatingDuration(ms / 1000)
    setFloatingText(truncated)
    floatingTimerRef.current = setTimeout(() => setFloatingText(null), ms)
  }

  const ready = session.status === 'active'

  return (
    <>
      {floatingText && (
        <SpeechBubble key={floatingText} text={floatingText} durationSeconds={floatingDuration} />
      )}

      {emotionReaction && (
        <EmotionReaction key={emotionReaction + Date.now()} symbol={emotionReaction} />
      )}

      {isListening && (
        <div className="voice-indicator">
          <span className="voice-indicator-dot" />
          <span>듣는 중...</span>
        </div>
      )}

      {toolStatus?.status === 'running' && (
        <ToolStatusIndicator descriptionKo={toolStatus.descriptionKo} />
      )}

      {streamingText != null && streamingText.length > 0 && (
        <SpeechBubble key="streaming" text={streamingText} durationSeconds={999} />
      )}

      {(session.status === 'creating' || (isProcessing && !streamingText)) && (
        <div className="session-loading">
          <span className="dots"><span /><span /><span /></span>
        </div>
      )}

      {session.status === 'error' && !settingsOpen && (
        <SessionErrorOverlay error={session.error} onOpenSettings={onOpenSettings} />
      )}

      {/* Chat History — 3 modes: hidden / behind character / in front */}
      {historyMode !== 'hidden' && (
        <div
          className={`history-overlay ${historyMode === 'front' ? 'history-overlay--active' : ''}`}
          onClick={historyMode === 'front' ? () => setHistoryMode('behind') : undefined}
        >
          <div ref={historyListRef} className="history-list" onClick={e => e.stopPropagation()}>
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`history-bubble history-bubble--${msg.role}`}
              >
                {msg.role === 'tool' && msg.toolResults ? (
                  msg.toolResults.map((tr, j) => (
                    <div key={j} className={`tool-result tool-result--${tr.status}`}>
                      <span className="tool-result-icon">{tr.status === 'ok' ? '✓' : '✗'}</span>
                      <span className="tool-result-name">{tr.descriptionKo || tr.name}</span>
                    </div>
                  ))
                ) : (
                  <span className="history-text">{msg.text}</span>
                )}
              </div>
            ))}
            {isProcessing && (
              <div className="history-bubble history-bubble--assistant">
                <span className="dots"><span /><span /><span /></span>
              </div>
            )}
          </div>
        </div>
      )}

      <InputBar
        value={input}
        onChange={setInput}
        onSend={handleSend}
        onCycleHistory={() => setHistoryMode(prev =>
          prev === 'hidden' ? 'behind' : prev === 'behind' ? 'front' : 'hidden'
        )}
        historyMode={historyMode}
        onFocusChange={onInputFocusChange}
        ready={ready}
        isProcessing={isProcessing}
      />
    </>
  )
}
