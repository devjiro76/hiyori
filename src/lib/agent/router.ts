/**
 * Agent router — LLM tool calling orchestration.
 *
 * 1. Send user message + tool definitions → LLM API
 * 2. If LLM returns tool_calls → execute via executor
 * 3. Return tool context string (or null for normal chat)
 *
 * Reuses the same provider/auth pattern as adapter.ts.
 */

import { fetch } from '@tauri-apps/plugin-http'
import type { LlmConfig } from '../llm/adapter'
import { buildLlmRequestConfig } from '../llm/request-config'
import { buildToolsPayload } from './tools'
import { executeTool, type ConfirmFn, type ToolStatusFn, type ToolResult } from './executor'

interface Message {
  role: 'user' | 'assistant' | 'system'
  content: string
}

interface ToolCall {
  id: string
  type: 'function'
  function: {
    name: string
    arguments: string
  }
}

export interface AgentRouterResult {
  toolsUsed: boolean
  toolResults: ToolResult[]
  toolContext: string
}

const AGENT_SYSTEM_PROMPT = `You are Hyori's desktop agent. When the user requests a desktop action, use the provided tools.
Only call tools when the user clearly wants an action performed. For normal conversation, do NOT call any tools.
If unsure whether a tool is needed, prefer not calling tools.
You may call multiple tools in one turn if needed.

If a tool fails (e.g., app not found with that exact name), try alternative app names or approaches.
For example, if "Slack" fails, try "Slack.app" or similar variations.
Keep trying until you succeed or run out of reasonable options.`

export async function routeAgentRequest(
  llmConfig: LlmConfig,
  userMessage: string,
  history: Message[],
  confirmFn?: ConfirmFn,
  onToolStatus?: ToolStatusFn,
): Promise<AgentRouterResult> {
  const noTools: AgentRouterResult = { toolsUsed: false, toolResults: [], toolContext: '' }

  const reqConfig = buildLlmRequestConfig(llmConfig)
  if (!reqConfig) return noTools

  const { modelId, baseUrl, headers } = reqConfig

  // Build messages: system + history (already trimmed by caller) + current user message
  const recentHistory = history
  const allResults: ToolResult[] = []
  let loopCount = 0
  const MAX_LOOPS = 4 // Max 4 attempts to handle tool failures

  // ReAct loop: keep calling LLM and executing tools until success or max loops
  const conversationMessages: Message[] = [
    { role: 'system', content: AGENT_SYSTEM_PROMPT },
    ...recentHistory,
    { role: 'user', content: userMessage },
  ]

  try {
    while (loopCount < MAX_LOOPS) {
      loopCount++
      console.log(`[agent-router] Loop ${loopCount}/${MAX_LOOPS}`)

      const requestBody = {
        model: modelId,
        messages: conversationMessages,
        tools: buildToolsPayload(),
        tool_choice: 'auto',
        temperature: 0.1,
      }

      console.log('[agent-router] Sending request:', {
        model: modelId,
        loop: loopCount,
        messageCount: conversationMessages.length,
        userMessage: userMessage.slice(0, 50) + '...',
      })

      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
      })

      const data = await res.json() as {
        choices: Array<{
          message: {
            content: string | null
            tool_calls?: ToolCall[]
          }
        }>
      }

      const choice = data.choices?.[0]?.message

      console.log('[agent-router] LLM response:', {
        ok: res.ok,
        status: res.status,
        hasToolCalls: !!choice?.tool_calls,
        toolCallCount: choice?.tool_calls?.length ?? 0,
        content: choice?.content?.slice(0, 100),
      })

      if (!res.ok) {
        console.warn('[agent-router] API error:', res.status, data)
        break
      }

      // If no tool calls, we're done
      if (!choice?.tool_calls?.length) {
        console.log('[agent-router] No more tool calls, finishing')
        break
      }

      // Execute all tool calls
      const loopResults: ToolResult[] = []
      for (const tc of choice.tool_calls) {
        let args: Record<string, string>
        try {
          args = JSON.parse(tc.function.arguments)
        } catch {
          const failResult: ToolResult = {
            name: tc.function.name,
            descriptionKo: '인자 파싱 실패',
            success: false,
            output: `Failed to parse arguments: ${tc.function.arguments}`,
            confirmed: false,
          }
          loopResults.push(failResult)
          allResults.push(failResult)
          continue
        }

        console.log(`[agent-router] Executing tool: ${tc.function.name}`, args)
        const result = await executeTool(tc.function.name, args, confirmFn, onToolStatus)
        loopResults.push(result)
        allResults.push(result)
        console.log(`[agent-router] Tool result:`, {
          name: result.name,
          success: result.success,
          output: result.output.slice(0, 100),
        })
      }

      // Add assistant response and tool results to conversation
      conversationMessages.push({
        role: 'assistant',
        content: choice.content || JSON.stringify(choice.tool_calls),
      })

      // Add tool results as system message for LLM to see
      const resultSummary = loopResults.map(r => {
        const status = r.success ? '✓' : '✗'
        return `${status} [${r.name}] ${r.output}`
      }).join('\n')

      conversationMessages.push({
        role: 'user',
        content: `Tool execution results:\n${resultSummary}\n\nIf all tools succeeded, provide a natural response. If any failed, try alternative approaches or app names.`,
      })

      // Check if all tools succeeded
      const allSucceeded = loopResults.every(r => r.success)
      if (allSucceeded) {
        console.log('[agent-router] All tools succeeded, finishing')
        break
      }

      console.log('[agent-router] Some tools failed, retrying...')
    }

    // Build final context string
    const contextParts = allResults.map(r => {
      const status = r.success ? 'SUCCESS' : 'FAILED'
      return `[${r.name}] ${status}: ${r.output}`
    })

    if (allResults.length === 0) {
      return noTools
    }

    return {
      toolsUsed: true,
      toolResults: allResults,
      toolContext: contextParts.join('\n'),
    }
  } catch (e) {
    console.warn('[agent-router] Error:', e)
    return noTools
  }
}
