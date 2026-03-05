import { getDB } from './index'

export interface EmotionalStateData {
  emotion: string
  intensity: number
  valence: number
  arousal: number
  dominance: number
  updatedAt: number
}

const DEFAULT: EmotionalStateData = {
  emotion: 'calm', intensity: 0.3,
  valence: 0.0, arousal: 0.2, dominance: 0.0,
  updatedAt: Date.now(),
}

export async function getEmotionalState(): Promise<EmotionalStateData> {
  const db = await getDB()
  const rows = await db.select<{
    emotion: string; intensity: number; valence: number
    arousal: number; dominance: number; updated_at: number
  }[]>('SELECT * FROM emotional_state WHERE id = $1', ['singleton'])

  if (rows.length === 0) return { ...DEFAULT }
  const r = rows[0]
  return {
    emotion: r.emotion, intensity: r.intensity,
    valence: r.valence, arousal: r.arousal, dominance: r.dominance,
    updatedAt: r.updated_at,
  }
}

export async function saveEmotionalState(data: Partial<EmotionalStateData>): Promise<void> {
  const db = await getDB()
  const current = await getEmotionalState()
  const merged = { ...current, ...data, updatedAt: Date.now() }

  const exists = (await db.select<{ id: string }[]>(
    'SELECT id FROM emotional_state WHERE id = $1', ['singleton'],
  )).length > 0

  if (exists) {
    await db.execute(
      `UPDATE emotional_state SET emotion=$1, intensity=$2, valence=$3,
       arousal=$4, dominance=$5, updated_at=$6 WHERE id='singleton'`,
      [merged.emotion, merged.intensity, merged.valence,
       merged.arousal, merged.dominance, merged.updatedAt],
    )
  } else {
    await db.execute(
      `INSERT INTO emotional_state (id, emotion, intensity, valence, arousal, dominance, updated_at)
       VALUES ('singleton', $1, $2, $3, $4, $5, $6)`,
      [merged.emotion, merged.intensity, merged.valence,
       merged.arousal, merged.dominance, merged.updatedAt],
    )
  }
}
