/**
 * TTS adapter — text-to-speech with multiple providers.
 *
 * Supports:
 * - Web Speech API (built-in, free, no API key)
 * - OpenAI TTS API
 * - ElevenLabs API
 */

import { fetch } from '@tauri-apps/plugin-http'

export type TTSProvider = 'none' | 'web-speech' | 'openai-tts' | 'elevenlabs'

export interface TTSConfig {
  provider: TTSProvider
  apiKey?: string
  voice?: string
  model?: string
  baseUrl?: string
}

export interface TTSAdapter {
  speak(text: string): Promise<void>
  stop(): void
}

function createWebSpeechAdapter(config: TTSConfig): TTSAdapter {
  let utterance: SpeechSynthesisUtterance | null = null

  return {
    async speak(text: string) {
      speechSynthesis.cancel()
      utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = /[가-힣]/.test(text) ? 'ko-KR' : 'en-US'
      if (config.voice) {
        const voices = speechSynthesis.getVoices()
        const match = voices.find(v => v.name.includes(config.voice!))
        if (match) utterance.voice = match
      }
      utterance.rate = 1.0
      utterance.pitch = 1.0
      speechSynthesis.speak(utterance)

      return new Promise<void>((resolve) => {
        utterance!.onend = () => resolve()
        utterance!.onerror = () => resolve()
      })
    },
    stop() {
      speechSynthesis.cancel()
    },
  }
}

function createOpenAITTSAdapter(config: TTSConfig): TTSAdapter {
  let audioEl: HTMLAudioElement | null = null

  return {
    async speak(text: string) {
      if (audioEl) { audioEl.pause(); audioEl = null }

      const baseUrl = config.baseUrl || 'https://api.openai.com/v1'
      const res = await fetch(`${baseUrl}/audio/speech`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model: config.model || 'tts-1',
          input: text,
          voice: config.voice || 'nova',
          response_format: 'mp3',
        }),
      })

      if (!res.ok) throw new Error(`TTS API error: ${res.status}`)

      const blob = new Blob([await res.arrayBuffer()], { type: 'audio/mpeg' })
      const url = URL.createObjectURL(blob)
      audioEl = new Audio(url)

      return new Promise<void>((resolve) => {
        audioEl!.onended = () => { URL.revokeObjectURL(url); resolve() }
        audioEl!.onerror = () => { URL.revokeObjectURL(url); resolve() }
        audioEl!.play()
      })
    },
    stop() {
      if (audioEl) { audioEl.pause(); audioEl = null }
    },
  }
}

function createElevenLabsAdapter(config: TTSConfig): TTSAdapter {
  let audioEl: HTMLAudioElement | null = null

  return {
    async speak(text: string) {
      if (audioEl) { audioEl.pause(); audioEl = null }

      const voiceId = config.voice || '21m00Tcm4TlvDq8ikWAM'
      const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': config.apiKey || '',
        },
        body: JSON.stringify({
          text,
          model_id: config.model || 'eleven_multilingual_v2',
        }),
      })

      if (!res.ok) throw new Error(`ElevenLabs API error: ${res.status}`)

      const blob = new Blob([await res.arrayBuffer()], { type: 'audio/mpeg' })
      const url = URL.createObjectURL(blob)
      audioEl = new Audio(url)

      return new Promise<void>((resolve) => {
        audioEl!.onended = () => { URL.revokeObjectURL(url); resolve() }
        audioEl!.onerror = () => { URL.revokeObjectURL(url); resolve() }
        audioEl!.play()
      })
    },
    stop() {
      if (audioEl) { audioEl.pause(); audioEl = null }
    },
  }
}

export function createTTSAdapter(config: TTSConfig): TTSAdapter | null {
  switch (config.provider) {
    case 'web-speech': return createWebSpeechAdapter(config)
    case 'openai-tts': return createOpenAITTSAdapter(config)
    case 'elevenlabs': return createElevenLabsAdapter(config)
    default: return null
  }
}
