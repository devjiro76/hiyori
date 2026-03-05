import { useState, useCallback, useRef } from 'react'
import { createDirectChat, type DirectChat, type ChatResult } from '../lib/llm/direct-chat'
import type { LlmConfig } from '../lib/llm/adapter'
import { routeAgentRequest, type ConfirmFn, type ToolStatusFn, type ToolResult } from '../lib/agent'
import { DEFAULT_MAX_HISTORY_TURNS } from '../lib/constants'

export type { LlmConfig } from '../lib/llm/adapter'

export interface SessionState {
  status: 'idle' | 'creating' | 'active' | 'error'
  error: string | null
}

export interface TurnEntry {
  id: number
  userMessage: string
  result: ChatResult
  timestamp: number
}

const INITIAL_SESSION: SessionState = {
  status: 'idle',
  error: null,
}

const LS_KEY = 'tauri-hyori-llm-config'
const DEFAULT_LLM_PROVIDER = import.meta.env.VITE_LLM_PROVIDER ?? 'none'
const DEFAULT_LLM_MODEL = import.meta.env.VITE_LLM_MODEL ?? ''

function loadLlmConfig(): LlmConfig {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (raw) {
      const saved = JSON.parse(raw) as Partial<LlmConfig>
      return {
        provider: saved.provider ?? DEFAULT_LLM_PROVIDER,
        model: saved.model ?? DEFAULT_LLM_MODEL,
        apiKey: saved.apiKey,
        baseUrl: saved.baseUrl,
        maxHistoryTurns: saved.maxHistoryTurns,
      }
    }
  } catch { /* ignore */ }
  return { provider: DEFAULT_LLM_PROVIDER, model: DEFAULT_LLM_MODEL }
}

function saveLlmConfig(config: LlmConfig) {
  localStorage.setItem(LS_KEY, JSON.stringify(config))
}

export function useSession(
  confirmFn?: ConfirmFn,
  onToolStatus?: ToolStatusFn,
) {
  const [session, setSession] = useState<SessionState>(INITIAL_SESSION)
  const [llmConfig, setLlmConfigState] = useState<LlmConfig>(loadLlmConfig)
  const [turnHistory, setTurnHistory] = useState<TurnEntry[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [lastToolResults, setLastToolResults] = useState<ToolResult[]>([])
  const [streamingText, setStreamingText] = useState<string | null>(null)
  const turnIdRef = useRef(0)
  const chatRef = useRef<DirectChat | null>(null)
  const appliedConfigRef = useRef<string>('')

  const setLlmConfig = useCallback((config: LlmConfig) => {
    setLlmConfigState(config)
    saveLlmConfig(config)
  }, [])

  const createSession = useCallback(async () => {
    setSession({ status: 'creating', error: null })
    try {
      if (llmConfig.provider === 'none') {
        throw new Error('Please configure LLM Provider and API Key')
      }

      const chat = createDirectChat(llmConfig)
      chatRef.current = chat
      setSession({ status: 'active', error: null })
      setTurnHistory([])
      turnIdRef.current = 0
      appliedConfigRef.current = JSON.stringify(llmConfig)
    } catch (err) {
      console.error('[useSession] createSession error:', err)
      const msg = err instanceof Error ? err.message : 'Failed to create session'
      setSession({ status: 'error', error: msg })
    }
  }, [llmConfig])

  const sendMessage = useCallback(async (message: string): Promise<{
    result: ChatResult
    displayText: string
  } | { error: string } | null> => {
    if (session.status !== 'active' || !chatRef.current || isProcessing) return null
    setIsProcessing(true)
    try {
      // Recreate chat if config changed
      const configKey = JSON.stringify(llmConfig)
      if (configKey !== appliedConfigRef.current) {
        if (llmConfig.provider === 'none') {
          throw new Error('LLM not configured')
        }
        chatRef.current = createDirectChat(llmConfig)
        appliedConfigRef.current = configKey
      }

      const chat = chatRef.current
      if (!chat) throw new Error('Chat not initialized')

      // Build conversation history (limited by maxHistoryTurns)
      const maxTurns = llmConfig.maxHistoryTurns ?? DEFAULT_MAX_HISTORY_TURNS
      const recentTurns = turnHistory.slice(-maxTurns)
      const history = recentTurns.map(t => [
        { role: 'user' as const, content: t.userMessage },
        { role: 'assistant' as const, content: t.result.text },
      ]).flat()

      // Agent routing: check if user wants a desktop action
      let agentMessage = message
      const agentResult = await routeAgentRequest(llmConfig, message, history, confirmFn, onToolStatus)
      if (agentResult.toolsUsed) {
        setLastToolResults(agentResult.toolResults)
        agentMessage = `${message}\n\n[Desktop action results]\n${agentResult.toolContext}`
      } else {
        setLastToolResults([])
      }

      // Get LLM response (streaming)
      setStreamingText('')
      const chatResult = await chat.streamChat(agentMessage, {
        history,
        onDelta: (delta) => setStreamingText(prev => (prev ?? '') + delta),
      })
      setStreamingText(null)

      const entry: TurnEntry = {
        id: ++turnIdRef.current,
        userMessage: message,
        result: chatResult,
        timestamp: Date.now(),
      }
      setTurnHistory(prev => [...prev, entry])

      return { result: chatResult, displayText: chatResult.text }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to process message'
      console.error('[useSession] sendMessage error:', msg, err)
      setSession({ status: 'error', error: msg })
      return { error: msg }
    } finally {
      setIsProcessing(false)
    }
  }, [session.status, isProcessing, llmConfig, turnHistory, confirmFn, onToolStatus])

  const reset = useCallback(() => {
    chatRef.current = null
    setSession(INITIAL_SESSION)
    setTurnHistory([])
    turnIdRef.current = 0
  }, [])

  return {
    session,
    llmConfig,
    setLlmConfig,
    turnHistory,
    isProcessing,
    streamingText,
    lastToolResults,
    createSession,
    sendMessage,
    reset,
  }
}
