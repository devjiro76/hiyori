import { useState, useEffect } from 'react'
import { LLM_PROVIDERS } from '../lib/llm/providers'
import type { LlmConfig } from '../lib/llm/adapter'
import './SettingsPanel.css'

interface SettingsPanelProps {
  llmConfig: LlmConfig
  onSave: (llm: LlmConfig) => void
  onClose: () => void
  alwaysOnTop: boolean
  onToggleAlwaysOnTop: (value: boolean) => void
}

export function SettingsPanel({
  llmConfig,
  onSave,
  onClose,
  alwaysOnTop,
  onToggleAlwaysOnTop,
}: SettingsPanelProps) {
  const [provider, setProvider] = useState(llmConfig.provider)
  const [model, setModel] = useState(llmConfig.model ?? '')
  const [apiKey, setApiKey] = useState(llmConfig.apiKey ?? '')
  const [baseUrl, setBaseUrl] = useState(llmConfig.baseUrl ?? '')

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
    onSave({ provider, model, apiKey: apiKey || undefined, baseUrl: baseUrl || undefined })
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
