/**
 * Lightweight LLM-based user fact extraction.
 * After each conversation turn, extracts key facts about the user.
 */

import { createDesktopAdapter, type LlmConfig } from './adapter'
import { upsertFact } from '../db/user-facts'

const EXTRACTION_PROMPT = `You are a fact extractor. Given a conversation between a user and assistant, extract any NEW factual information about the user.

Output ONLY a JSON array of objects with these fields:
- "category": one of "identity", "preference", "habit", "work", "interest", "relationship", "other"
- "key": short descriptive key (e.g., "name", "favorite_language", "job")
- "value": the extracted value

If no new facts are found, output an empty array: []

Rules:
- Only extract FACTUAL statements, not opinions or guesses
- Only extract information ABOUT THE USER, not about the assistant
- Keep values concise
- Do not extract greetings or pleasantries as facts`

interface ExtractedFact {
  category: string
  key: string
  value: string
}

export async function extractAndSaveFacts(
  config: LlmConfig,
  userMessage: string,
  assistantReply: string,
): Promise<void> {
  try {
    const adapter = createDesktopAdapter(config)
    if (!adapter) return

    const result = await adapter.generateText({
      system: EXTRACTION_PROMPT,
      messages: [
        { role: 'user', content: `User: ${userMessage}\nAssistant: ${assistantReply}` },
      ],
      temperature: 0.1,
      maxTokens: 200,
    })

    const text = result.text.trim()
    // Extract JSON array from response (handle markdown code blocks)
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    if (!jsonMatch) return

    const facts: ExtractedFact[] = JSON.parse(jsonMatch[0])
    if (!Array.isArray(facts) || facts.length === 0) return

    for (const fact of facts) {
      if (fact.category && fact.key && fact.value) {
        await upsertFact(fact.category, fact.key, fact.value)
      }
    }
  } catch {
    // Non-critical — silently ignore extraction failures
  }
}
