/**
 * Creates and initializes a Live2D stage with PixiJS.
 *
 * Handles: PixiJS app creation, model loading, ticker, gaze, drag physics,
 * motion patches, expression blending, gesture handlers, and resize observer.
 */

import type { InternalModel } from 'pixi-live2d-display/cubism4'
import { Live2DFactory, Live2DModel } from 'pixi-live2d-display/cubism4'

import type { CharacterPackage } from '../../characters/types'
import type { Exp3Expression } from './exp3-engine'
import { applyExp3Expression } from './exp3-engine'
import { attachDragPhysics } from './drag-physics'
import { attachMouseGaze, attachGlobalMouseGaze, resolveGaze } from './gaze'
import { attachGestureHandlers } from './gestures'
import { interceptStartMotion, patchIdleMotions } from './motion-patches'
import { createLive2DIdleEyeFocus } from './saccade'

export interface ControllerState {
  coreModel: any
  motionManager: any
  internalModel: InternalModel
  currentExpression: Exp3Expression | undefined
  currentExpressionWeight: number
  targetExpressionWeight: number
  autoSaccadeEnabled: boolean
}

export interface StageCallbacks {
  onActiveMotion: (motion: { group: string; index: number } | null) => void
  getControllerState: () => ControllerState | null
  setControllerState: (state: ControllerState) => void
}

export interface StageResult {
  app: any
  model: Live2DModel<InternalModel>
  motionGroups: Record<string, number>
  cleanup: () => void
}

export async function createLive2DStage(
  canvas: HTMLCanvasElement,
  container: HTMLElement,
  character: CharacterPackage,
  callbacks: StageCallbacks,
): Promise<StageResult | null> {
  const { Application } = await import('@pixi/app')
  const { extensions } = await import('@pixi/extensions')
  const { Ticker, TickerPlugin } = await import('@pixi/ticker')

  extensions.add(TickerPlugin)

  const pixelRatio = globalThis.devicePixelRatio ?? 1
  const app = new Application({
    view: canvas,
    width: container.clientWidth,
    height: container.clientHeight,
    resolution: pixelRatio,
    backgroundAlpha: 0,
    antialias: true,
    autoDensity: true,
    preserveDrawingBuffer: true,
  })

  Live2DModel.registerTicker(Ticker as any)

  const live2DModel = new Live2DModel<InternalModel>()
  await Live2DFactory.setupLive2DModel(live2DModel, character.modelUrl, { autoInteract: false })

  app.stage.addChild(live2DModel as any)
  const initialModelHeight = live2DModel.height
  live2DModel.anchor.set(0.5, 0.5)

  const scaleFactor = character.display?.scale ?? 2.2

  function setScaleAndPosition() {
    const width = container.clientWidth
    const height = container.clientHeight
    let scale = height * 0.95 / initialModelHeight * scaleFactor
    if (Number.isNaN(scale) || scale <= 0) {
      scale = 1e-6
    }
    live2DModel.scale.set(scale, scale)
    live2DModel.x = width / 2
    live2DModel.y = height + (character.display?.offsetY ?? 0)
  }

  setScaleAndPosition()

  // --- Core references ---
  let mouseGaze: { x: number; y: number } | null = null
  const idleEyeFocus = createLive2DIdleEyeFocus()
  const internalModel = live2DModel.internalModel
  const motionManager = internalModel.motionManager
  const coreModel = internalModel.coreModel as any

  console.log('[createLive2DStage] Init: coreModel?', !!coreModel, 'internalModel?', !!internalModel)

  // --- Ticker gaze update ---
  Ticker.shared.add(() => {
    const ctrl = callbacks.getControllerState()
    if (!ctrl?.coreModel) return
    const gazeResult = resolveGaze(mouseGaze)
    if (gazeResult) {
      ctrl.coreModel.setParameterValueById('ParamEyeBallX', gazeResult.x)
      ctrl.coreModel.setParameterValueById('ParamEyeBallY', gazeResult.y)
    }
  }, null, 100)

  callbacks.setControllerState({
    coreModel,
    motionManager,
    internalModel,
    currentExpression: undefined,
    currentExpressionWeight: 0,
    targetExpressionWeight: 0,
    autoSaccadeEnabled: true,
  })

  // --- Motion patches ---
  patchIdleMotions(motionManager)
  interceptStartMotion(motionManager, (group, index) => {
    callbacks.onActiveMotion({ group, index })
  })

  // --- Drag physics ---
  const dragPhysics = attachDragPhysics(canvas)
  const physicsRig = (internalModel as any).physics?._physicsRig ?? null

  // --- Gaze + idle tracking (motionManager.update hook) ---
  const idleGroupName = motionManager.groups.idle
  const originalMotionUpdate = motionManager.update.bind(motionManager)
  let prevIsIdle = true

  motionManager.update = function (cm: any, now: number) {
    const result = originalMotionUpdate(cm, now)

    const drag = dragPhysics.update()
    if (drag) {
      const w = drag.weight
      const mw = 1 - w
      const ax = coreModel.getParameterValueById('ParamAngleX') ?? 0
      const ay = coreModel.getParameterValueById('ParamAngleY') ?? 0
      const bx = coreModel.getParameterValueById('ParamBodyAngleX') ?? 0
      coreModel.setParameterValueById('ParamAngleX', ax * mw + drag.angleX * w)
      coreModel.setParameterValueById('ParamAngleY', ay * mw + drag.angleY * w)
      coreModel.setParameterValueById('ParamBodyAngleX', bx * mw + drag.bodyAngleX * w)

      if (physicsRig) {
        physicsRig.wind.x = drag.windX
        physicsRig.wind.y = drag.windY
      }
    } else if (physicsRig) {
      physicsRig.wind.x = 0
      physicsRig.wind.y = 0
    }

    const isIdle = !motionManager.state.currentGroup
      || motionManager.state.currentGroup === idleGroupName

    if (isIdle && !prevIsIdle) {
      callbacks.onActiveMotion(null)
    }
    prevIsIdle = isIdle

    return result
  }

  // --- Expression blend (coreModel.update hook) ---
  const FADE_SPEED = 4
  const originalCoreUpdate = coreModel.update.bind(coreModel)
  let lastUpdateTime = 0

  coreModel.update = function () {
    const now = performance.now()
    const timeDelta = lastUpdateTime ? (now - lastUpdateTime) / 1000 : 0
    lastUpdateTime = now

    originalCoreUpdate()

    const ctrl = callbacks.getControllerState()
    if (ctrl) {
      if (ctrl.currentExpressionWeight !== ctrl.targetExpressionWeight) {
        if (ctrl.currentExpressionWeight < ctrl.targetExpressionWeight) {
          ctrl.currentExpressionWeight = Math.min(
            ctrl.targetExpressionWeight,
            ctrl.currentExpressionWeight + timeDelta * FADE_SPEED,
          )
        } else {
          ctrl.currentExpressionWeight = Math.max(
            ctrl.targetExpressionWeight,
            ctrl.currentExpressionWeight - timeDelta * FADE_SPEED,
          )
        }
      }

      if (ctrl.currentExpression && ctrl.currentExpressionWeight > 0) {
        applyExp3Expression(coreModel, ctrl.currentExpression, ctrl.currentExpressionWeight)
      }
    }

    const gazeResult = resolveGaze(mouseGaze)
    if (gazeResult) {
      coreModel.setParameterValueById('ParamEyeBallX', gazeResult.x)
      coreModel.setParameterValueById('ParamEyeBallY', gazeResult.y)
    } else if (ctrl?.autoSaccadeEnabled) {
      idleEyeFocus.update(internalModel, now)
    }
  }

  // --- Extract motion groups ---
  const defs = (motionManager as any).definitions ?? {}
  const motionGroups: Record<string, number> = {}
  for (const [group, motions] of Object.entries(defs)) {
    motionGroups[group] = (motions as any[]).length
  }

  // --- Event handlers ---
  let disposed = false
  const cleanupGestures = attachGestureHandlers(
    canvas, live2DModel, motionManager, () => disposed,
  )

  // Try global mouse gaze (Tauri), fall back to document-based
  let cleanupMouse: (() => void) | null = null
  try {
    const { invoke } = await import('@tauri-apps/api/core')
    await invoke<{ x: number; y: number }>('get_global_mouse_position')
    console.log('[createLive2DStage] Using global mouse gaze (Tauri mode)')
    cleanupMouse = attachGlobalMouseGaze(container, (g) => { mouseGaze = g })
  } catch {
    console.log('[createLive2DStage] Using document-based mouse gaze (browser mode)')
    cleanupMouse = attachMouseGaze(container, (g) => { mouseGaze = g })
  }

  const resizeObserver = new ResizeObserver(() => {
    if (disposed) return
    app.renderer.resize(container.clientWidth, container.clientHeight)
    setScaleAndPosition()
  })
  resizeObserver.observe(container)

  return {
    app,
    model: live2DModel,
    motionGroups,
    cleanup() {
      disposed = true
      resizeObserver.disconnect()
      cleanupGestures()
      cleanupMouse?.()
      dragPhysics.cleanup()
    },
  }
}
