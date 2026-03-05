/**
 * Proactive message engine.
 * Evaluates triggers periodically and generates contextual proactive messages.
 */

import type { AmbientState } from '../../hooks/useAmbientMonitor'
import type { RelationshipData } from '../db/relationship'
import { evaluateTriggers, getReturnFromIdleTrigger, type TriggerResult } from './triggers'

export interface ProactiveMessage {
  text: string
  emotion: string
  triggerId: string
}

export interface ProactiveEngineState {
  lastProactiveAt: number
  appStartedAt: number
  isFirstSessionToday: boolean
  wasIdle: boolean
}

const IDLE_THRESHOLD_MINUTES = 30

export function createProactiveEngine() {
  const state: ProactiveEngineState = {
    lastProactiveAt: 0,
    appStartedAt: Date.now(),
    isFirstSessionToday: true,
    wasIdle: false,
  }

  function evaluate(
    ambient: AmbientState,
    relationship: RelationshipData,
  ): TriggerResult | null {
    // Check for return from idle
    if (state.wasIdle && ambient.idleMinutes < 1) {
      state.wasIdle = false
      state.lastProactiveAt = Date.now()
      return getReturnFromIdleTrigger()
    }

    // Track idle state
    if (ambient.idleMinutes >= IDLE_THRESHOLD_MINUTES) {
      state.wasIdle = true
    }

    // Evaluate standard triggers
    const result = evaluateTriggers({
      ambient,
      relationship,
      lastProactiveAt: state.lastProactiveAt,
      appStartedAt: state.appStartedAt,
      isFirstSessionToday: state.isFirstSessionToday,
    })

    if (result) {
      state.lastProactiveAt = Date.now()
      if (result.id.includes('greeting')) {
        state.isFirstSessionToday = false
      }
    }

    return result
  }

  function markProactive() {
    state.lastProactiveAt = Date.now()
  }

  return { evaluate, markProactive, state }
}
