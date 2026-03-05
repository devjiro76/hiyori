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
import { useAmbientMonitor } from './hooks/useAmbientMonitor'
import { useEmotionState } from './hooks/useEmotionState'
import { applyEmotionToLive2D } from './lib/live2d/emotion-controller'
import { createIdleBehavior, type IdleBehaviorController } from './lib/live2d/idle-behavior'
import { createProactiveEngine } from './lib/proactive/engine'
import { getRandomIdlePhrase, randomIdleInterval } from './lib/proactive/idle-speech'
import { getRelationship } from './lib/db/relationship'
import type { Live2DController } from './hooks/useLive2D'
import type { AgentResponse } from './lib/types'
import type { ToolDef } from './lib/agent'
import type { RelationshipLevel } from './lib/relationship/engine'
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

  // Idle behavior refs
  const idleBehaviorRef = useRef<IdleBehaviorController | null>(null)
  const idleSpeechTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const proactiveEngineRef = useRef(createProactiveEngine())
  const proactiveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Floating text for idle speech / proactive messages
  const [idleFloatingText, setIdleFloatingText] = useState<string | null>(null)

  const {
    showResizeCorners, setInputFocused,
    handleToggleAlwaysOnTop,
  } = useWindowBehavior()

  // Ambient monitor
  const { ambient, resetIdle } = useAmbientMonitor()

  // Emotion persistence
  const { currentEmotion, updateEmotion } = useEmotionState(controller)

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
    setAmbientContext,
    setEmotionContext,
    consumeMilestones,
    relationshipData: _relationshipData,
  } = useSession(confirmFn, onToolStatus)
  void _relationshipData // available for future UI use

  const { setTtsConfig, speak } = useTTS()

  // Push ambient context to session
  useEffect(() => {
    setAmbientContext({
      currentApp: ambient.currentApp,
      timeOfDay: ambient.timeOfDay,
      hourOfDay: ambient.hourOfDay,
      idleMinutes: ambient.idleMinutes,
    })
  }, [ambient, setAmbientContext])

  // Push emotion context to session
  useEffect(() => {
    if (currentEmotion) {
      setEmotionContext({
        emotion: currentEmotion.emotion,
        intensity: currentEmotion.intensity,
      })
    }
  }, [currentEmotion, setEmotionContext])

  const handleTurnResponse = useCallback((response: AgentResponse) => {
    if (!controller) return
    const { newEmotion } = applyEmotionToLive2D(controller, response, prevEmotionRef.current)
    if (prevEmotionRef.current && prevEmotionRef.current !== newEmotion) {
      setEmotionReaction(EMOTION_SYMBOLS[newEmotion] ?? '!')
    }
    prevEmotionRef.current = newEmotion

    // Persist emotion
    updateEmotion(
      response.emotion.discrete.primary,
      response.emotion.discrete.intensity,
      response.emotion.vad,
    )

    // Pause idle behavior during conversation
    idleBehaviorRef.current?.setPaused(true)
    // Resume after a delay
    setTimeout(() => idleBehaviorRef.current?.setPaused(false), 10_000)
  }, [controller, updateEmotion])

  const handleVoiceTranscript = useCallback(async (text: string) => {
    if (session.status !== 'active' || isProcessing) return
    resetIdle()
    const result = await sendMessage(text)
    if (result && 'result' in result) {
      if (result.result.response) handleTurnResponse(result.result.response)
      speak(result.displayText)
    }
  }, [session.status, isProcessing, sendMessage, speak, handleTurnResponse, resetIdle])

  const { setVoiceConfig, isListening } = useVoiceInput(handleVoiceTranscript)

  // Auto-create session on mount and when config changes
  useEffect(() => { createSession() }, [createSession])

  // Initialize idle behavior when controller is ready
  useEffect(() => {
    if (!controller?.isLoaded) return

    const idle = createIdleBehavior(controller)
    idleBehaviorRef.current = idle
    idle.start()

    return () => {
      idle.stop()
      idleBehaviorRef.current = null
    }
  }, [controller?.isLoaded])

  // Update idle behavior time of day
  useEffect(() => {
    idleBehaviorRef.current?.setTimeOfDay(ambient.timeOfDay)
  }, [ambient.timeOfDay])

  // Idle speech bubbles
  useEffect(() => {
    function scheduleIdleSpeech() {
      if (idleSpeechTimerRef.current) clearTimeout(idleSpeechTimerRef.current)
      idleSpeechTimerRef.current = setTimeout(async () => {
        if (isProcessing) {
          scheduleIdleSpeech()
          return
        }
        try {
          const rel = await getRelationship()
          const phrase = getRandomIdlePhrase(
            ambient.timeOfDay,
            (rel.level || 'stranger') as RelationshipLevel,
          )
          setIdleFloatingText(phrase)
          setTimeout(() => setIdleFloatingText(null), 4000)
        } catch { /* ignore */ }
        scheduleIdleSpeech()
      }, randomIdleInterval())
    }

    scheduleIdleSpeech()
    return () => {
      if (idleSpeechTimerRef.current) clearTimeout(idleSpeechTimerRef.current)
    }
  }, [ambient.timeOfDay, isProcessing])

  // Proactive message engine
  useEffect(() => {
    if (session.status !== 'active') return

    async function checkProactive() {
      try {
        const rel = await getRelationship()
        const trigger = proactiveEngineRef.current.evaluate(ambient, rel)
        if (trigger) {
          setIdleFloatingText(trigger.promptHint.length > 60
            ? trigger.promptHint.slice(0, 60) + '...'
            : trigger.promptHint)
          setTimeout(() => setIdleFloatingText(null), 6000)
        }
      } catch { /* ignore */ }
    }

    proactiveTimerRef.current = setInterval(checkProactive, 60_000)
    // Run once immediately
    checkProactive()

    return () => {
      if (proactiveTimerRef.current) clearInterval(proactiveTimerRef.current)
    }
  }, [session.status, ambient])

  // Handle milestones
  useEffect(() => {
    const milestones = consumeMilestones()
    if (milestones.length === 0) return

    for (const ms of milestones) {
      setEmotionReaction(EMOTION_SYMBOLS[ms.emotion] ?? '☆')
      setIdleFloatingText(ms.message)
      setTimeout(() => setIdleFloatingText(null), 6000)
      speak(ms.message)
    }
  }, [consumeMilestones, speak])

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

  // Reset idle on user interaction with the app
  useEffect(() => {
    const handler = () => resetIdle()
    window.addEventListener('pointerdown', handler)
    window.addEventListener('keydown', handler)
    return () => {
      window.removeEventListener('pointerdown', handler)
      window.removeEventListener('keydown', handler)
    }
  }, [resetIdle])

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
        idleFloatingText={idleFloatingText}
        onResetIdle={resetIdle}
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
