/**
 * Agent tool registry — defines available desktop tools for LLM function calling.
 *
 * Each tool maps to a Tauri command. The registry provides metadata for:
 * - LLM tool calling payload generation (OpenAI format)
 * - Safety classification (safe / moderate / dangerous)
 * - Human-readable descriptions for confirmation dialogs
 */

export type RiskLevel = 'safe' | 'moderate' | 'dangerous'

export interface ToolParam {
  name: string
  type: 'string'
  description: string
  required: boolean
  enum?: string[]
}

export interface ToolDef {
  name: string
  tauriCommand: string
  description: string
  descriptionKo: string
  params: ToolParam[]
  risk: RiskLevel
  needsConfirmation: boolean
}

export const TOOL_REGISTRY: ToolDef[] = [
  {
    name: 'open_url',
    tauriCommand: 'open_url',
    description: 'Open a URL in the default web browser',
    descriptionKo: '기본 브라우저에서 URL 열기',
    params: [
      { name: 'url', type: 'string', description: 'The URL to open (must start with http:// or https://)', required: true },
    ],
    risk: 'safe',
    needsConfirmation: false,
  },
  {
    name: 'launch_app',
    tauriCommand: 'launch_app',
    description: 'Launch a macOS application by name',
    descriptionKo: '앱 실행하기',
    params: [
      { name: 'appName', type: 'string', description: 'The application name (e.g. "Slack", "Safari", "Terminal")', required: true },
    ],
    risk: 'safe',
    needsConfirmation: false,
  },
  {
    name: 'get_system_info',
    tauriCommand: 'get_system_info',
    description: 'Get system information such as battery level, memory usage, disk space, or hostname',
    descriptionKo: '시스템 정보 조회',
    params: [
      { name: 'infoType', type: 'string', description: 'Type of info to retrieve', required: true, enum: ['battery', 'memory', 'disk', 'hostname'] },
    ],
    risk: 'safe',
    needsConfirmation: false,
  },
  {
    name: 'send_notification',
    tauriCommand: 'send_notification',
    description: 'Send a desktop notification',
    descriptionKo: '데스크톱 알림 보내기',
    params: [
      { name: 'title', type: 'string', description: 'Notification title', required: true },
      { name: 'body', type: 'string', description: 'Notification body text', required: true },
    ],
    risk: 'safe',
    needsConfirmation: false,
  },
  {
    name: 'clipboard_read',
    tauriCommand: 'clipboard_read',
    description: 'Read current text from the clipboard',
    descriptionKo: '클립보드 읽기',
    params: [],
    risk: 'moderate',
    needsConfirmation: false,
  },
  {
    name: 'clipboard_write',
    tauriCommand: 'clipboard_write',
    description: 'Write text to the clipboard',
    descriptionKo: '클립보드에 텍스트 복사',
    params: [
      { name: 'text', type: 'string', description: 'Text to copy to clipboard', required: true },
    ],
    risk: 'safe',
    needsConfirmation: false,
  },
  {
    name: 'open_path',
    tauriCommand: 'open_path',
    description: 'Open a file or folder in Finder',
    descriptionKo: 'Finder에서 파일/폴더 열기',
    params: [
      { name: 'path', type: 'string', description: 'File or folder path to open', required: true },
    ],
    risk: 'safe',
    needsConfirmation: false,
  },
  {
    name: 'run_shell',
    tauriCommand: 'run_shell',
    description: 'Run a shell command. Use this for tasks not covered by other tools.',
    descriptionKo: '셸 명령어 실행',
    params: [
      { name: 'command', type: 'string', description: 'Shell command to execute', required: true },
    ],
    risk: 'dangerous',
    needsConfirmation: true,
  },
]

export const TOOL_MAP = Object.fromEntries(TOOL_REGISTRY.map(t => [t.name, t]))

/**
 * Build OpenAI-compatible tools payload for chat completions API.
 */
export function buildToolsPayload(): Array<{
  type: 'function'
  function: {
    name: string
    description: string
    parameters: {
      type: 'object'
      properties: Record<string, unknown>
      required: string[]
    }
  }
}> {
  return TOOL_REGISTRY.map(tool => ({
    type: 'function' as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: {
        type: 'object' as const,
        properties: Object.fromEntries(
          tool.params.map(p => [
            p.name,
            {
              type: p.type,
              description: p.description,
              ...(p.enum ? { enum: p.enum } : {}),
            },
          ]),
        ),
        required: tool.params.filter(p => p.required).map(p => p.name),
      },
    },
  }))
}
