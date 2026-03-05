/**
 * Proactive message trigger definitions.
 * Each trigger evaluates ambient state and returns a prompt if conditions are met.
 */

import type { AmbientState } from '../../hooks/useAmbientMonitor'
import type { RelationshipData } from '../db/relationship'

export interface TriggerResult {
  id: string
  promptHint: string
  emotion: string
}

interface TriggerDef {
  id: string
  evaluate(ctx: TriggerContext): TriggerResult | null
}

interface TriggerContext {
  ambient: AmbientState
  relationship: RelationshipData
  lastProactiveAt: number
  appStartedAt: number
  isFirstSessionToday: boolean
}

const IDE_APPS = [
  'Visual Studio Code', 'Code', 'Cursor', 'WebStorm', 'IntelliJ IDEA',
  'Xcode', 'Android Studio', 'Sublime Text', 'Neovim', 'Vim', 'Emacs',
  'Terminal', 'iTerm2', 'Warp', 'Alacritty', 'kitty',
]

const triggers: TriggerDef[] = [
  {
    id: 'morning_greeting',
    evaluate(ctx) {
      if (!ctx.isFirstSessionToday) return null
      if (ctx.ambient.timeOfDay !== 'morning') return null
      return {
        id: 'morning_greeting',
        promptHint: 'Greet the user warmly for the morning. Be energetic and cheerful.',
        emotion: 'joy',
      }
    },
  },
  {
    id: 'evening_greeting',
    evaluate(ctx) {
      if (!ctx.isFirstSessionToday) return null
      if (ctx.ambient.timeOfDay !== 'evening' && ctx.ambient.timeOfDay !== 'afternoon') return null
      return {
        id: 'evening_greeting',
        promptHint: 'Greet the user warmly. Mention the time of day naturally.',
        emotion: 'contentment',
      }
    },
  },
  {
    id: 'late_night',
    evaluate(ctx) {
      if (ctx.ambient.hourOfDay < 23 && ctx.ambient.hourOfDay >= 6) return null
      const sessionMin = (Date.now() - ctx.appStartedAt) / 60000
      if (sessionMin < 5) return null // Don't trigger on app start
      return {
        id: 'late_night',
        promptHint: 'It\'s very late at night. Gently suggest the user should rest soon. Be caring, not pushy.',
        emotion: 'calm',
      }
    },
  },
  {
    id: 'long_coding',
    evaluate(ctx) {
      if (!ctx.ambient.currentApp) return null
      if (!IDE_APPS.some(a => ctx.ambient.currentApp!.includes(a))) return null
      const sessionMin = (Date.now() - ctx.appStartedAt) / 60000
      if (sessionMin < 90) return null
      return {
        id: 'long_coding',
        promptHint: `The user has been using ${ctx.ambient.currentApp} for a while. Suggest a short break. Be supportive.`,
        emotion: 'calm',
      }
    },
  },
  {
    id: 'return_from_idle',
    evaluate(_ctx) {
      void _ctx
      // Triggered externally by engine when idle > 30 min then user becomes active
      return null
    },
  },
]

const COOLDOWN_MS = 10 * 60 * 1000 // 10 minutes between proactive messages

export function evaluateTriggers(ctx: TriggerContext): TriggerResult | null {
  // Cooldown check
  if (Date.now() - ctx.lastProactiveAt < COOLDOWN_MS) return null

  for (const trigger of triggers) {
    const result = trigger.evaluate(ctx)
    if (result) return result
  }
  return null
}

export function getReturnFromIdleTrigger(): TriggerResult {
  return {
    id: 'return_from_idle',
    promptHint: 'The user was away for a while and just came back. Welcome them back warmly.',
    emotion: 'joy',
  }
}
