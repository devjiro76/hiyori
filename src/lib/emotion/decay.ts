/**
 * Emotion decay: emotions gradually return to a calm baseline over time.
 * Half-life is 30 minutes — intensity halves every 30 min.
 */

import type { EmotionalStateData } from '../db/emotional-state'

const HALF_LIFE_MS = 30 * 60 * 1000
const BASELINE_EMOTION = 'calm'
const BASELINE_INTENSITY = 0.3
const BASELINE_VALENCE = 0.0
const BASELINE_AROUSAL = 0.2
const BASELINE_DOMINANCE = 0.0
const MIN_INTENSITY = 0.25

export interface DecayedEmotion {
  emotion: string
  intensity: number
  valence: number
  arousal: number
  dominance: number
}

export function computeDecayedEmotion(state: EmotionalStateData, now = Date.now()): DecayedEmotion {
  const elapsed = now - state.updatedAt
  if (elapsed <= 0) {
    return {
      emotion: state.emotion, intensity: state.intensity,
      valence: state.valence, arousal: state.arousal, dominance: state.dominance,
    }
  }

  const decayFactor = Math.pow(0.5, elapsed / HALF_LIFE_MS)

  const intensity = BASELINE_INTENSITY + (state.intensity - BASELINE_INTENSITY) * decayFactor
  const valence = BASELINE_VALENCE + (state.valence - BASELINE_VALENCE) * decayFactor
  const arousal = BASELINE_AROUSAL + (state.arousal - BASELINE_AROUSAL) * decayFactor
  const dominance = BASELINE_DOMINANCE + (state.dominance - BASELINE_DOMINANCE) * decayFactor

  // If intensity has decayed close to baseline, switch emotion label to calm
  const emotion = intensity <= MIN_INTENSITY ? BASELINE_EMOTION : state.emotion

  return { emotion, intensity, valence, arousal, dominance }
}
