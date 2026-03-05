/**
 * Milestone tracking for relationship progression.
 * Detects level changes and day milestones, prevents duplicate triggers.
 */

import { getDB } from '../db/index'
import type { RelationshipData } from '../db/relationship'
import { getDaysSinceFirst } from './engine'

export interface Milestone {
  type: 'level_change' | 'day_milestone'
  value: string
  message: string
  emotion: string
}

const DAY_MILESTONES = [7, 30, 100, 365]

const LEVEL_MESSAGES: Record<string, { message: string; emotion: string }> = {
  acquaintance: { message: 'We\'re getting to know each other!', emotion: 'contentment' },
  friend: { message: 'We\'re friends now!', emotion: 'joy' },
  closeFriend: { message: 'We\'re close friends!', emotion: 'excitement' },
  bestFriend: { message: 'Best friends forever!', emotion: 'excitement' },
}

const DAY_MESSAGES: Record<number, { message: string; emotion: string }> = {
  7: { message: 'One week together!', emotion: 'joy' },
  30: { message: 'One month together!', emotion: 'excitement' },
  100: { message: '100 days together!', emotion: 'excitement' },
  365: { message: 'One year together!', emotion: 'excitement' },
}

async function hasMilestone(type: string, value: string): Promise<boolean> {
  const db = await getDB()
  const rows = await db.select<{ id: string }[]>(
    'SELECT id FROM milestones WHERE type = $1 AND value = $2',
    [type, value],
  )
  return rows.length > 0
}

async function recordMilestone(type: string, value: string): Promise<void> {
  const db = await getDB()
  await db.execute(
    'INSERT INTO milestones (id, type, value, triggered_at) VALUES ($1, $2, $3, $4)',
    [crypto.randomUUID(), type, value, Date.now()],
  )
}

export async function checkMilestones(
  data: RelationshipData,
  levelChanged: boolean,
  previousLevel: string | null,
): Promise<Milestone[]> {
  const milestones: Milestone[] = []

  // Level change milestone
  if (levelChanged && previousLevel) {
    const key = data.level
    if (LEVEL_MESSAGES[key] && !(await hasMilestone('level_change', key))) {
      await recordMilestone('level_change', key)
      milestones.push({
        type: 'level_change',
        value: key,
        ...LEVEL_MESSAGES[key],
      })
    }
  }

  // Day milestones
  const days = getDaysSinceFirst(data.firstInteraction)
  for (const milestone of DAY_MILESTONES) {
    if (days >= milestone && !(await hasMilestone('day_milestone', String(milestone)))) {
      await recordMilestone('day_milestone', String(milestone))
      const msg = DAY_MESSAGES[milestone]
      if (msg) {
        milestones.push({
          type: 'day_milestone',
          value: String(milestone),
          ...msg,
        })
      }
    }
  }

  return milestones
}
