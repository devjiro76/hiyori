import { describe, it, expect } from 'vitest'
import { buildToolsPayload, TOOL_REGISTRY } from './tools'

describe('buildToolsPayload', () => {
  const payload = buildToolsPayload()

  it('returns an array matching TOOL_REGISTRY length', () => {
    expect(payload).toHaveLength(TOOL_REGISTRY.length)
  })

  it('each entry has type "function"', () => {
    for (const entry of payload) {
      expect(entry.type).toBe('function')
    }
  })

  it('each entry has function.name and function.description', () => {
    for (const entry of payload) {
      expect(entry.function.name).toBeTruthy()
      expect(entry.function.description).toBeTruthy()
    }
  })

  it('each entry has parameters with type "object"', () => {
    for (const entry of payload) {
      expect(entry.function.parameters.type).toBe('object')
      expect(entry.function.parameters).toHaveProperty('properties')
      expect(entry.function.parameters).toHaveProperty('required')
    }
  })

  it('tool names are unique', () => {
    const names = payload.map(e => e.function.name)
    expect(new Set(names).size).toBe(names.length)
  })

  it('includes run_shell tool', () => {
    const shell = payload.find(e => e.function.name === 'run_shell')
    expect(shell).toBeDefined()
    expect(shell!.function.parameters.required).toContain('command')
  })

  it('open_url has url as required param', () => {
    const openUrl = payload.find(e => e.function.name === 'open_url')
    expect(openUrl).toBeDefined()
    expect(openUrl!.function.parameters.required).toContain('url')
  })

  it('get_system_info has enum for infoType', () => {
    const sysInfo = payload.find(e => e.function.name === 'get_system_info')
    expect(sysInfo).toBeDefined()
    const infoType = sysInfo!.function.parameters.properties['infoType'] as any
    expect(infoType.enum).toEqual(['battery', 'memory', 'disk', 'hostname'])
  })
})
