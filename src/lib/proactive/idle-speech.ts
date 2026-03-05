/**
 * Idle speech bubble content — short phrases Hiyori says when idle.
 * Context-aware by time of day and relationship level.
 */

import type { TimeOfDay } from '../../hooks/useAmbientMonitor'
import type { RelationshipLevel } from '../relationship/engine'

interface IdlePhrase {
  text: string
  minLevel: RelationshipLevel
}

const LEVEL_ORDER: RelationshipLevel[] = ['stranger', 'acquaintance', 'friend', 'closeFriend', 'bestFriend']

function meetsLevel(current: RelationshipLevel, required: RelationshipLevel): boolean {
  return LEVEL_ORDER.indexOf(current) >= LEVEL_ORDER.indexOf(required)
}

const PHRASES_BY_TIME: Record<TimeOfDay, IdlePhrase[]> = {
  morning: [
    { text: 'Good morning~', minLevel: 'stranger' },
    { text: 'What a nice day!', minLevel: 'stranger' },
    { text: 'La la la~', minLevel: 'acquaintance' },
    { text: 'Today is going to be great!', minLevel: 'friend' },
    { text: 'Did you sleep well?', minLevel: 'closeFriend' },
  ],
  afternoon: [
    { text: 'Hmm...', minLevel: 'stranger' },
    { text: '...', minLevel: 'stranger' },
    { text: 'Working hard~', minLevel: 'acquaintance' },
    { text: 'I wonder what to do...', minLevel: 'friend' },
    { text: 'You\'re doing great!', minLevel: 'closeFriend' },
  ],
  evening: [
    { text: 'It\'s getting late...', minLevel: 'stranger' },
    { text: '~', minLevel: 'stranger' },
    { text: 'Evening vibes~', minLevel: 'acquaintance' },
    { text: 'Almost done for the day?', minLevel: 'friend' },
    { text: 'Let\'s wrap up soon~', minLevel: 'closeFriend' },
  ],
  night: [
    { text: '...zzz', minLevel: 'stranger' },
    { text: '*yawn*', minLevel: 'stranger' },
    { text: 'So sleepy...', minLevel: 'acquaintance' },
    { text: 'You should sleep...', minLevel: 'friend' },
    { text: 'Don\'t stay up too late!', minLevel: 'closeFriend' },
  ],
}

const GENERIC: IdlePhrase[] = [
  { text: '...', minLevel: 'stranger' },
  { text: '~', minLevel: 'stranger' },
  { text: 'Hmm~', minLevel: 'stranger' },
  { text: '*looks around*', minLevel: 'acquaintance' },
  { text: 'What are you up to?', minLevel: 'friend' },
]

export function getRandomIdlePhrase(
  timeOfDay: TimeOfDay,
  level: RelationshipLevel,
): string {
  const pool = [...PHRASES_BY_TIME[timeOfDay], ...GENERIC]
    .filter(p => meetsLevel(level, p.minLevel))

  if (pool.length === 0) return '...'
  return pool[Math.floor(Math.random() * pool.length)].text
}

/** Minimum interval between idle speech bubbles (ms) */
export const IDLE_SPEECH_MIN_INTERVAL_MS = 2 * 60 * 1000  // 2 minutes
export const IDLE_SPEECH_MAX_INTERVAL_MS = 5 * 60 * 1000  // 5 minutes

export function randomIdleInterval(): number {
  return IDLE_SPEECH_MIN_INTERVAL_MS +
    Math.random() * (IDLE_SPEECH_MAX_INTERVAL_MS - IDLE_SPEECH_MIN_INTERVAL_MS)
}
