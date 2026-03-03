import { useEffect, useRef, useState } from 'react'

import type { CharacterPackage } from '../characters/types'
import { createLive2DStage, type ControllerState } from '../lib/live2d/create-live2d-stage'

// Import zip-loader side effects
import '../lib/live2d/zip-loader'

export interface ActiveMotion {
  group: string
  index: number
}

export interface Live2DController {
  setExpression(name: string, weight?: number): void
  clearExpression(): void
  playMotion(group: string, index?: number): void
  setParameter(key: string, value: number): void
  getParameter(key: string): number | undefined
  getParameterNames(): string[]
  setHeadRotation(x: number, y: number, z?: number): void
  setBodyRotation(x: number, y?: number): void
  lookAt(x: number, y: number): void
  setMouthOpen(value: number): void
  setAutoSaccade(enabled: boolean): void
  isLoaded: boolean
  motionGroups: Record<string, number>
  activeMotion: ActiveMotion | null
}

export function useLive2D(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  character: CharacterPackage,
): Live2DController {
  const [isLoaded, setIsLoaded] = useState(false)
  const [motionGroups, setMotionGroups] = useState<Record<string, number>>({})
  const [activeMotion, setActiveMotion] = useState<ActiveMotion | null>(null)

  const controllerRef = useRef<ControllerState | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !canvas.parentElement) return
    const container = canvas.parentElement!

    let disposed = false
    let stageCleanup: (() => void) | undefined
    let stageApp: any
    let stageModel: any

    createLive2DStage(canvas, container, character, {
      onActiveMotion: setActiveMotion,
      getControllerState: () => controllerRef.current,
      setControllerState: (state) => { controllerRef.current = state },
    }).then(result => {
      if (disposed || !result) return
      stageApp = result.app
      stageModel = result.model
      stageCleanup = result.cleanup
      setMotionGroups(result.motionGroups)
      setIsLoaded(true)
    })

    return () => {
      disposed = true
      stageCleanup?.()
      controllerRef.current = null
      setIsLoaded(false)
      if (stageModel) {
        stageApp?.stage?.removeChild(stageModel)
        stageModel.destroy()
      }
      stageApp?.destroy()
    }
  }, [character.modelUrl])

  return {
    setExpression(name: string, weight = 1) {
      const ctrl = controllerRef.current
      if (!ctrl) return
      const expr = character.expressions[name]

      if (name === 'normal' || name === 'neutral' || !expr) {
        ctrl.targetExpressionWeight = 0
      } else {
        ctrl.currentExpression = expr
        ctrl.targetExpressionWeight = Math.max(0, Math.min(1, weight))
        ctrl.currentExpressionWeight = 0
      }
    },

    clearExpression() {
      const ctrl = controllerRef.current
      if (!ctrl) return
      ctrl.targetExpressionWeight = 0
    },

    playMotion(group: string, index = 0) {
      controllerRef.current?.motionManager.startMotion(group, index)
    },

    setParameter(key: string, value: number) {
      const cm = controllerRef.current?.coreModel
      if (!cm) return
      const idx = cm.getParameterIndex(key)
      if (idx >= 0) {
        cm.setParameterValueByIndex(idx, value)
      }
    },

    getParameter(key: string): number | undefined {
      const cm = controllerRef.current?.coreModel
      if (!cm) return undefined
      const idx = cm.getParameterIndex(key)
      if (idx < 0) return undefined
      return cm.getParameterValueByIndex(idx)
    },

    getParameterNames(): string[] {
      const cm = controllerRef.current?.coreModel
      if (!cm) return []
      const count = cm.getParameterCount?.() ?? 0
      const names: string[] = []
      for (let i = 0; i < count; i++) {
        const id = cm.getParameterIds?.()?.[i]
        if (id) names.push(id)
      }
      return names
    },

    setHeadRotation(x: number, y: number, z = 0) {
      const cm = controllerRef.current?.coreModel
      if (!cm) return
      cm.setParameterValueById('ParamAngleX', x)
      cm.setParameterValueById('ParamAngleY', y)
      cm.setParameterValueById('ParamAngleZ', z)
    },

    setBodyRotation(x: number, y = 0) {
      const cm = controllerRef.current?.coreModel
      if (!cm) return
      cm.setParameterValueById('ParamBodyAngleX', x)
      cm.setParameterValueById('ParamBodyAngleY', y)
    },

    lookAt(x: number, y: number) {
      const cm = controllerRef.current?.coreModel
      if (!cm) return
      cm.setParameterValueById('ParamEyeBallX', x)
      cm.setParameterValueById('ParamEyeBallY', y)
    },

    setMouthOpen(value: number) {
      const cm = controllerRef.current?.coreModel
      if (!cm) return
      cm.setParameterValueById('ParamMouthOpenY', Math.max(0, Math.min(1, value)))
    },

    setAutoSaccade(enabled: boolean) {
      if (controllerRef.current) {
        controllerRef.current.autoSaccadeEnabled = enabled
      }
    },

    isLoaded,
    motionGroups,
    activeMotion,
  }
}
