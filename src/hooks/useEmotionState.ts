/**
 * Persistent emotion state hook.
 * Loads last emotion on mount, saves after each change, applies decay.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { getEmotionalState, saveEmotionalState, type EmotionalStateData } from '../lib/db/emotional-state'
import { computeDecayedEmotion, type DecayedEmotion } from '../lib/emotion/decay'
import type { Live2DController } from './useLive2D'

const DECAY_POLL_INTERVAL_MS = 5 * 60 * 1000

export function useEmotionState(controller: Live2DController | null) {
  const [currentEmotion, setCurrentEmotion] = useState<DecayedEmotion | null>(null)
  const loadedRef = useRef(false)

  // Load and apply decayed emotion on mount
  useEffect(() => {
    if (loadedRef.current) return
    loadedRef.current = true

    getEmotionalState().then(state => {
      const decayed = computeDecayedEmotion(state)
      setCurrentEmotion(decayed)
    }).catch(() => {
      // DB not ready yet — will load later
    })
  }, [])

  // Apply emotion to Live2D when controller is ready and emotion is loaded
  useEffect(() => {
    if (!controller?.isLoaded || !currentEmotion) return
    if (currentEmotion.emotion === 'calm' && currentEmotion.intensity <= 0.3) {
      // Don't apply neutral/calm — let idle behavior handle it
      return
    }

    const EXPRESSION_MAP: Record<string, string> = {
      joy: 'cheerful', excitement: 'excited', contentment: 'smile',
      anger: 'angry', fear: 'fear', sadness: 'sad',
      anxiety: 'frustrated', surprise: 'surprised', disgust: 'disgust',
      trust: 'smile', calm: 'relaxed', shame: 'shy',
      guilt: 'sad', numbness: 'sleepy',
    }

    const expr = EXPRESSION_MAP[currentEmotion.emotion]
    if (expr) {
      controller.setExpression(expr, Math.min(0.6, currentEmotion.intensity))
    }
  }, [controller?.isLoaded, currentEmotion])

  // Periodic decay
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const state = await getEmotionalState()
        const decayed = computeDecayedEmotion(state)
        setCurrentEmotion(decayed)
      } catch { /* ignore */ }
    }, DECAY_POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [])

  const updateEmotion = useCallback(async (
    emotion: string, intensity: number,
    vad?: { V: number; A: number; D: number },
  ) => {
    const data: Partial<EmotionalStateData> = {
      emotion,
      intensity,
      valence: vad?.V ?? 0,
      arousal: vad?.A ?? 0.2,
      dominance: vad?.D ?? 0,
    }
    setCurrentEmotion({
      emotion, intensity,
      valence: data.valence!, arousal: data.arousal!, dominance: data.dominance!,
    })
    try {
      await saveEmotionalState(data)
    } catch { /* ignore */ }
  }, [])

  return { currentEmotion, updateEmotion }
}
