/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useRef, useCallback, useEffect } from 'react'
import { fetch as tauriFetch } from '@tauri-apps/plugin-http'

export interface VoiceInputConfig {
  enabled: boolean
  language?: string
  apiKey?: string // OpenAI key for Whisper fallback
}

const LS_KEY = 'tauri-hyori-voice-config'

function loadConfig(): VoiceInputConfig {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (raw) return JSON.parse(raw) as VoiceInputConfig
  } catch { /* ignore */ }
  return { enabled: false }
}

function saveConfig(config: VoiceInputConfig) {
  localStorage.setItem(LS_KEY, JSON.stringify(config))
}

// ── Web Speech API helpers ──

function tryWebSpeech(): boolean {
  const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
  return !!SR
}

function createRecognition(lang: string): any | null {
  const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
  if (!SR) return null
  const r = new SR()
  r.continuous = true
  r.interimResults = false
  r.lang = lang
  return r
}

// ── Whisper (MediaRecorder + VAD) helpers ──

const SPEECH_THRESHOLD = 25
const SILENCE_DURATION_MS = 1500
const MIN_RECORDING_MS = 600

/**
 * Voice input hook.
 * 1) Try Web Speech API (free, needs macOS permissions)
 * 2) Fall back to MediaRecorder + Whisper API if apiKey is provided
 */
export function useVoiceInput(onTranscript: (text: string) => void) {
  const [config, setConfigState] = useState<VoiceInputConfig>(loadConfig)
  const [isListening, setIsListening] = useState(false)
  const [isSupported, setIsSupported] = useState(false)
  const [mode, setMode] = useState<'none' | 'web-speech' | 'whisper'>('none')
  const onTranscriptRef = useRef(onTranscript)
  onTranscriptRef.current = onTranscript
  const configRef = useRef(config)
  configRef.current = config

  // Web Speech refs
  const recognitionRef = useRef<any>(null)

  // Whisper/VAD refs
  const streamRef = useRef<MediaStream | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const recordingRef = useRef(false)
  const recordStartRef = useRef(0)
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const rafRef = useRef(0)

  useEffect(() => {
    // Supported if Web Speech API exists OR getUserMedia works (for Whisper)
    setIsSupported(tryWebSpeech() || !!navigator.mediaDevices?.getUserMedia)
  }, [])

  const setConfig = useCallback((cfg: VoiceInputConfig) => {
    setConfigState(cfg)
    saveConfig(cfg)
  }, [])

  // ── Whisper transcription ──

  const transcribe = useCallback(async (blob: Blob) => {
    const apiKey = configRef.current.apiKey
    if (!apiKey) return

    try {
      const boundary = '----VoiceBoundary' + Math.random().toString(36).slice(2)
      const audioBytes = new Uint8Array(await blob.arrayBuffer())
      const enc = new TextEncoder()
      const parts: Uint8Array[] = []

      parts.push(enc.encode(
        `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="audio.webm"\r\nContent-Type: ${blob.type}\r\n\r\n`
      ))
      parts.push(audioBytes)
      parts.push(enc.encode('\r\n'))
      parts.push(enc.encode(
        `--${boundary}\r\nContent-Disposition: form-data; name="model"\r\n\r\nwhisper-1\r\n`
      ))
      const lang = configRef.current.language || 'ko'
      parts.push(enc.encode(
        `--${boundary}\r\nContent-Disposition: form-data; name="language"\r\n\r\n${lang}\r\n`
      ))
      parts.push(enc.encode(`--${boundary}--\r\n`))

      const totalLen = parts.reduce((s, p) => s + p.length, 0)
      const body = new Uint8Array(totalLen)
      let offset = 0
      for (const p of parts) { body.set(p, offset); offset += p.length }

      const res = await tauriFetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
        },
        body,
      })

      if (!res.ok) {
        console.error('[VoiceInput] Whisper error:', res.status)
        return
      }

      const data = await res.json() as { text: string }
      const text = data.text?.trim()
      if (text) onTranscriptRef.current(text)
    } catch (err) {
      console.error('[VoiceInput] Whisper failed:', err)
    }
  }, [])

  // ── VAD loop ──

  const startVAD = useCallback(() => {
    if (!analyserRef.current) return
    const analyser = analyserRef.current
    const buf = new Uint8Array(analyser.fftSize)

    function tick() {
      if (!analyserRef.current) return
      analyser.getByteTimeDomainData(buf)

      let sum = 0
      for (let i = 0; i < buf.length; i++) {
        const v = (buf[i] - 128) / 128
        sum += v * v
      }
      const rms = Math.sqrt(sum / buf.length) * 100

      if (rms > SPEECH_THRESHOLD) {
        if (!recordingRef.current && recorderRef.current?.state !== 'recording') {
          chunksRef.current = []
          recorderRef.current?.start()
          recordingRef.current = true
          recordStartRef.current = Date.now()
        }
        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current)
          silenceTimerRef.current = undefined
        }
      } else if (recordingRef.current && !silenceTimerRef.current) {
        silenceTimerRef.current = setTimeout(() => {
          if (recordingRef.current && recorderRef.current?.state === 'recording') {
            recorderRef.current.stop()
          }
          recordingRef.current = false
          silenceTimerRef.current = undefined
        }, SILENCE_DURATION_MS)
      }

      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
  }, [])

  // ── Start: try Web Speech first, then Whisper ──

  const startWebSpeech = useCallback(() => {
    const lang = configRef.current.language || 'ko-KR'
    const recognition = createRecognition(lang)
    if (!recognition) return false

    let started = false

    recognition.onresult = (event: any) => {
      const last = event.results[event.results.length - 1]
      if (last.isFinal) {
        const text = last[0].transcript.trim()
        if (text) onTranscriptRef.current(text)
      }
    }

    recognition.onerror = (event: any) => {
      console.warn('[VoiceInput] Web Speech error:', event.error)
      if (!started) {
        // Failed to start — will fall back to Whisper
        setIsListening(false)
        setMode('none')
      } else if (event.error !== 'no-speech') {
        setIsListening(false)
      }
    }

    recognition.onend = () => {
      if (recognitionRef.current === recognition && configRef.current.enabled) {
        try { recognition.start() } catch { setIsListening(false) }
      } else {
        setIsListening(false)
      }
    }

    try {
      recognitionRef.current = recognition
      recognition.start()
      started = true
      setIsListening(true)
      setMode('web-speech')
      console.log('[VoiceInput] Using Web Speech API')
      return true
    } catch (err) {
      console.warn('[VoiceInput] Web Speech start failed:', err)
      recognitionRef.current = null
      return false
    }
  }, [])

  const startWhisper = useCallback(async () => {
    if (!configRef.current.apiKey) {
      console.warn('[VoiceInput] No API key for Whisper fallback')
      return false
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      const ctx = new AudioContext()
      audioCtxRef.current = ctx
      const source = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 2048
      source.connect(analyser)
      analyserRef.current = analyser

      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm'
        : MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4'
        : ''
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      recorderRef.current = recorder

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      recorder.onstop = () => {
        if (chunksRef.current.length > 0) {
          const dur = Date.now() - recordStartRef.current
          if (dur >= MIN_RECORDING_MS) {
            const blob = new Blob(chunksRef.current, { type: recorder.mimeType })
            transcribe(blob)
          }
          chunksRef.current = []
        }
      }

      setIsListening(true)
      setMode('whisper')
      startVAD()
      console.log('[VoiceInput] Using Whisper API')
      return true
    } catch (err) {
      console.error('[VoiceInput] Mic access failed:', err)
      return false
    }
  }, [startVAD, transcribe])

  const startListening = useCallback(async () => {
    // Try Web Speech API first (free)
    if (tryWebSpeech()) {
      const ok = startWebSpeech()
      if (ok) return
    }

    // Fall back to Whisper if API key available
    await startWhisper()
  }, [startWebSpeech, startWhisper])

  // ── Stop ──

  const stopListening = useCallback(() => {
    // Stop Web Speech
    if (recognitionRef.current) {
      const ref = recognitionRef.current
      recognitionRef.current = null
      ref.stop()
    }

    // Stop Whisper/VAD
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
    recorderRef.current = null
    audioCtxRef.current?.close()
    audioCtxRef.current = null
    analyserRef.current = null
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    recordingRef.current = false

    setIsListening(false)
    setMode('none')
  }, [])

  // Auto-start/stop
  useEffect(() => {
    if (config.enabled && isSupported) {
      startListening()
    } else {
      stopListening()
    }
    return () => stopListening()
  }, [config.enabled, isSupported, startListening, stopListening])

  return {
    voiceConfig: config,
    setVoiceConfig: setConfig,
    isListening,
    isSupported,
    mode,
    startListening,
    stopListening,
  }
}
