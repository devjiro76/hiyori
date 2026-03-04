import { useEffect, useRef } from 'react'
import type { CharacterPackage } from '../characters/types'
import type { ActiveMotion, Live2DController } from '../hooks/useLive2D'
import { useLive2D } from '../hooks/useLive2D'
import './Live2DViewer.css'

interface Live2DViewerProps {
  character: CharacterPackage
  onReady?: (controller: Live2DController) => void
  onActiveMotionChange?: (motion: ActiveMotion | null) => void
}

export function Live2DViewer({ character, onReady, onActiveMotionChange }: Live2DViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const controller = useLive2D(canvasRef, character)
  const notifiedRef = useRef(false)

  useEffect(() => {
    if (controller.isLoaded && !notifiedRef.current) {
      notifiedRef.current = true
      onReady?.(controller)
    }
  }, [controller.isLoaded, onReady])

  useEffect(() => {
    onActiveMotionChange?.(controller.activeMotion)
  }, [controller.activeMotion, onActiveMotionChange])

  return (
    <div className="live2d-wrapper">
      <canvas
        ref={canvasRef}
        className="w-full h-full block"
      />
      {!controller.isLoaded && (
        <div className="live2d-loading">
          <div className="live2d-spinner" />
          <span>Loading model…</span>
        </div>
      )}
    </div>
  )
}
