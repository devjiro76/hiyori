import { WebviewWindow } from '@tauri-apps/api/webviewWindow'

export async function openSettingsWindow() {
  const existing = await WebviewWindow.getByLabel('settings')
  if (existing) {
    await existing.setFocus()
    return
  }

  new WebviewWindow('settings', {
    url: '/?page=settings',
    title: 'Hiyori Settings',
    width: 480,
    height: 680,
    center: true,
    resizable: true,
    decorations: true,
    transparent: false,
  })
}
