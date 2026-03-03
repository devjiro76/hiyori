/**
 * Gaze tracking utilities for Live2D.
 *
 * - Mouse tracking: normalizes cursor position to -1..1 range
 * - Gaze resolution: mouse > saccade
 */

export interface ResolvedGaze {
  x: number
  y: number
}

/**
 * Resolve gaze from mouse input.
 * Returns null if no source is active (fall through to saccade).
 */
export function resolveGaze(
  mouseGaze: { x: number; y: number } | null,
): ResolvedGaze | null {
  // console.log('[resolveGaze] input:', mouseGaze)
  if (mouseGaze) {
    const result = { x: mouseGaze.x, y: -mouseGaze.y }
    // console.log('[resolveGaze] result:', result)
    return result
  }
  // console.log('[resolveGaze] returning null (no mouse gaze)')
  return null
}

/**
 * Attach mouse-based gaze tracking to the entire document.
 * Tracks mouse position relative to the container element.
 * Calls `onGaze` with normalized -1..1 coordinates.
 */
export function attachMouseGaze(
  container: HTMLElement,
  onGaze: (gaze: { x: number; y: number } | null) => void,
): () => void {
  function onMouseMove(e: MouseEvent) {
    const rect = container.getBoundingClientRect()
    const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1
    const ny = ((e.clientY - rect.top) / rect.height) * 2 - 1
    const gaze = {
      x: Math.max(-1, Math.min(1, nx)),
      y: Math.max(-1, Math.min(1, ny)),
    }
    // console.log('[gaze] mouse:', { nx, ny, gaze })
    onGaze(gaze)
  }

  // Attach to document instead of container to track even outside the element
  document.addEventListener('mousemove', onMouseMove)

  return () => {
    document.removeEventListener('mousemove', onMouseMove)
  }
}

/**
 * Attach global mouse gaze tracking using Tauri (works outside app window).
 * Polls the global mouse position and calculates position relative to app window.
 */
export function attachGlobalMouseGaze(
  _container: HTMLElement,
  onGaze: (gaze: { x: number; y: number } | null) => void,
): () => void {
  let shouldRun = true

  async function updateGaze() {
    if (!shouldRun) return

    try {
      const { invoke } = await import('@tauri-apps/api/core')
      const { getCurrentWindow } = await import('@tauri-apps/api/window')

      const position = await invoke<{ x: number; y: number }>('get_global_mouse_position')
      const window = getCurrentWindow()
      const windowPos = await window.outerPosition()
      const windowSize = await window.outerSize()

      // outerSize/outerPosition are in physical pixels on retina displays
      // Convert to logical pixels using device pixel ratio
      const dpr = globalThis.devicePixelRatio ?? 1
      const logicalWidth = windowSize.width / dpr
      const logicalHeight = windowSize.height / dpr
      const logicalX = windowPos.x / dpr
      const logicalY = windowPos.y / dpr

      // Calculate relative position within window (in logical pixels)
      const relativeX = position.x - logicalX
      const relativeY = position.y - logicalY

      // Normalize to -1..1 range (0,0 is center)
      const nx = (relativeX / logicalWidth) * 2 - 1
      const ny = (relativeY / logicalHeight) * 2 - 1

      const gaze = {
        x: Math.max(-1, Math.min(1, nx)),
        y: Math.max(-1, Math.min(1, ny)),
      }

      onGaze(gaze)
    } catch (e) {
      console.error('[globalGaze] Error:', e)
      // Fall back to null gaze on error (will use saccade)
      onGaze(null)
    }

    requestAnimationFrame(updateGaze)
  }

  updateGaze()

  return () => {
    shouldRun = false
  }
}
