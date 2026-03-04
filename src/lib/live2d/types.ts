/**
 * Type definitions for Live2D Cubism SDK objects.
 * These provide type safety for pixi-live2d-display v0.4.0 internals.
 * NOTE: These are partial interfaces covering only the methods we use.
 */

/** Cubism core model — accessed via internalModel.coreModel */
export interface CubismCoreModel {
  update(): void
  getParameterIndex(id: string): number
  getParameterValueById(id: string): number | undefined
  setParameterValueById(id: string, value: number): void
  getParameterValueByIndex(index: number): number
  setParameterValueByIndex(index: number, value: number): void
  getParameterCount?(): number
  getParameterIds?(): string[]
}

/** Cubism motion manager */
export interface CubismMotionManager {
  startMotion(group: string, index: number, priority?: number): unknown
  update(model: unknown, now: number): boolean
  state: { currentGroup: string | null | undefined }
  groups: { idle: string }
  motionGroups: Record<string, unknown[]>
  /** Motion definitions from model3.json */
  definitions: Record<string, unknown[]>
}

/** Physics rig wind property */
export interface PhysicsRig {
  wind: { x: number; y: number }
}

/** Motion data structure (for patching) */
export interface CubismMotion {
  _motionData?: {
    curves: Array<{
      id: string
      _originalId?: string
    }>
  }
}
