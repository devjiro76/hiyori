/**
 * Shared LLM request configuration builder.
 *
 * Both adapter.ts and router.ts need to resolve provider → (modelId, baseUrl, headers).
 * This module centralizes that logic.
 */

import type { LlmConfig } from './adapter'
import { getProvider } from './providers'

export interface LlmRequestConfig {
  modelId: string
  baseUrl: string
  headers: Record<string, string>
}

/**
 * Resolve an LlmConfig into concrete request parameters.
 * Returns null if provider is 'none' or unresolvable.
 */
export function buildLlmRequestConfig(config: LlmConfig): LlmRequestConfig | null {
  if (config.provider === 'none') return null

  const providerDef = getProvider(config.provider)
  if (!providerDef) return null

  const modelId = config.model || providerDef.defaultModel
  if (!modelId) return null

  const baseUrl = config.baseUrl || providerDef.baseUrl
  const apiKey = config.apiKey || import.meta.env.VITE_LLM_API_KEY || ''

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    ...(providerDef.headers ?? {}),
  }

  return { modelId, baseUrl, headers }
}
