import { useState, useEffect } from 'react'
import { LLM_PROVIDERS } from '../lib/llm/providers'
import type { LlmConfig } from '../lib/llm/adapter'
import type { TTSConfig, TTSProvider } from '../lib/tts/tts-adapter'
import type { VoiceInputConfig } from '../hooks/useVoiceInput'
import { DEFAULT_MAX_HISTORY_TURNS } from '../lib/constants'
import './SettingsPanel.css'

const TTS_PROVIDERS: { id: TTSProvider; name: string }[] = [
  { id: 'none', name: 'Off' },
  { id: 'web-speech', name: 'Web Speech API (built-in)' },
  { id: 'openai-tts', name: 'OpenAI TTS' },
  { id: 'elevenlabs', name: 'ElevenLabs' },
]

interface SettingsPanelProps {
  llmConfig: LlmConfig
  onSave: (llm: LlmConfig) => void
  onClose: () => void
  alwaysOnTop: boolean
  onToggleAlwaysOnTop: (value: boolean) => void
  ttsConfig?: TTSConfig
  onSaveTts?: (config: TTSConfig) => void
  voiceConfig?: VoiceInputConfig
  onSaveVoice?: (config: VoiceInputConfig) => void
  voiceSupported?: boolean
}

export function SettingsPanel({
  llmConfig,
  onSave,
  onClose,
  alwaysOnTop,
  onToggleAlwaysOnTop,
  ttsConfig,
  onSaveTts,
  voiceConfig,
  onSaveVoice,
  voiceSupported,
}: SettingsPanelProps) {
  const [provider, setProvider] = useState(llmConfig.provider)
  const [model, setModel] = useState(llmConfig.model ?? '')
  const [apiKey, setApiKey] = useState(llmConfig.apiKey ?? '')
  const [baseUrl, setBaseUrl] = useState(llmConfig.baseUrl ?? '')
  const [maxHistoryTurns, setMaxHistoryTurns] = useState(llmConfig.maxHistoryTurns ?? DEFAULT_MAX_HISTORY_TURNS)

  // TTS state
  const [ttsProvider, setTtsProvider] = useState<TTSProvider>(ttsConfig?.provider ?? 'none')
  const [ttsApiKey, setTtsApiKey] = useState(ttsConfig?.apiKey ?? '')
  const [ttsVoice, setTtsVoice] = useState(ttsConfig?.voice ?? '')
  const [ttsModel, setTtsModel] = useState(ttsConfig?.model ?? '')

  // Voice input state
  const [voiceEnabled, setVoiceEnabled] = useState(voiceConfig?.enabled ?? false)
  const [voiceApiKey, setVoiceApiKey] = useState(voiceConfig?.apiKey ?? '')

  const providerDef = LLM_PROVIDERS.find(p => p.id === provider)

  // When provider changes, reset model to default
  useEffect(() => {
    if (providerDef) {
      setModel(providerDef.defaultModel)
      if (!baseUrl || LLM_PROVIDERS.some(p => p.baseUrl === baseUrl)) {
        setBaseUrl(providerDef.baseUrl)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider])

  function handleSave() {
    onSave({ provider, model, apiKey: apiKey || undefined, baseUrl: baseUrl || undefined, maxHistoryTurns })
    onSaveTts?.({ provider: ttsProvider, apiKey: ttsApiKey || undefined, voice: ttsVoice || undefined, model: ttsModel || undefined })
    onSaveVoice?.({ enabled: voiceEnabled, apiKey: voiceApiKey || undefined })
    onClose()
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      e.stopPropagation()
      onClose()
    }
  }

  return (
    <div
      className="settings-overlay"
      onClick={onClose}
      onKeyDown={handleKeyDown}
    >
      <div className="settings-panel no-drag" onClick={e => e.stopPropagation()}>
        <h2>Settings</h2>

        {/* LLM Section */}
        <div className="settings-section">
          <h3>LLM Configuration</h3>

          <div className="settings-field">
            <label>Provider</label>
            <select value={provider} onChange={e => setProvider(e.target.value)}>
              {LLM_PROVIDERS.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {providerDef && providerDef.id !== 'none' && (
            <>
              <div className="settings-field">
                <label>Model</label>
                {providerDef.models.length > 0 ? (
                  <select value={model} onChange={e => setModel(e.target.value)}>
                    {providerDef.models.map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={model}
                    onChange={e => setModel(e.target.value)}
                    placeholder="Model ID"
                  />
                )}
              </div>

              {providerDef.apiKeyRequired && (
                <div className="settings-field">
                  <label>API Key</label>
                  <input
                    type="password"
                    value={apiKey}
                    onChange={e => setApiKey(e.target.value)}
                    placeholder={providerDef.apiKeyPlaceholder}
                  />
                </div>
              )}

              <div className="settings-field">
                <label>Base URL</label>
                <input
                  type="text"
                  value={baseUrl}
                  onChange={e => setBaseUrl(e.target.value)}
                  placeholder={providerDef.baseUrl}
                />
              </div>
            </>
          )}
        </div>

        {/* Chat Section */}
        <div className="settings-section">
          <h3>Chat</h3>
          <div className="settings-field">
            <label>History Turns</label>
            <input
              type="number"
              min={1}
              max={50}
              value={maxHistoryTurns}
              onChange={e => setMaxHistoryTurns(Math.max(1, Math.min(50, Number(e.target.value) || 1)))}
            />
            <span className="settings-hint">Number of conversation turns sent to LLM (1 turn = question + answer)</span>
          </div>
        </div>

        {/* TTS Section */}
        <div className="settings-section">
          <h3>Voice Output (TTS)</h3>
          <div className="settings-field">
            <label>Provider</label>
            <select value={ttsProvider} onChange={e => setTtsProvider(e.target.value as TTSProvider)}>
              {TTS_PROVIDERS.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {(ttsProvider === 'openai-tts' || ttsProvider === 'elevenlabs') && (
            <>
              <div className="settings-field">
                <label>API Key</label>
                <input type="password" value={ttsApiKey} onChange={e => setTtsApiKey(e.target.value)} placeholder="TTS API Key" />
              </div>
              <div className="settings-field">
                <label>Voice</label>
                <input type="text" value={ttsVoice} onChange={e => setTtsVoice(e.target.value)} placeholder={ttsProvider === 'openai-tts' ? 'nova' : 'Voice ID'} />
              </div>
              <div className="settings-field">
                <label>Model</label>
                <input type="text" value={ttsModel} onChange={e => setTtsModel(e.target.value)} placeholder={ttsProvider === 'openai-tts' ? 'tts-1' : 'eleven_multilingual_v2'} />
              </div>
            </>
          )}
        </div>

        {/* Voice Input Section */}
        <div className="settings-section">
          <h3>Voice Input (STT)</h3>
          {voiceSupported ? (
            <>
              <label className="settings-checkbox">
                <input type="checkbox" checked={voiceEnabled} onChange={e => setVoiceEnabled(e.target.checked)} />
                <span>Enable voice input (Whisper)</span>
              </label>
              {voiceEnabled && (
                <div className="settings-field">
                  <label>OpenAI API Key</label>
                  <input type="password" value={voiceApiKey} onChange={e => setVoiceApiKey(e.target.value)} placeholder="sk-..." />
                  <span className="settings-hint">Uses Whisper STT. Can share the same key as LLM.</span>
                </div>
              )}
            </>
          ) : (
            <span className="settings-hint">Voice input is not supported in this browser.</span>
          )}
        </div>

        {/* Window Section */}
        <div className="settings-section">
          <h3>Window</h3>
          <label className="settings-checkbox">
            <input
              type="checkbox"
              checked={alwaysOnTop}
              onChange={e => onToggleAlwaysOnTop(e.target.checked)}
            />
            <span>Always on Top</span>
          </label>
        </div>

        {/* Actions */}
        <div className="settings-actions">
          <button className="settings-cancel-btn" onClick={onClose}>Cancel</button>
          <button className="settings-save-btn" onClick={handleSave}>Save</button>
        </div>
      </div>
    </div>
  )
}
