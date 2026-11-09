import { Component } from 'react'

/*
 * Keeps one broken screen from taking down the whole app. Without this, any
 * render error unmounts React's root and the phone just shows the black
 * background.
 */
export default class ScreenErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('[ScreenErrorBoundary]', error, info?.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div role="alert" style={{
        minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 12, padding: '40px 24px', textAlign: 'center', color: 'var(--textDark)',
      }}>
        <p style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Something went wrong on this screen.</p>
        <p style={{ margin: 0, fontSize: 14, color: 'var(--textMid)' }}>{String(this.state.error?.message || '')}</p>
        <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
          {this.props.onBack && (
            <button type="button" onClick={this.props.onBack} style={{
              minHeight: 44, padding: '10px 18px', borderRadius: 12, border: '1px solid var(--border)',
              background: 'transparent', color: 'var(--textDark)', fontWeight: 600, cursor: 'pointer',
            }}>Go back</button>
          )}
          <button type="button" onClick={() => this.setState({ error: null })} style={{
            minHeight: 44, padding: '10px 18px', borderRadius: 12, border: 'none',
            background: 'var(--indigo)', color: '#fff', fontWeight: 600, cursor: 'pointer',
          }}>Try again</button>
        </div>
      </div>
    )
  }
}
