import { useEffect, useRef, useState, useCallback } from 'react'
import { getDB } from '../lib/db/index'
import type Database from '@tauri-apps/plugin-sql'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'tool'
  text: string
  toolResults?: { name: string; status: 'ok' | 'fail'; descriptionKo?: string }[]
  createdAt: string
}

export function useChatHistory() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const dbRef = useRef<Database | null>(null)

  // Load messages on mount
  useEffect(() => {
    let mounted = true
    setIsLoading(true)
    setError(null)

    getDB().then(db => {
      if (!mounted) return
      dbRef.current = db
      return db.select<{
        id: string
        role: string
        text: string
        tool_results: string | null
        created_at: string
      }[]>(
        'SELECT id, role, text, tool_results, created_at FROM messages ORDER BY created_at ASC'
      )
    }).then(rows => {
      if (!mounted) return
      const parsed: ChatMessage[] = (rows || []).map(row => ({
        id: row.id,
        role: row.role as 'user' | 'assistant' | 'tool',
        text: row.text,
        toolResults: row.tool_results ? JSON.parse(row.tool_results) : undefined,
        createdAt: row.created_at,
      }))
      setMessages(parsed)
    }).catch(err => {
      console.error('[useChatHistory] Failed to load:', err)
      setError(String(err))
    }).finally(() => {
      if (mounted) setIsLoading(false)
    })

    return () => { mounted = false }
  }, [])

  const addMessage = useCallback(async (msg: Omit<ChatMessage, 'createdAt'>) => {
    try {
      const db = dbRef.current || await getDB()
      await db.execute(
        'INSERT INTO messages (id, role, text, tool_results) VALUES ($1, $2, $3, $4)',
        [msg.id, msg.role, msg.text, msg.toolResults ? JSON.stringify(msg.toolResults) : null]
      )
      setMessages(prev => [...prev, { ...msg, createdAt: new Date().toISOString() }])
    } catch (err) {
      console.error('Failed to save message:', err)
    }
  }, [])

  const clearHistory = useCallback(async () => {
    try {
      const db = dbRef.current || await getDB()
      await db.execute('DELETE FROM messages')
      setMessages([])
    } catch (err) {
      console.error('Failed to clear history:', err)
    }
  }, [])

  return { messages, isLoading, error, addMessage, clearHistory }
}
