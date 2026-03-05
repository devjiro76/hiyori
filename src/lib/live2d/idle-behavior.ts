/**
 * Idle animation controller — plays random motions when not in conversation.
 * Time-of-day aware: slower/sleepy at night, energetic in morning.
 */

import type { Live2DController } from '../../hooks/useLive2D'
import type { TimeOfDay } from '../../hooks/useAmbientMonitor'

interface IdleConfig {
  minIntervalMs: number
  maxIntervalMs: number
  expressionWeight: number
  expression: string
}

const TIME_CONFIG: Record<TimeOfDay, IdleConfig> = {
  morning: {
    minIntervalMs: 12_000,
    maxIntervalMs: 30_000,
    expressionWeight: 0.3,
    expression: 'smile',
  },
  afternoon: {
    minIntervalMs: 15_000,
    maxIntervalMs: 40_000,
    expressionWeight: 0.2,
    expression: 'relaxed',
  },
  evening: {
    minIntervalMs: 20_000,
    maxIntervalMs: 45_000,
    expressionWeight: 0.2,
    expression: 'relaxed',
  },
  night: {
    minIntervalMs: 30_000,
    maxIntervalMs: 60_000,
    expressionWeight: 0.4,
    expression: 'sleepy',
  },
}

export interface IdleBehaviorController {
  start(): void
  stop(): void
  setTimeOfDay(time: TimeOfDay): void
  setPaused(paused: boolean): void
}

export function createIdleBehavior(controller: Live2DController): IdleBehaviorController {
  let timeOfDay: TimeOfDay = 'afternoon'
  let timer: ReturnType<typeof setTimeout> | null = null
  let running = false
  let paused = false

  function randomInterval(): number {
    const config = TIME_CONFIG[timeOfDay]
    return config.minIntervalMs + Math.random() * (config.maxIntervalMs - config.minIntervalMs)
  }

  function playIdleMotion() {
    if (!running || paused || !controller.isLoaded) return

    // Play random idle motion (Idle group has 3 variations)
    const idleCount = controller.motionGroups['Idle'] ?? 0
    if (idleCount > 0) {
      const index = Math.floor(Math.random() * idleCount)
      controller.playMotion('Idle', index)
    }

    scheduleNext()
  }

  function scheduleNext() {
    if (timer) clearTimeout(timer)
    if (!running) return
    timer = setTimeout(playIdleMotion, randomInterval())
  }

  function applyAmbientExpression() {
    if (!controller.isLoaded || paused) return
    const config = TIME_CONFIG[timeOfDay]
    controller.setExpression(config.expression, config.expressionWeight)
  }

  return {
    start() {
      running = true
      applyAmbientExpression()
      scheduleNext()
    },

    stop() {
      running = false
      if (timer) {
        clearTimeout(timer)
        timer = null
      }
    },

    setTimeOfDay(time: TimeOfDay) {
      if (timeOfDay === time) return
      timeOfDay = time
      if (running && !paused) {
        applyAmbientExpression()
      }
    },

    setPaused(p: boolean) {
      paused = p
      if (!p && running) {
        applyAmbientExpression()
        scheduleNext()
      }
    },
  }
}
