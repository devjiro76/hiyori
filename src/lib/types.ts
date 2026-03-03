/**
 * Local type definitions — replaces @molroo-io/sdk type imports.
 */

/** VAD (Valence-Arousal-Dominance) coordinates */
export interface VAD {
  V: number
  A: number
  D: number
}

/** Agent response emotion structure */
export interface AgentResponse {
  emotion: {
    discrete: { primary: string; intensity: number }
    vad: VAD
  }
}

/** Persona configuration (kept for hyori character definition) */
export interface PersonaConfigData {
  identity: {
    name: string
    role: string
    coreValues: string[]
    speakingStyle: string
  }
  personality: { O: number; C: number; E: number; A: number; N: number; H: number }
  goals: Array<{
    id: string
    content: string
    priority: number
    status: 'active' | 'inactive'
    mutable: boolean
  }>
}
