/**
 * Lightweight molroo API client for emotion processing.
 * Calls the molroo perceive endpoint directly without the full SDK.
 */

import { fetch } from '@tauri-apps/plugin-http'
import { HYORI_CONFIG } from '../../characters/hyori/persona'
import type { AgentResponse } from '../types'

const BASE_URL = 'https://api.molroo.io'
const LS_PERSONA_ID = 'tauri-hyori-molroo-persona-id'

export interface MolrooClient {
  perceive(userMessage: string, assistantReply: string): Promise<AgentResponse>
  personaId: string
}

/**
 * Ensure a Hyori persona exists on the molroo API.
 * Creates one if no stored persona ID, otherwise reuses.
 */
async function ensurePersona(apiKey: string): Promise<string> {
  const stored = localStorage.getItem(LS_PERSONA_ID)
  if (stored) {
    // Verify it still exists
    const res = await fetch(`${BASE_URL}/personas/${stored}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    })
    if (res.ok) return stored
    // If not found, create a new one
    localStorage.removeItem(LS_PERSONA_ID)
  }

  const res = await fetch(`${BASE_URL}/personas`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': crypto.randomUUID(),
    },
    body: JSON.stringify({ config: HYORI_CONFIG }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Failed to create persona: ${res.status} ${text}`)
  }

  const data = await res.json() as { result: { id: string } }
  const id = data.result.id
  localStorage.setItem(LS_PERSONA_ID, id)
  return id
}

/**
 * Create a molroo client for emotion processing.
 */
export async function createMolrooClient(apiKey: string): Promise<MolrooClient> {
  const personaId = await ensurePersona(apiKey)

  return {
    personaId,
    async perceive(userMessage: string, assistantReply: string): Promise<AgentResponse> {
      const res = await fetch(`${BASE_URL}/personas/${personaId}/perceive`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          event: {
            type: 'chat_message',
            timestamp: Date.now(),
            sourceEntity: 'user',
            payload: { message: userMessage },
          },
          context: { reply: assistantReply },
        }),
      })

      if (!res.ok) {
        const text = await res.text()
        throw new Error(`Perceive failed: ${res.status} ${text}`)
      }

      const data = await res.json() as { result: AgentResponse }
      return data.result
    },
  }
}
