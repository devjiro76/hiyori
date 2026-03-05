/**
 * Relationship progression engine.
 * Tracks intimacy score, level transitions, streaks, and daily interaction.
 */

import { getRelationship, updateRelationship, type RelationshipData } from '../db/relationship'

export type RelationshipLevel = 'stranger' | 'acquaintance' | 'friend' | 'closeFriend' | 'bestFriend'

const LEVEL_THRESHOLDS: [number, RelationshipLevel][] = [
  [80, 'bestFriend'],
  [60, 'closeFriend'],
  [40, 'friend'],
  [20, 'acquaintance'],
  [0, 'stranger'],
]

function scoreToLevel(score: number): RelationshipLevel {
  for (const [threshold, level] of LEVEL_THRESHOLDS) {
    if (score >= threshold) return level
  }
  return 'stranger'
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

export interface RelationshipUpdate {
  data: RelationshipData
  levelChanged: boolean
  previousLevel: string | null
  isFirstToday: boolean
  newStreak: number
}

/** Call after every user message to update relationship state */
export async function recordInteraction(): Promise<RelationshipUpdate> {
  const data = await getRelationship()
  const now = Date.now()
  const today = todayStr()

  const isFirstToday = data.lastStreakDate !== today
  let score = data.score
  let streakDays = data.streakDays

  // +0.5 per message
  score += 0.5

  // Daily first interaction bonus
  if (isFirstToday) {
    score += 2
    // Update streak
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
    if (data.lastStreakDate === yesterday) {
      streakDays += 1
    } else if (data.lastStreakDate !== today) {
      streakDays = 1
    }
    // Streak bonus (cap at +5)
    score += Math.min(5, streakDays)
  }

  // Cap score at 100
  score = Math.min(100, score)

  const previousLevel = data.level
  const newLevel = scoreToLevel(score)
  const levelChanged = previousLevel !== newLevel

  const updated: RelationshipData = {
    score,
    level: newLevel,
    totalMessages: data.totalMessages + 1,
    firstInteraction: data.firstInteraction ?? now,
    lastInteraction: now,
    streakDays,
    lastStreakDate: today,
    updatedAt: now,
  }

  await updateRelationship(updated)

  return {
    data: updated,
    levelChanged,
    previousLevel: levelChanged ? previousLevel : null,
    isFirstToday,
    newStreak: streakDays,
  }
}

/** Apply daily decay for days without interaction (call on app start) */
export async function applyDecay(): Promise<void> {
  const data = await getRelationship()
  if (!data.lastInteraction) return

  const daysSince = Math.floor((Date.now() - data.lastInteraction) / 86400000)
  if (daysSince <= 0) return

  const decayed = Math.max(0, data.score - daysSince * 0.5)
  await updateRelationship({
    score: decayed,
    level: scoreToLevel(decayed),
  })
}

export function getDaysSinceFirst(firstInteraction: number | null): number {
  if (!firstInteraction) return 0
  return Math.floor((Date.now() - firstInteraction) / 86400000) + 1
}
