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
}

export interface ChatResult {
  text: string
  /** Provided by molroo engine when connected; undefined for direct LLM chat. */
  response?: AgentResponse
}

export interface DynamicContext {
  relationshipLevel?: string
  relationshipSuffix?: string
  userFacts?: string
  ambientContext?: string
  emotionalContext?: string
}

export interface StreamChatOptions {
  history?: Array<{ role: 'user' | 'assistant'; content: string }>
  onDelta?: (text: string) => void
  dynamicContext?: DynamicContext
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

  private buildSystemPrompt(ctx?: DynamicContext): string {
    const sections = [
      `You are Hyori, a friendly Live2D desktop mascot.
IMPORTANT: Always reply in the same language the user writes in. If the user writes in English, reply in English. If Korean, reply in Korean.`,
      HYORI_CONSUMER_SUFFIX,
    ]

    if (ctx?.relationshipSuffix) sections.push(ctx.relationshipSuffix)
    if (ctx?.userFacts) sections.push(`## What You Know About the User\n${ctx.userFacts}`)
    if (ctx?.emotionalContext) sections.push(`## Your Current Mood\n${ctx.emotionalContext}`)
    if (ctx?.ambientContext) sections.push(`## Current Context\n${ctx.ambientContext}`)

    sections.push('Respond naturally and warmly. Keep responses concise (1-2 sentences usually).')
    return sections.join('\n\n')
  }

  /**
   * Send a message and get a response.
   */
  async chat(userMessage: string, options?: {
    history?: Array<{ role: 'user' | 'assistant'; content: string }>
    dynamicContext?: DynamicContext
  }): Promise<ChatResult> {
    if (!this.adapter) {
      throw new Error('LLM adapter not initialized')
    }

    const messages: Message[] = [
      ...(options?.history ?? []).map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      })),
      { role: 'user' as const, content: userMessage },
    ]

    const systemPrompt = this.buildSystemPrompt(options?.dynamicContext)

    try {
      const result = await this.adapter.generateText({
        system: systemPrompt,
        messages,
        temperature: 0.7,
        maxTokens: 150,
      })

      return { text: result.text }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      console.error('[DirectChat] Error calling LLM:', errorMsg)
      throw new Error(`LLM Error: ${errorMsg}`)
    }
  }

  /**
   * Send a message and get a streaming response.
   */
  async streamChat(userMessage: string, options?: StreamChatOptions): Promise<ChatResult> {
    if (!this.adapter) {
      throw new Error('LLM adapter not initialized')
    }

    const messages: Message[] = [
      ...(options?.history ?? []).map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      })),
      { role: 'user' as const, content: userMessage },
    ]

    const systemPrompt = this.buildSystemPrompt(options?.dynamicContext)

    try {
      const result = await this.adapter.streamText({
        system: systemPrompt,
        messages,
        temperature: 0.7,
        maxTokens: 150,
        onDelta: options?.onDelta,
      })

      return { text: result.text }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      console.error('[DirectChat] Stream error:', errorMsg)
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
