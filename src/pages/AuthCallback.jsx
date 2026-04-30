import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

export default function AuthCallback() {
  const navigate = useNavigate()

  useEffect(() => {
    const t = setTimeout(() => navigate('/feed', { replace: true }), 600)
    return () => clearTimeout(t)
  }, [navigate])

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <p style={{ color: 'var(--textMid)' }}>Signing you in...</p>
    </div>
  )
}
