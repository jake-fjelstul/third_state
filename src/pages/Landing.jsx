import { Link, Navigate, useNavigate } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'
import { useAppContext } from '../context/AppContext.jsx'

const cardStyle = {
  backgroundColor: 'var(--white)',
  border: '1px solid var(--border)',
  borderRadius: '16px',
  padding: '32px',
  textAlign: 'left',
  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.02)',
  transition: 'transform 0.2s, boxShadow 0.2s, border-color 0.2s',
}

export default function LandingPage() {
  const navigate = useNavigate()
  const { session, authLoading } = useAppContext()

  // Native: the marketing page is never shown in the app. Render
  // nothing while the splash is still covering, then route onward.
  if (Capacitor.isNativePlatform()) {
    if (authLoading) return null
    return <Navigate to={session ? '/feed' : '/auth'} replace />
  }

  // Web: unchanged. Logged-out visitors and crawlers see the page.
  if (session && !authLoading) {
    return <Navigate to="/feed" replace />
  }

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: 'var(--bg)',
      color: 'var(--textDark)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
    }}>
      <style>{`
        .primary-btn {
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        .primary-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 28px rgba(91,95,239,0.45);
        }
        .primary-btn:active {
          transform: translateY(0);
        }
        .hover-btn {
          transition: background-color 0.2s, border-color 0.2s;
        }
        .hover-btn:hover {
          background-color: var(--indigoLt) !important;
          border-color: var(--indigo) !important;
        }
        .hover-link {
          transition: color 0.2s;
        }
        .hover-link:hover {
          color: var(--indigo) !important;
        }
        .feature-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 24px rgba(0, 0, 0, 0.04);
          border-color: var(--indigo) !important;
        }
        .grid-container {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 24px;
          margin-top: 40px;
          width: 100%;
        }
        @media (max-width: 768px) {
          .grid-container {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      {/* HEADER BAR (sticky top) */}
      <header style={{
        position: 'sticky',
        top: 0,
        zIndex: 1000,
        backgroundColor: 'var(--white)',
        borderBottom: '1px solid var(--border)',
        width: '100%',
        padding: 'max(16px, calc(env(safe-area-inset-top) + 16px)) 24px 16px',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
      }}>
        <div style={{
          width: '100%',
          maxWidth: '900px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          {/* Logo */}
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}>
            <svg width="28" height="28" viewBox="0 0 56 56" fill="none">
              <circle cx="22" cy="28" r="14" stroke="var(--indigo)" strokeWidth="3.5" fill="none"/>
              <circle cx="34" cy="28" r="14" stroke="var(--indigo)" strokeWidth="3.5" fill="none"/>
            </svg>
            <span style={{ fontSize: '20px', fontWeight: 800, color: 'var(--textDark)' }}>Third Space</span>
          </Link>
          
          {/* Sign In Button */}
          <button onClick={() => navigate('/auth')} style={{
            padding: '8px 18px',
            borderRadius: '999px',
            border: '1px solid var(--border)',
            backgroundColor: 'var(--white)',
            color: 'var(--textDark)',
            fontSize: '14px',
            fontWeight: 600,
            cursor: 'pointer',
          }} className="hover-btn">
            Sign In
          </button>
        </div>
      </header>

      {/* MAIN CONTAINER */}
      <main style={{
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}>
        {/* HERO SECTION */}
        <section style={{
          minHeight: 'calc(100vh - 73px)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          textAlign: 'center',
          padding: '40px 24px',
          maxWidth: '900px',
          width: '100%',
          boxSizing: 'border-box',
        }}>
          <h1 style={{
            fontSize: '56px',
            fontWeight: 850,
            color: 'var(--textDark)',
            margin: '0 0 16px 0',
            letterSpacing: '-0.03em',
            lineHeight: 1.1,
          }}>Third Space</h1>
          <p style={{
            fontSize: '22px',
            fontWeight: 600,
            color: 'var(--indigo)',
            margin: '0 0 24px 0',
            maxWidth: '600px',
            lineHeight: 1.3,
          }}>Where online connection turns into real-world friendship.</p>
          <p style={{
            fontSize: '16px',
            color: 'var(--textMid)',
            margin: '0 0 40px 0',
            maxWidth: '640px',
            lineHeight: 1.6,
          }}>
            Third Space is a social platform that helps you find people who share your interests, join local groups, and schedule in-person meetups. We're built for getting offline — every feature is designed to move you from scrolling to actually showing up.
          </p>
          
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
            <button onClick={() => navigate('/auth')} style={{
              padding: '16px 40px',
              borderRadius: '999px',
              border: 'none',
              background: 'linear-gradient(135deg, #5B5FEF 0%, #7B6FFF 100%)',
              color: '#FFFFFF',
              fontSize: '18px',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 8px 24px rgba(91,95,239,0.38)',
            }} className="primary-btn">
              Get Started
            </button>
            <Link to="/auth" style={{
              fontSize: '14px',
              color: 'var(--textMid)',
              textDecoration: 'none',
              fontWeight: 500,
            }} className="hover-link">
              Already have an account? <span style={{ color: 'var(--indigo)', fontWeight: 600 }}>Sign in</span>
            </Link>
          </div>
        </section>

        {/* "WHAT IS THIRD SPACE?" SECTION */}
        <section style={{
          padding: '60px 24px',
          backgroundColor: 'var(--white)',
          borderTop: '1px solid var(--border)',
          borderBottom: '1px solid var(--border)',
          width: '100%',
          display: 'flex',
          justifyContent: 'center',
        }}>
          <div style={{ maxWidth: '900px', width: '100%', textAlign: 'center' }}>
            <h2 style={{
              fontSize: '32px',
              fontWeight: 800,
              color: 'var(--textDark)',
              marginBottom: '16px',
              letterSpacing: '-0.02em',
            }}>What is Third Space?</h2>
            <p style={{
              fontSize: '16px',
              color: 'var(--textMid)',
              maxWidth: '720px',
              margin: '0 auto',
              lineHeight: 1.7,
            }}>
              A third space is the place that isn't home and isn't work — the coffee shop, the climbing gym, the weekly board game night. Those places have been disappearing. Third Space helps you find yours, and the people in it.
            </p>
          </div>
        </section>

        {/* FEATURES SECTION */}
        <section style={{
          padding: '80px 24px',
          maxWidth: '900px',
          width: '100%',
          textAlign: 'center',
        }}>
          <h2 style={{
            fontSize: '32px',
            fontWeight: 800,
            color: 'var(--textDark)',
            marginBottom: '12px',
            letterSpacing: '-0.02em',
          }}>How it works</h2>
          
          <div className="grid-container">
            <div style={cardStyle} className="feature-card">
              <h3 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--textDark)', marginBottom: '12px' }}>Join Circles</h3>
              <p style={{ fontSize: '15px', color: 'var(--textMid)', lineHeight: 1.6, margin: 0 }}>
                Interest-based groups for whatever you're into — climbing, photography, board games, running. Browse what's active near you and join the ones that fit.
              </p>
            </div>
            
            <div style={cardStyle} className="feature-card">
              <h3 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--textDark)', marginBottom: '12px' }}>Schedule Meetups</h3>
              <p style={{ fontSize: '15px', color: 'var(--textMid)', lineHeight: 1.6, margin: 0 }}>
                Create or RSVP to real in-person events. See everything on one schedule so you never double-book, and get reminders before they happen.
              </p>
            </div>
            
            <div style={cardStyle} className="feature-card">
              <h3 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--textDark)', marginBottom: '12px' }}>Connect and Chat</h3>
              <p style={{ fontSize: '15px', color: 'var(--textMid)', lineHeight: 1.6, margin: 0 }}>
                Group chat for every Circle, plus direct messages once you've connected with someone. Play a quick game of chess or Connect Four while you make plans.
              </p>
            </div>
            
            <div style={cardStyle} className="feature-card">
              <h3 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--textDark)', marginBottom: '12px' }}>Show Up</h3>
              <p style={{ fontSize: '15px', color: 'var(--textMid)', lineHeight: 1.6, margin: 0 }}>
                Our battery system rewards real-world attendance, not endless scrolling. The more you actually show up, the more the app opens up.
              </p>
            </div>
          </div>
        </section>

        {/* GOOGLE CALENDAR SECTION */}
        <section style={{
          padding: '60px 24px',
          backgroundColor: 'var(--white)',
          borderTop: '1px solid var(--border)',
          borderBottom: '1px solid var(--border)',
          width: '100%',
          display: 'flex',
          justifyContent: 'center',
        }}>
          <div style={{ maxWidth: '720px', width: '100%', textAlign: 'center' }}>
            <h2 style={{
              fontSize: '28px',
              fontWeight: 800,
              color: 'var(--textDark)',
              marginBottom: '16px',
              letterSpacing: '-0.02em',
            }}>Google Calendar integration</h2>
            <p style={{
              fontSize: '15px',
              color: 'var(--textMid)',
              lineHeight: 1.7,
              marginBottom: '20px',
            }}>
              Third Space can optionally sync with your Google Calendar. When you connect it, we show your existing commitments alongside your Third Space meetups so you never double-book, and you can add any Third Space event to your calendar with one tap. We only access your calendar events for these two purposes, we never share your calendar data, and you can disconnect at any time from the Schedule page.
            </p>
            <p style={{
              fontSize: '13px',
              color: 'var(--textLight)',
              lineHeight: 1.5,
              margin: 0,
            }}>
              Third Space's use of information received from Google APIs adheres to the Google API Services User Data Policy, including the Limited Use requirements.
            </p>
          </div>
        </section>

        {/* FINAL CTA SECTION */}
        <section style={{
          padding: '80px 24px',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          maxWidth: '900px',
          width: '100%',
        }}>
          <h2 style={{
            fontSize: '36px',
            fontWeight: 800,
            color: 'var(--textDark)',
            marginBottom: '24px',
            letterSpacing: '-0.025em',
          }}>Find your people.</h2>
          <button onClick={() => navigate('/auth')} style={{
            padding: '16px 40px',
            borderRadius: '999px',
            border: 'none',
            background: 'linear-gradient(135deg, #5B5FEF 0%, #7B6FFF 100%)',
            color: '#FFFFFF',
            fontSize: '18px',
            fontWeight: 600,
            cursor: 'pointer',
            boxShadow: '0 8px 24px rgba(91,95,239,0.38)',
          }} className="primary-btn">
            Get Started
          </button>
        </section>
      </main>

      {/* FOOTER */}
      <footer style={{
        padding: '48px 24px',
        borderTop: '1px solid var(--border)',
        backgroundColor: 'var(--white)',
        width: '100%',
        display: 'flex',
        justifyContent: 'center',
      }}>
        <div style={{
          width: '100%',
          maxWidth: '900px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '24px',
        }}>
          <span style={{ fontWeight: 800, fontSize: '18px', color: 'var(--textDark)' }}>Third Space</span>
          <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', justifyContent: 'center' }}>
            <Link to="/privacy" style={{ color: 'var(--textMid)', textDecoration: 'none', fontSize: '14px', fontWeight: 500 }} className="hover-link">Privacy Policy</Link>
            <Link to="/terms" style={{ color: 'var(--textMid)', textDecoration: 'none', fontSize: '14px', fontWeight: 500 }} className="hover-link">Terms of Service</Link>
            <Link to="/support" style={{ color: 'var(--textMid)', textDecoration: 'none', fontSize: '14px', fontWeight: 500 }} className="hover-link">Support</Link>
            <a href="mailto:support@third-space-app.com" style={{ color: 'var(--textMid)', textDecoration: 'none', fontSize: '14px', fontWeight: 500 }} className="hover-link">Contact Support</a>
          </div>
          <span style={{ color: 'var(--textLight)', fontSize: '13px' }}>&copy; 2026 Third Space</span>
        </div>
      </footer>
    </div>
  )
}
