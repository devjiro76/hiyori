/**
 * Motion manager patches for Live2D.
 *
 * - Disables EyeBall curves in idle motions so saccade/gaze can override
 * - Intercepts startMotion to patch lazy-loaded motions and track active state
 */

import type { CubismMotion, CubismMotionManager } from './types'

export function patchEyeBallCurves(motion: CubismMotion): void {
  if (!motion?._motionData?.curves) return
  for (const curve of motion._motionData.curves) {
    if (!curve.id || curve.id.startsWith('_')) continue
    if (curve.id === 'ParamEyeBallX' || curve.id === 'ParamEyeBallY') {
      curve._originalId = curve.id
      curve.id = `_${curve.id}`
    }
  }
}

export function patchIdleMotions(motionManager: CubismMotionManager): void {
  const idleGroup = motionManager.groups.idle
  if (!idleGroup) return
  motionManager.motionGroups[idleGroup]?.forEach(m => patchEyeBallCurves(m as CubismMotion))
}

export function interceptStartMotion(
  motionManager: CubismMotionManager,
  onNonIdleMotion: (group: string, index: number) => void,
): void {
  const idleGroupName = motionManager.groups.idle
  const original = motionManager.startMotion.bind(motionManager)

  motionManager.startMotion = function (group: string, index: number, priority?: number) {
    const result = original(group, index, priority)

    if (group === idleGroupName) {
      Promise.resolve(result).then(() => {
        const motions = motionManager.motionGroups[group]
        if (motions?.[index]) patchEyeBallCurves(motions[index] as CubismMotion)
      })
    }

    if (group !== idleGroupName) {
      onNonIdleMotion(group, index)
    }

    return result
  }
}
