import { useState, useEffect, useCallback } from 'react'
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
import type { ToolDef } from './lib/agent'
import './App.css'

export default function App() {
  const [toolStatus, setToolStatus] = useState<{ name: string; descriptionKo: string; status: 'running' | 'done' | 'error' } | null>(null)

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
    setLlmConfig,
    lastToolResults,
    sendMessage,
    createSession,
  } = useSession(confirmFn, onToolStatus)

  const { setTtsConfig, speak } = useTTS()

  const handleVoiceTranscript = useCallback(async (text: string) => {
    if (session.status !== 'active' || isProcessing) return
    const result = await sendMessage(text)
    if (result && 'result' in result) {
      speak(result.displayText)
    }
  }, [session.status, isProcessing, sendMessage, speak])

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
      if (e.key === 'tauri-hyori-always-on-top' && e.newValue) {
        try { handleToggleAlwaysOnTop(JSON.parse(e.newValue)) } catch { /* ignore */ }
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [setLlmConfig, setTtsConfig, setVoiceConfig, handleToggleAlwaysOnTop])

  return (
    <div className="app-root">
      {/* Resize handle — bottom-right only */}
      <div className="resize-corner resize-corner--se no-drag" data-resize-dir="SouthEast" style={{ opacity: showResizeCorners ? 1 : 0, pointerEvents: showResizeCorners ? 'auto' : 'none' }} />

      <Live2DViewer
        character={hyoriCharacter}
      />
      <ChatBubble
        session={session}
        isProcessing={isProcessing}
        streamingText={streamingText}
        onSend={sendMessage}
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
