import { useState, useEffect, useRef, useCallback } from 'react'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { PhysicalSize } from '@tauri-apps/api/dpi'

type ResizeDirection = 'North' | 'South' | 'East' | 'West' | 'NorthEast' | 'NorthWest' | 'SouthEast' | 'SouthWest'

const isTauri = typeof window !== 'undefined' && (window as any).__TAURI__

export interface WindowBehaviorState {
  alwaysOnTop: boolean
  setAlwaysOnTop: (value: boolean) => void
  settingsOpen: boolean
  setSettingsOpen: (value: boolean | ((prev: boolean) => boolean)) => void
  showResizeCorners: boolean
  inputFocused: boolean
  setInputFocused: (value: boolean) => void
  handleMouseDown: (e: React.MouseEvent) => void
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
      }, 1000)
    }
    document.addEventListener('mousemove', onMouseMove)
    return () => {
      document.removeEventListener('mousemove', onMouseMove)
      if (hideCornerTimerRef.current) clearTimeout(hideCornerTimerRef.current)
    }
  }, [inputFocused])

  // Proportional resize — maintain aspect ratio
  useEffect(() => {
    if (!isTauri) return
    const win = getCurrentWindow()
    const RATIO = 450 / 852
    let correcting = false
    let debounceTimer: ReturnType<typeof setTimeout> | null = null

    const unlistenPromise = win.onResized(({ payload: size }) => {
      if (correcting) return
      const w = size.width
      const expectedH = Math.round(w / RATIO)
      if (Math.abs(size.height - expectedH) > 4) {
        if (debounceTimer) clearTimeout(debounceTimer)
        debounceTimer = setTimeout(async () => {
          correcting = true
          try {
            await win.setSize(new PhysicalSize(w, expectedH))
          } finally {
            setTimeout(() => { correcting = false }, 50)
          }
        }, 16)
      }
    })

    return () => {
      unlistenPromise.then(fn => fn())
      if (debounceTimer) clearTimeout(debounceTimer)
    }
  }, [])

  const handleMouseDown = useCallback(async (e: React.MouseEvent) => {
    const target = e.target as HTMLElement

    const resizeHandle = target.closest('[data-resize-dir]') as HTMLElement | null
    if (resizeHandle) {
      try {
        const win = getCurrentWindow()
        await win.startResizeDragging(resizeHandle.dataset.resizeDir as ResizeDirection)
      } catch {
        // Ignore resize errors
      }
      return
    }

    if (target.closest('input, button, textarea, select, a, .no-drag')) {
      return
    }
    try {
      const win = getCurrentWindow()
      await win.startDragging()
    } catch {
      // Ignore drag errors
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
    handleMouseDown,
    handleToggleAlwaysOnTop,
  }
}
