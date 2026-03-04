import { useState, useEffect, useRef, useCallback } from 'react'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { PhysicalSize } from '@tauri-apps/api/dpi'
import {
  RESIZE_CORNER_HIDE_DELAY_MS,
  WINDOW_ASPECT_RATIO,
} from '../lib/constants'

export interface WindowBehaviorState {
  alwaysOnTop: boolean
  setAlwaysOnTop: (value: boolean) => void
  settingsOpen: boolean
  setSettingsOpen: (value: boolean | ((prev: boolean) => boolean)) => void
  showResizeCorners: boolean
  inputFocused: boolean
  setInputFocused: (value: boolean) => void
  handleToggleAlwaysOnTop: (value: boolean) => Promise<void>
}

export function useWindowBehavior(): WindowBehaviorState {
  const [alwaysOnTop, setAlwaysOnTop] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [inputFocused, setInputFocused] = useState(false)
  const [showResizeCorners, setShowResizeCorners] = useState(false)
  const hideCornerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Cmd+, to open settings
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === ',') {
        e.preventDefault()
        setSettingsOpen(prev => !prev)
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  // Hide corners immediately when input is focused
  useEffect(() => {
    if (inputFocused) {
      setShowResizeCorners(false)
      if (hideCornerTimerRef.current) {
        clearTimeout(hideCornerTimerRef.current)
      }
    }
  }, [inputFocused])

  // Mouse movement detection for resize corner visibility
  useEffect(() => {
    function onMouseMove() {
      if (inputFocused) return
      setShowResizeCorners(true)
      if (hideCornerTimerRef.current) {
        clearTimeout(hideCornerTimerRef.current)
      }
      hideCornerTimerRef.current = setTimeout(() => {
        setShowResizeCorners(false)
      }, RESIZE_CORNER_HIDE_DELAY_MS)
    }
    document.addEventListener('mousemove', onMouseMove)
    return () => {
      document.removeEventListener('mousemove', onMouseMove)
      if (hideCornerTimerRef.current) clearTimeout(hideCornerTimerRef.current)
    }
  }, [inputFocused])

  // Click-through on transparent pixels + window drag + custom proportional resize
  useEffect(() => {
    const win = getCurrentWindow()
    let ignoring = false
    let recoveryTimer: ReturnType<typeof setInterval> | null = null

    // --- Custom proportional resize state ---
    let resizing = false
    let startScreenX = 0
    let startScreenY = 0
    let startW = 0

    function isTransparentPixel(clientX: number, clientY: number): boolean {
      const canvas = document.querySelector('canvas') as HTMLCanvasElement | null
      if (!canvas) return false
      const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl')
      if (!gl) return false
      const rect = canvas.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      const x = Math.round((clientX - rect.left) * dpr)
      const y = Math.round((rect.height - (clientY - rect.top)) * dpr) // flip Y for WebGL
      const pixel = new Uint8Array(4)
      gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel)
      return pixel[3] < 10
    }

    function setClickThrough(enable: boolean) {
      ignoring = enable
      win.setIgnoreCursorEvents(enable)
      if (enable) {
        if (!recoveryTimer) {
          recoveryTimer = setInterval(() => {
            win.setIgnoreCursorEvents(false)
            ignoring = false
          }, 300)
        }
      } else {
        if (recoveryTimer) { clearInterval(recoveryTimer); recoveryTimer = null }
      }
    }

    async function onResizeMouseDown(e: MouseEvent) {
      const target = e.target as HTMLElement
      if (!target.closest('[data-resize-dir]')) return

      e.preventDefault()
      e.stopPropagation()
      resizing = true

      const dpr = window.devicePixelRatio || 1
      startScreenX = e.screenX
      startScreenY = e.screenY
      const size = await win.innerSize()
      startW = size.width / dpr
    }

    function onResizeMouseMove(e: MouseEvent) {
      if (!resizing) return
      e.preventDefault()

      const dpr = window.devicePixelRatio || 1
      const dx = e.screenX - startScreenX
      const dy = e.screenY - startScreenY

      // Use the larger delta to determine new size, maintaining aspect ratio
      const delta = Math.abs(dx) > Math.abs(dy) ? dx : dy
      const newW = Math.max(290, startW + delta)
      const newH = Math.round(newW / WINDOW_ASPECT_RATIO)

      win.setSize(new PhysicalSize(
        Math.round(newW * dpr),
        Math.round(newH * dpr),
      ))
    }

    function onResizeMouseUp() {
      if (!resizing) return
      resizing = false
    }

    function onMouseDown(e: MouseEvent) {
      const target = e.target as HTMLElement

      // Resize handles — use custom proportional resize
      if (target.closest('[data-resize-dir]')) {
        onResizeMouseDown(e)
        return
      }

      // Skip interactive elements
      if (target.closest('input, button, textarea, select, a, .no-drag')) return

      // Transparent pixel → don't drag
      if (isTransparentPixel(e.clientX, e.clientY)) return

      // Opaque area → drag window
      e.preventDefault()
      win.startDragging()
    }

    function onMouseMove(e: MouseEvent) {
      // Handle resize drag
      if (resizing) {
        onResizeMouseMove(e)
        return
      }

      const target = e.target as HTMLElement
      // Over interactive UI or resize handles → always capture events
      if (target.closest('.input-bar, .history-overlay, .settings-panel, .confirm-dialog, .resize-corner, button, input, textarea')) {
        if (ignoring) setClickThrough(false)
        return
      }

      const transparent = isTransparentPixel(e.clientX, e.clientY)
      if (transparent && !ignoring) {
        setClickThrough(true)
      } else if (!transparent && ignoring) {
        setClickThrough(false)
      }
    }

    document.addEventListener('mousedown', onMouseDown, true)
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onResizeMouseUp)

    return () => {
      document.removeEventListener('mousedown', onMouseDown, true)
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onResizeMouseUp)
      if (recoveryTimer) clearInterval(recoveryTimer)
      if (ignoring) win.setIgnoreCursorEvents(false)
    }
  }, [])

  const handleToggleAlwaysOnTop = useCallback(async (value: boolean) => {
    setAlwaysOnTop(value)
    try {
      const win = getCurrentWindow()
      await win.setAlwaysOnTop(value)
    } catch { /* ignore */ }
  }, [])

  return {
    alwaysOnTop,
    setAlwaysOnTop,
    settingsOpen,
    setSettingsOpen,
    showResizeCorners,
    inputFocused,
    setInputFocused,
    handleToggleAlwaysOnTop,
  }
}
