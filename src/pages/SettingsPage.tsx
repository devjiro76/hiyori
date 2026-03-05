import { useState } from 'react'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { LLM_PROVIDERS } from '../lib/llm/providers'
import type { LlmConfig } from '../lib/llm/adapter'
import type { TTSConfig } from '../lib/tts/tts-adapter'
import type { VoiceInputConfig } from '../hooks/useVoiceInput'
import { SettingsPanel, type MolrooConfig } from '../components/SettingsPanel'
import '../index.css'

const LS_LLM = 'tauri-hyori-llm-config'
const LS_TTS = 'tauri-hyori-tts-config'
const LS_VOICE = 'tauri-hyori-voice-config'
const LS_MOLROO = 'tauri-hyori-molroo-config'
const LS_AOT = 'tauri-hyori-always-on-top'

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (raw) return JSON.parse(raw) as T
  } catch { /* ignore */ }
  return fallback
}

export function SettingsPage() {
  const [llmConfig] = useState<LlmConfig>(() =>
    load(LS_LLM, { provider: LLM_PROVIDERS[0]?.id ?? 'none' })
  )
  const [ttsConfig] = useState<TTSConfig>(() =>
    load(LS_TTS, { provider: 'none' })
  )
  const [voiceConfig] = useState<VoiceInputConfig>(() =>
    load(LS_VOICE, { enabled: false })
  )
  const [molrooConfig] = useState<MolrooConfig>(() =>
    load(LS_MOLROO, { enabled: false })
  )
  const [alwaysOnTop] = useState(() => load(LS_AOT, false))
  const voiceSupported = !!navigator.mediaDevices?.getUserMedia

  async function handleClose() {
    await getCurrentWindow().close()
  }

  function handleSaveLlm(config: LlmConfig) {
    localStorage.setItem(LS_LLM, JSON.stringify(config))
  }

  function handleSaveTts(config: TTSConfig) {
    localStorage.setItem(LS_TTS, JSON.stringify(config))
  }

  function handleSaveVoice(config: VoiceInputConfig) {
    localStorage.setItem(LS_VOICE, JSON.stringify(config))
  }

  function handleSaveMolroo(config: MolrooConfig) {
    localStorage.setItem(LS_MOLROO, JSON.stringify(config))
  }

  function handleToggleAlwaysOnTop(value: boolean) {
    localStorage.setItem(LS_AOT, JSON.stringify(value))
  }

  return (
    <SettingsPanel
      llmConfig={llmConfig}
      onSave={handleSaveLlm}
      onClose={handleClose}
      alwaysOnTop={alwaysOnTop}
      onToggleAlwaysOnTop={handleToggleAlwaysOnTop}
      ttsConfig={ttsConfig}
      onSaveTts={handleSaveTts}
      voiceConfig={voiceConfig}
      onSaveVoice={handleSaveVoice}
      voiceSupported={voiceSupported}
      molrooConfig={molrooConfig}
      onSaveMolroo={handleSaveMolroo}
    />
  )
}
