import { useEffect, useRef, useState, useCallback } from 'react'
import Database from '@tauri-apps/plugin-sql'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'tool'
  text: string
  toolResults?: { name: string; status: 'ok' | 'fail'; descriptionKo?: string }[]
  createdAt: string
}

let dbInstance: Database | null = null
let initPromise: Promise<Database> | null = null

async function initDB(): Promise<Database> {
  if (dbInstance) return dbInstance
  if (initPromise) return initPromise

  initPromise = Database.load('sqlite:chat_history.db').then(db => {
    dbInstance = db
    return db.execute(`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        role TEXT NOT NULL,
        text TEXT NOT NULL,
        tool_results TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).then(() => db)
  })

  return initPromise
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
    console.log('[useChatHistory] Loading messages...')

    initDB().then(db => {
      if (!mounted) return
      dbRef.current = db
      console.log('[useChatHistory] DB initialized')
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
      console.log('[useChatHistory] Loaded rows:', rows?.length || 0)
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
      const db = dbRef.current || await initDB()
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
      const db = dbRef.current || await initDB()
      await db.execute('DELETE FROM messages')
      setMessages([])
    } catch (err) {
      console.error('Failed to clear history:', err)
    }
  }, [])

  return { messages, isLoading, error, addMessage, clearHistory }
}
