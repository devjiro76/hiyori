/**
 * Direct LLM chat engine (replaces MolrooPersona).
 *
 * Simple chat interface that calls LLM directly without server-side persona management.
 * Uses adapter.ts for OpenAI-compatible API calls.
 */

import { createDesktopAdapter, type LlmConfig, type Message } from './adapter'
import { HYORI_CONSUMER_SUFFIX } from '../../characters/hyori/persona'
import type { AgentResponse } from '../types'

export interface ChatTurn {
  userMessage: string
  assistantMessage: string
  emotion: AgentResponse['emotion']
}

export interface ChatResult {
  text: string
  response: AgentResponse
}

/**
 * Direct chat engine using LLM adapter.
 */
export class DirectChat {
  private adapter: ReturnType<typeof createDesktopAdapter> | null = null
  private config: LlmConfig

  constructor(config: LlmConfig) {
    this.config = config
    this.adapter = createDesktopAdapter(config)
    if (!this.adapter) {
      throw new Error('LLM adapter not available. Check provider and API key.')
    }
  }

  /**
   * Send a message and get a response.
   */
  async chat(userMessage: string, options?: {
    history?: Array<{ role: 'user' | 'assistant'; content: string }>
  }): Promise<ChatResult> {
    if (!this.adapter) {
      throw new Error('LLM adapter not initialized')
    }

    // Build message history for context
    const messages: Message[] = [
      ...(options?.history ?? []).map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      })),
      { role: 'user' as const, content: userMessage },
    ]

    // System prompt: language instruction in English at top to avoid Korean bias
    const systemPrompt = `You are Hyori, a friendly Live2D desktop mascot.
IMPORTANT: Always reply in the same language the user writes in. If the user writes in English, reply in English. If Korean, reply in Korean.

${HYORI_CONSUMER_SUFFIX}

Respond naturally and warmly. Keep responses concise (1-2 sentences usually).`

    try {
      const result = await this.adapter.generateText({
        system: systemPrompt,
        messages,
        temperature: 0.7,
        maxTokens: 150,
      })

      return {
        text: result.text,
        response: {
          emotion: {
            discrete: { primary: 'contentment', intensity: 0.5 },
            vad: { V: 0.3, A: 0.2, D: 0.3 },
          },
        },
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      console.error('[DirectChat] Error calling LLM:', errorMsg)
      throw new Error(`LLM Error: ${errorMsg}`)
    }
  }

  /**
   * Get current config (for reload detection).
   */
  getConfig(): LlmConfig {
    return this.config
  }
}

/**
 * Factory function to create a DirectChat instance.
 */
export function createDirectChat(config: LlmConfig): DirectChat {
  return new DirectChat(config)
}
