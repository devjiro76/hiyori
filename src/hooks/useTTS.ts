import { useState, useRef, useCallback } from 'react'
import { createTTSAdapter, type TTSConfig, type TTSAdapter } from '../lib/tts/tts-adapter'

const LS_KEY = 'tauri-hyori-tts-config'

function loadTTSConfig(): TTSConfig {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (raw) return JSON.parse(raw) as TTSConfig
  } catch { /* ignore */ }
  return { provider: 'none' }
}

function saveTTSConfig(config: TTSConfig) {
  localStorage.setItem(LS_KEY, JSON.stringify(config))
}

export function useTTS() {
  const [ttsConfig, setTtsConfigState] = useState<TTSConfig>(loadTTSConfig)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const adapterRef = useRef<TTSAdapter | null>(null)
  const configKeyRef = useRef('')

  const setTtsConfig = useCallback((config: TTSConfig) => {
    setTtsConfigState(config)
    saveTTSConfig(config)
    adapterRef.current = null
    configKeyRef.current = ''
  }, [])

  const speak = useCallback(async (text: string) => {
    const key = JSON.stringify(ttsConfig)
    if (key !== configKeyRef.current) {
      adapterRef.current = createTTSAdapter(ttsConfig)
      configKeyRef.current = key
    }

    const adapter = adapterRef.current
    if (!adapter) return

    setIsSpeaking(true)
    try {
      await adapter.speak(text)
    } catch (e) {
      console.error('[TTS] speak error:', e)
    } finally {
      setIsSpeaking(false)
    }
  }, [ttsConfig])

  const stopSpeaking = useCallback(() => {
    adapterRef.current?.stop()
    setIsSpeaking(false)
  }, [])

  return {
    ttsConfig,
    setTtsConfig,
    isSpeaking,
    speak,
    stopSpeaking,
  }
}
