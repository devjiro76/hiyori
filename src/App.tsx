import { useState, useEffect, useRef, useCallback } from 'react'
import { TOOL_STATUS_CLEAR_DELAY_MS } from './lib/constants'
import { hyoriCharacter } from './characters/hyori'
import { Live2DViewer } from './components/Live2DViewer'
import { ChatBubble } from './components/ChatBubble'
import { SettingsPanel } from './components/SettingsPanel'
import { ConfirmDialog } from './components/ConfirmDialog'
import { useSession } from './hooks/useSession'
import { useWindowBehavior } from './hooks/useWindowBehavior'
import { applyEmotionToLive2D } from './lib/live2d/emotion-controller'
import type { Live2DController } from './hooks/useLive2D'
import type { AgentResponse } from './lib/types'
import type { ToolDef } from './lib/agent'
import './App.css'

const EMOTION_SYMBOLS: Record<string, string> = {
  joy: '♪', contentment: '~', trust: '♡', calm: '―',
  surprise: '?!', excitement: '☆', anger: '#', disgust: ';;;',
  fear: '!!', anxiety: '...?', sadness: 'ㅠ', guilt: '...',
  numbness: '. . .', shame: '///',
}

export default function App() {
  const [controller, setController] = useState<Live2DController | null>(null)
  const [emotionReaction, setEmotionReaction] = useState<string | null>(null)
  const [toolStatus, setToolStatus] = useState<{ name: string; descriptionKo: string; status: 'running' | 'done' | 'error' } | null>(null)
  const prevEmotionRef = useRef<string | null>(null)

  const {
    alwaysOnTop, settingsOpen, setSettingsOpen,
    showResizeCorners, setInputFocused,
    handleToggleAlwaysOnTop,
  } = useWindowBehavior()

  // Confirm dialog state
  const [confirmPending, setConfirmPending] = useState<{
    tool: ToolDef
    args: Record<string, string>
    resolve: (confirmed: boolean) => void
  } | null>(null)

  const confirmFn = useCallback(async (tool: ToolDef, args: Record<string, string>): Promise<boolean> => {
    return new Promise<boolean>(resolve => {
      setConfirmPending({ tool, args, resolve })
    })
  }, [])

  const onToolStatus = useCallback((name: string, descriptionKo: string, status: 'running' | 'done' | 'error') => {
    setToolStatus({ name, descriptionKo, status })
    if (status !== 'running') {
      setTimeout(() => setToolStatus(null), TOOL_STATUS_CLEAR_DELAY_MS)
    }
  }, [])

  const {
    session, isProcessing,
    llmConfig, setLlmConfig,
    lastToolResults,
    sendMessage,
    createSession,
  } = useSession(confirmFn, onToolStatus)

  // Auto-create session on mount and when config changes
  useEffect(() => { createSession() }, [createSession])

  function handleTurnResponse(response: AgentResponse) {
    if (!controller) return
    const { newEmotion } = applyEmotionToLive2D(controller, response, prevEmotionRef.current)

    if (prevEmotionRef.current && prevEmotionRef.current !== newEmotion) {
      setEmotionReaction(EMOTION_SYMBOLS[newEmotion] ?? '!')
    }
    prevEmotionRef.current = newEmotion
  }

  return (
    <div className="app-root">
      {/* Resize handle — bottom-right only */}
      <div className="resize-corner resize-corner--se no-drag" data-resize-dir="SouthEast" style={{ opacity: showResizeCorners ? 1 : 0, pointerEvents: showResizeCorners ? 'auto' : 'none' }} />

      <Live2DViewer
        character={hyoriCharacter}
        onReady={setController}
      />
      <ChatBubble
        session={session}
        isProcessing={isProcessing}
        onSend={sendMessage}
        onTurnResponse={handleTurnResponse}
        emotionReaction={emotionReaction}
        onEmotionReactionDone={() => setEmotionReaction(null)}
        toolStatus={toolStatus}
        lastToolResults={lastToolResults}
        onInputFocusChange={setInputFocused}
        onOpenSettings={() => setSettingsOpen(true)}
        settingsOpen={settingsOpen}
      />
      {confirmPending && (
        <ConfirmDialog
          tool={confirmPending.tool}
          args={confirmPending.args}
          onConfirm={() => {
            confirmPending.resolve(true)
            setConfirmPending(null)
          }}
          onCancel={() => {
            confirmPending.resolve(false)
            setConfirmPending(null)
          }}
        />
      )}
      {settingsOpen && (
        <SettingsPanel
          llmConfig={llmConfig}
          onSave={(llm) => {
            setLlmConfig(llm)
          }}
          onClose={() => setSettingsOpen(false)}
          alwaysOnTop={alwaysOnTop}
          onToggleAlwaysOnTop={handleToggleAlwaysOnTop}
        />
      )}
    </div>
  )
}
