import { getDB } from './index'

export interface UserFact {
  id: string
  category: string
  key: string
  value: string
  confidence: number
  updatedAt: number
}

export async function getUserFacts(): Promise<UserFact[]> {
  const db = await getDB()
  const rows = await db.select<{
    id: string; category: string; key: string; value: string
    confidence: number; updated_at: number
  }[]>('SELECT * FROM user_facts ORDER BY confidence DESC, updated_at DESC')
  return rows.map(r => ({
    id: r.id, category: r.category, key: r.key,
    value: r.value, confidence: r.confidence, updatedAt: r.updated_at,
  }))
}

export async function upsertFact(
  category: string, key: string, value: string, confidence = 1.0,
): Promise<void> {
  const db = await getDB()
  const now = Date.now()
  const existing = await db.select<{ id: string }[]>(
    'SELECT id FROM user_facts WHERE category = $1 AND key = $2',
    [category, key],
  )
  if (existing.length > 0) {
    await db.execute(
      'UPDATE user_facts SET value = $1, confidence = $2, updated_at = $3 WHERE id = $4',
      [value, confidence, now, existing[0].id],
    )
  } else {
    await db.execute(
      'INSERT INTO user_facts (id, category, key, value, confidence, updated_at) VALUES ($1, $2, $3, $4, $5, $6)',
      [crypto.randomUUID(), category, key, value, confidence, now],
    )
  }
}

export async function getFactsForPrompt(maxTokenBudget = 500): Promise<string> {
  const facts = await getUserFacts()
  if (facts.length === 0) return ''

  const lines: string[] = []
  let charCount = 0
  for (const fact of facts) {
    const line = `- ${fact.key}: ${fact.value}`
    if (charCount + line.length > maxTokenBudget * 3) break
    lines.push(line)
    charCount += line.length
  }
  return lines.join('\n')
}
