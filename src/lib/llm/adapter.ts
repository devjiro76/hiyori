/**
 * Desktop LLM adapter — direct API calls (no proxy needed).
 *
 * Uses Tauri HTTP plugin to bypass CORS (requests go through Rust).
 * Uses OpenAI-compatible chat completions endpoint for all providers.
 * API key is stored locally via env vars (desktop app = trusted context).
 */

import { fetch } from '@tauri-apps/plugin-http'
import { type ZodType, toJSONSchema } from 'zod'
import { buildLlmRequestConfig } from './request-config'

export interface Message {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface GenerateTextOptions {
  model?: string
  system?: string
  messages: Message[]
  temperature?: number
  maxTokens?: number
}

export interface StreamTextOptions extends GenerateTextOptions {
  onDelta?: (text: string) => void
}

export interface GenerateObjectOptions<T> {
  model?: string
  system?: string
  messages: Message[]
  schema: ZodType<T>
  temperature?: number
}

export interface LLMAdapter {
  generateText(options: GenerateTextOptions): Promise<{ text: string }>
  generateObject<T>(options: GenerateObjectOptions<T>): Promise<{ object: T }>
  streamText(options: StreamTextOptions): Promise<{ text: string }>
}

export interface LlmConfig {
  provider: string
  model?: string
  apiKey?: string
  baseUrl?: string
  maxHistoryTurns?: number
}

function buildMessages(system: string | undefined, messages: Message[]): Message[] {
  const result: Message[] = []
  if (system) result.push({ role: 'system', content: system })
  result.push(...messages)
  return result
}

/**
 * Create an LLMAdapter that calls LLM APIs directly from the desktop app.
 * Returns null if provider is 'none'.
 */
export function createDesktopAdapter(config: LlmConfig): LLMAdapter | null {
  const reqConfig = buildLlmRequestConfig(config)
  if (!reqConfig) return null

  const { modelId, baseUrl, headers } = reqConfig

  return {
    async generateText(options: GenerateTextOptions): Promise<{ text: string }> {
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: modelId,
          messages: buildMessages(options.system, options.messages),
          temperature: options.temperature,
          max_tokens: options.maxTokens,
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: { message: res.statusText } }))
        throw new Error((err as any).error?.message || `API error ${res.status}`)
      }

      const data = await res.json() as any
      return { text: data.choices[0].message.content }
    },

    async streamText(options: StreamTextOptions): Promise<{ text: string }> {
      // Use native fetch for real streaming (Tauri's fetch buffers the response)
      const res = await globalThis.fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: modelId,
          messages: buildMessages(options.system, options.messages),
          temperature: options.temperature,
          max_tokens: options.maxTokens,
          stream: true,
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: { message: res.statusText } }))
        throw new Error((err as any).error?.message || `API error ${res.status}`)
      }

      const reader = res.body?.getReader()
      if (!reader) throw new Error('No response body')

      const decoder = new TextDecoder()
      let full = ''
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed || !trimmed.startsWith('data: ')) continue
          const data = trimmed.slice(6)
          if (data === '[DONE]') continue

          try {
            const parsed = JSON.parse(data) as any
            const delta = parsed.choices?.[0]?.delta?.content
            if (delta) {
              full += delta
              options.onDelta?.(delta)
            }
          } catch { /* skip malformed chunks */ }
        }
      }

      return { text: full }
    },

    async generateObject<T>(options: GenerateObjectOptions<T>): Promise<{ object: T }> {
      const jsonSchema = toJSONSchema(options.schema, { io: 'input' })

      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: modelId,
          messages: buildMessages(options.system, options.messages),
          temperature: options.temperature,
          response_format: {
            type: 'json_schema',
            json_schema: { name: 'response', schema: jsonSchema, strict: true },
          },
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: { message: res.statusText } }))
        throw new Error((err as any).error?.message || `API error ${res.status}`)
      }

      const data = await res.json() as any
      const content = data.choices[0].message.content
      return { object: JSON.parse(content) as T }
    },
  }
}
