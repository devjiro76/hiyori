import { Component } from 'react'
import type { ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  override componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  override render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 15, 15, 0.95)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#eee',
            fontFamily: 'system-ui, sans-serif',
            gap: '12px',
            padding: '24px',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '14px', fontWeight: 700, color: '#f87171' }}>
            오류가 발생했습니다
          </div>
          <div
            style={{
              fontSize: '12px',
              color: '#888',
              maxWidth: '320px',
              wordBreak: 'break-all',
              background: 'rgba(0,0,0,0.3)',
              borderRadius: '10px',
              padding: '10px 12px',
            }}
          >
            {this.state.error?.message ?? '알 수 없는 오류'}
          </div>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: '4px',
              padding: '10px 24px',
              fontSize: '13px',
              fontWeight: 600,
              border: 'none',
              borderRadius: '12px',
              background: '#2563eb',
              color: '#fff',
              cursor: 'pointer',
            }}
          >
            재시작
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
