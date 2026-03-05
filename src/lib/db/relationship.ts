import { getDB } from './index'

export interface RelationshipData {
  score: number
  level: string
  totalMessages: number
  firstInteraction: number | null
  lastInteraction: number | null
  streakDays: number
  lastStreakDate: string | null
  updatedAt: number
}

const DEFAULT: RelationshipData = {
  score: 0, level: 'stranger', totalMessages: 0,
  firstInteraction: null, lastInteraction: null,
  streakDays: 0, lastStreakDate: null, updatedAt: Date.now(),
}

export async function getRelationship(): Promise<RelationshipData> {
  const db = await getDB()
  const rows = await db.select<{
    score: number; level: string; total_messages: number
    first_interaction: number | null; last_interaction: number | null
    streak_days: number; last_streak_date: string | null; updated_at: number
  }[]>('SELECT * FROM relationship WHERE id = $1', ['singleton'])

  if (rows.length === 0) return { ...DEFAULT }
  const r = rows[0]
  return {
    score: r.score, level: r.level, totalMessages: r.total_messages,
    firstInteraction: r.first_interaction, lastInteraction: r.last_interaction,
    streakDays: r.streak_days, lastStreakDate: r.last_streak_date,
    updatedAt: r.updated_at,
  }
}

export async function updateRelationship(data: Partial<RelationshipData>): Promise<void> {
  const db = await getDB()
  const current = await getRelationship()
  const merged = { ...current, ...data, updatedAt: Date.now() }

  const exists = (await db.select<{ id: string }[]>(
    'SELECT id FROM relationship WHERE id = $1', ['singleton'],
  )).length > 0

  if (exists) {
    await db.execute(
      `UPDATE relationship SET score=$1, level=$2, total_messages=$3,
       first_interaction=$4, last_interaction=$5, streak_days=$6,
       last_streak_date=$7, updated_at=$8 WHERE id='singleton'`,
      [merged.score, merged.level, merged.totalMessages,
       merged.firstInteraction, merged.lastInteraction,
       merged.streakDays, merged.lastStreakDate, merged.updatedAt],
    )
  } else {
    await db.execute(
      `INSERT INTO relationship (id, score, level, total_messages,
       first_interaction, last_interaction, streak_days, last_streak_date, updated_at)
       VALUES ('singleton', $1, $2, $3, $4, $5, $6, $7, $8)`,
      [merged.score, merged.level, merged.totalMessages,
       merged.firstInteraction, merged.lastInteraction,
       merged.streakDays, merged.lastStreakDate, merged.updatedAt],
    )
  }
}
