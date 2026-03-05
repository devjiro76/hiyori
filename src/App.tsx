import { useState, useEffect, useRef, useCallback } from 'react'
import { TOOL_STATUS_CLEAR_DELAY_MS } from './lib/constants'
import { hyoriCharacter } from './characters/hyori'
import { Live2DViewer } from './components/Live2DViewer'
import { ChatBubble } from './components/ChatBubble'
import { openSettingsWindow } from './lib/settings-window'
import { ConfirmDialog } from './components/ConfirmDialog'
import { useSession } from './hooks/useSession'
import { useWindowBehavior } from './hooks/useWindowBehavior'
import { useTTS } from './hooks/useTTS'
import { useVoiceInput } from './hooks/useVoiceInput'
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
    session, isProcessing, streamingText,
    setLlmConfig, setMolrooConfig,
    lastToolResults,
    sendMessage,
    createSession,
  } = useSession(confirmFn, onToolStatus)

  const { setTtsConfig, speak } = useTTS()

  const handleTurnResponse = useCallback((response: AgentResponse) => {
    if (!controller) return
    const { newEmotion } = applyEmotionToLive2D(controller, response, prevEmotionRef.current)
    if (prevEmotionRef.current && prevEmotionRef.current !== newEmotion) {
      setEmotionReaction(EMOTION_SYMBOLS[newEmotion] ?? '!')
    }
    prevEmotionRef.current = newEmotion
  }, [controller])

  const handleVoiceTranscript = useCallback(async (text: string) => {
    if (session.status !== 'active' || isProcessing) return
    const result = await sendMessage(text)
    if (result && 'result' in result) {
      if (result.result.response) handleTurnResponse(result.result.response)
      speak(result.displayText)
    }
  }, [session.status, isProcessing, sendMessage, speak, handleTurnResponse])

  const { setVoiceConfig, isListening } = useVoiceInput(handleVoiceTranscript)

  // Auto-create session on mount and when config changes
  useEffect(() => { createSession() }, [createSession])

  // Listen for settings changes from the settings window (localStorage)
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === 'tauri-hyori-llm-config' && e.newValue) {
        try { setLlmConfig(JSON.parse(e.newValue)) } catch { /* ignore */ }
      }
      if (e.key === 'tauri-hyori-tts-config' && e.newValue) {
        try { setTtsConfig(JSON.parse(e.newValue)) } catch { /* ignore */ }
      }
      if (e.key === 'tauri-hyori-voice-config' && e.newValue) {
        try { setVoiceConfig(JSON.parse(e.newValue)) } catch { /* ignore */ }
      }
      if (e.key === 'tauri-hyori-molroo-config' && e.newValue) {
        try { setMolrooConfig(JSON.parse(e.newValue)) } catch { /* ignore */ }
      }
      if (e.key === 'tauri-hyori-always-on-top' && e.newValue) {
        try { handleToggleAlwaysOnTop(JSON.parse(e.newValue)) } catch { /* ignore */ }
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [setLlmConfig, setTtsConfig, setVoiceConfig, setMolrooConfig, handleToggleAlwaysOnTop])

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
        streamingText={streamingText}
        onSend={sendMessage}
        onTurnResponse={handleTurnResponse}
        emotionReaction={emotionReaction}
        onEmotionReactionDone={() => setEmotionReaction(null)}
        toolStatus={toolStatus}
        lastToolResults={lastToolResults}
        onInputFocusChange={setInputFocused}
        onOpenSettings={() => openSettingsWindow()}
        settingsOpen={false}
        onSpeak={speak}
        isListening={isListening}
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
    </div>
  )
}
