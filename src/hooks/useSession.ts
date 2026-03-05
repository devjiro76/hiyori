import { useState, useCallback, useRef } from 'react'
import { createDirectChat, type DirectChat, type ChatResult, type DynamicContext } from '../lib/llm/direct-chat'
import type { LlmConfig } from '../lib/llm/adapter'
import { routeAgentRequest, type ConfirmFn, type ToolStatusFn, type ToolResult } from '../lib/agent'
import { createMolrooClient, type MolrooClient } from '../lib/molroo/client'
import type { MolrooConfig } from '../components/SettingsPanel'
import { DEFAULT_MAX_HISTORY_TURNS } from '../lib/constants'
import { recordInteraction, applyDecay, getDaysSinceFirst } from '../lib/relationship/engine'
import { checkMilestones } from '../lib/relationship/milestones'
import { getRelationship, type RelationshipData } from '../lib/db/relationship'
import { getFactsForPrompt } from '../lib/db/user-facts'
import { extractAndSaveFacts } from '../lib/llm/fact-extractor'
import { getPersonaSuffix } from '../characters/hyori/persona'

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

export interface Milestone {
  type: string
  value: string
  message: string
  emotion: string
}

export interface AmbientContextInput {
  currentApp: string | null
  timeOfDay: string
  hourOfDay: number
  idleMinutes: number
}

export interface EmotionContextInput {
  emotion: string
  intensity: number
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

const LS_MOLROO = 'tauri-hyori-molroo-config'

function loadMolrooConfig(): MolrooConfig {
  try {
    const raw = localStorage.getItem(LS_MOLROO)
    if (raw) return JSON.parse(raw) as MolrooConfig
  } catch { /* ignore */ }
  return { enabled: false }
}

async function buildDynamicContext(
  ambientInput?: AmbientContextInput | null,
  emotionInput?: EmotionContextInput | null,
): Promise<DynamicContext> {
  const ctx: DynamicContext = {}

  try {
    // Relationship
    const rel = await getRelationship()
    ctx.relationshipLevel = rel.level

    // User facts for prompt
    const facts = await getFactsForPrompt(500)

    // Find user name from facts
    let userName: string | undefined
    if (facts.includes('name:')) {
      const match = facts.match(/name:\s*(.+)/)
      if (match) userName = match[1].trim()
    }

    ctx.relationshipSuffix = getPersonaSuffix(rel.level, userName, rel.streakDays)
    if (facts) ctx.userFacts = facts

    // Ambient context
    if (ambientInput) {
      const parts: string[] = []
      if (ambientInput.currentApp) parts.push(`User is currently using ${ambientInput.currentApp}.`)
      parts.push(`It's ${ambientInput.timeOfDay} (${ambientInput.hourOfDay}:00).`)
      if (ambientInput.idleMinutes > 5) parts.push(`User has been idle for ${ambientInput.idleMinutes} minutes.`)

      const rel2 = await getRelationship()
      const days = getDaysSinceFirst(rel2.firstInteraction)
      if (days > 1) parts.push(`Today is interaction day #${days} (streak: ${rel2.streakDays} days).`)

      ctx.ambientContext = parts.join(' ')
    }

    // Emotional context
    if (emotionInput && emotionInput.emotion !== 'calm') {
      ctx.emotionalContext = `Your current mood is ${emotionInput.emotion} (intensity: ${emotionInput.intensity.toFixed(2)}). Respond in a way consistent with this mood.`
    }
  } catch (err) {
    console.warn('[useSession] buildDynamicContext error:', err)
  }

  return ctx
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
  const [molrooConfig, setMolrooConfigState] = useState<MolrooConfig>(loadMolrooConfig)
  const [pendingMilestones, setPendingMilestones] = useState<Milestone[]>([])
  const [relationshipData, setRelationshipData] = useState<RelationshipData | null>(null)
  const turnIdRef = useRef(0)
  const chatRef = useRef<DirectChat | null>(null)
  const molrooRef = useRef<MolrooClient | null>(null)
  const molrooKeyRef = useRef<string>('')
  const appliedConfigRef = useRef<string>('')
  const ambientRef = useRef<AmbientContextInput | null>(null)
  const emotionRef = useRef<EmotionContextInput | null>(null)

  const setLlmConfig = useCallback((config: LlmConfig) => {
    setLlmConfigState(config)
    saveLlmConfig(config)
  }, [])

  const setMolrooConfig = useCallback((config: MolrooConfig) => {
    setMolrooConfigState(config)
    localStorage.setItem(LS_MOLROO, JSON.stringify(config))
  }, [])

  const setAmbientContext = useCallback((ctx: AmbientContextInput) => {
    ambientRef.current = ctx
  }, [])

  const setEmotionContext = useCallback((ctx: EmotionContextInput) => {
    emotionRef.current = ctx
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

      // Apply relationship decay on session start
      try {
        await applyDecay()
        const rel = await getRelationship()
        setRelationshipData(rel)
      } catch { /* DB not ready — ok */ }
    } catch (err) {
      console.error('[useSession] createSession error:', err)
      const msg = err instanceof Error ? err.message : 'Failed to create session'
      setSession({ status: 'error', error: msg })
    }
  }, [llmConfig])

  const consumeMilestones = useCallback((): Milestone[] => {
    const ms = pendingMilestones
    setPendingMilestones([])
    return ms
  }, [pendingMilestones])

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

      // Build conversation history
      const maxTurns = llmConfig.maxHistoryTurns ?? DEFAULT_MAX_HISTORY_TURNS
      const recentTurns = turnHistory.slice(-maxTurns)
      const history = recentTurns.map(t => [
        { role: 'user' as const, content: t.userMessage },
        { role: 'assistant' as const, content: t.result.text },
      ]).flat()

      // Agent routing
      let agentMessage = message
      const agentResult = await routeAgentRequest(llmConfig, message, history, confirmFn, onToolStatus)
      if (agentResult.toolsUsed) {
        setLastToolResults(agentResult.toolResults)
        agentMessage = `${message}\n\n[Desktop action results]\n${agentResult.toolContext}`
      } else {
        setLastToolResults([])
      }

      // Build dynamic context
      const dynamicContext = await buildDynamicContext(
        ambientRef.current,
        emotionRef.current,
      )

      // Get LLM response (streaming)
      setStreamingText('')
      const chatResult = await chat.streamChat(agentMessage, {
        history,
        onDelta: (delta) => setStreamingText(prev => (prev ?? '') + delta),
        dynamicContext,
      })
      setStreamingText(null)

      // Molroo emotion processing (non-blocking)
      if (molrooConfig.enabled && molrooConfig.apiKey) {
        try {
          if (!molrooRef.current || molrooKeyRef.current !== molrooConfig.apiKey) {
            molrooRef.current = await createMolrooClient(molrooConfig.apiKey)
            molrooKeyRef.current = molrooConfig.apiKey
          }
          const agentResponse = await molrooRef.current.perceive(message, chatResult.text)
          chatResult.response = agentResponse
        } catch (err) {
          console.warn('[useSession] Molroo perceive failed:', err)
        }
      }

      // Relationship update (non-blocking)
      try {
        const update = await recordInteraction()
        setRelationshipData(update.data)
        const milestones = await checkMilestones(
          update.data, update.levelChanged, update.previousLevel,
        )
        if (milestones.length > 0) {
          setPendingMilestones(prev => [...prev, ...milestones])
        }
      } catch (err) {
        console.warn('[useSession] Relationship update failed:', err)
      }

      // Fact extraction (non-blocking, fire-and-forget)
      extractAndSaveFacts(llmConfig, message, chatResult.text).catch(() => {})

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
  }, [session.status, isProcessing, llmConfig, turnHistory, molrooConfig, confirmFn, onToolStatus])

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
    molrooConfig,
    setMolrooConfig,
    turnHistory,
    isProcessing,
    streamingText,
    lastToolResults,
    createSession,
    sendMessage,
    reset,
    setAmbientContext,
    setEmotionContext,
    consumeMilestones,
    relationshipData,
  }
}
