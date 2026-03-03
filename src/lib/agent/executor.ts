/**
 * Agent executor — bridges LLM tool calls to Tauri commands.
 *
 * Flow: LLM tool_call → safety check → confirm if needed → invoke Tauri → result
 */

import { invoke } from '@tauri-apps/api/core'
import { TOOL_MAP, type ToolDef } from './tools'
import { validateShellCommand, validateUrl } from './safety'

export interface ToolResult {
  name: string
  descriptionKo: string
  success: boolean
  output: string
  confirmed: boolean
}

export type ConfirmFn = (tool: ToolDef, args: Record<string, string>) => Promise<boolean>
export type ToolStatusFn = (name: string, descriptionKo: string, status: 'running' | 'done' | 'error') => void

interface TauriCommandResult {
  success: boolean
  output: string
}

export async function executeTool(
  toolName: string,
  args: Record<string, string>,
  confirmFn?: ConfirmFn,
  onStatus?: ToolStatusFn,
): Promise<ToolResult> {
  const tool = TOOL_MAP[toolName]
  if (!tool) {
    return { name: toolName, descriptionKo: '알 수 없는 도구', success: false, output: `Unknown tool: ${toolName}`, confirmed: false }
  }

  // Pre-validation
  if (toolName === 'open_url' && args.url && !validateUrl(args.url)) {
    return { name: toolName, descriptionKo: tool.descriptionKo, success: false, output: 'Only http:// and https:// URLs are allowed', confirmed: false }
  }

  if (toolName === 'run_shell' && args.command) {
    const validation = validateShellCommand(args.command)
    if (!validation.allowed) {
      return { name: toolName, descriptionKo: tool.descriptionKo, success: false, output: validation.reason ?? 'Blocked', confirmed: false }
    }
    if (validation.needsConfirmation && confirmFn) {
      const confirmed = await confirmFn(tool, args)
      if (!confirmed) {
        return { name: toolName, descriptionKo: tool.descriptionKo, success: false, output: 'User declined execution', confirmed: false }
      }
    }
  } else if (tool.needsConfirmation && confirmFn) {
    const confirmed = await confirmFn(tool, args)
    if (!confirmed) {
      return { name: toolName, descriptionKo: tool.descriptionKo, success: false, output: 'User declined execution', confirmed: false }
    }
  }

  onStatus?.(toolName, tool.descriptionKo, 'running')

  try {
    const result = await invoke<TauriCommandResult>(tool.tauriCommand, args)
    onStatus?.(toolName, tool.descriptionKo, result.success ? 'done' : 'error')
    return {
      name: toolName,
      descriptionKo: tool.descriptionKo,
      success: result.success,
      output: result.output,
      confirmed: true,
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    onStatus?.(toolName, tool.descriptionKo, 'error')
    return {
      name: toolName,
      descriptionKo: tool.descriptionKo,
      success: false,
      output: `Invoke error: ${msg}`,
      confirmed: true,
    }
  }
}
