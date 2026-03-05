/**
 * Ambient desktop monitor — detects active app, idle time, time of day.
 * Polls frontmost app via Tauri command every 30s.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { invoke } from '@tauri-apps/api/core'

export type TimeOfDay = 'morning' | 'afternoon' | 'evening' | 'night'

export interface AmbientState {
  currentApp: string | null
  idleMinutes: number
  timeOfDay: TimeOfDay
  hourOfDay: number
  sessionStartedAt: number
}

function getTimeOfDay(hour: number): TimeOfDay {
  if (hour >= 6 && hour < 12) return 'morning'
  if (hour >= 12 && hour < 18) return 'afternoon'
  if (hour >= 18 && hour < 23) return 'evening'
  return 'night'
}

const POLL_INTERVAL_MS = 30_000

export function useAmbientMonitor() {
  const [state, setState] = useState<AmbientState>(() => {
    const hour = new Date().getHours()
    return {
      currentApp: null,
      idleMinutes: 0,
      timeOfDay: getTimeOfDay(hour),
      hourOfDay: hour,
      sessionStartedAt: Date.now(),
    }
  })

  const lastActivityRef = useRef(Date.now())

  const resetIdle = useCallback(() => {
    lastActivityRef.current = Date.now()
  }, [])

  useEffect(() => {
    let mounted = true

    async function poll() {
      if (!mounted) return

      const hour = new Date().getHours()
      let currentApp: string | null = null

      try {
        const result = await invoke<{ success: boolean; output: string }>('get_frontmost_app')
        if (result.success) {
          currentApp = result.output.trim()
        }
      } catch {
        // Command may not exist yet or fail — graceful degradation
      }

      const idleMs = Date.now() - lastActivityRef.current
      const idleMinutes = Math.floor(idleMs / 60000)

      if (mounted) {
        setState(prev => ({
          ...prev,
          currentApp: currentApp ?? prev.currentApp,
          idleMinutes,
          timeOfDay: getTimeOfDay(hour),
          hourOfDay: hour,
        }))
      }
    }

    poll()
    const interval = setInterval(poll, POLL_INTERVAL_MS)

    return () => {
      mounted = false
      clearInterval(interval)
    }
  }, [])

  return { ambient: state, resetIdle }
}
