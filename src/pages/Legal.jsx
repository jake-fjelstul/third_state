import { Link } from 'react-router-dom'

const styles = {
  container: {
    minHeight: '100vh',
    backgroundColor: 'var(--bg)',
    color: 'var(--textDark)',
    fontFamily: "'Inter', system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
    paddingTop: 'var(--safe-top)',
    paddingBottom: 'var(--safe-bottom)',
    paddingLeft: '20px',
    paddingRight: '20px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  contentCard: {
    width: '100%',
    maxWidth: '720px',
    backgroundColor: 'var(--white)',
    border: '1px solid var(--border)',
    borderRadius: '24px',
    padding: '48px 40px',
    boxShadow: '0 10px 30px rgba(0, 0, 0, 0.04)',
    lineHeight: '1.7',
  },
  logoLink: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '10px',
    textDecoration: 'none',
    color: 'var(--textDark)',
    fontWeight: 800,
    fontSize: '20px',
    marginBottom: '40px',
    transition: 'opacity 0.2s',
  },
  logoSvg: {
    display: 'block',
  },
  title: {
    fontSize: '32px',
    fontWeight: 800,
    marginBottom: '8px',
    color: 'var(--textDark)',
    letterSpacing: '-0.025em',
    lineHeight: 1.2,
  },
  subtitle: {
    fontSize: '14px',
    color: 'var(--textMid)',
    marginBottom: '32px',
    borderBottom: '1px solid var(--border)',
    paddingBottom: '16px',
  },
  h2: {
    fontSize: '20px',
    fontWeight: 700,
    marginTop: '32px',
    marginBottom: '12px',
    color: 'var(--textDark)',
    letterSpacing: '-0.015em',
  },
  p: {
    fontSize: '15px',
    color: 'var(--textMid)',
    marginBottom: '16px',
  },
  ul: {
    paddingLeft: '20px',
    marginBottom: '20px',
    listStyleType: 'disc',
  },
  ol: {
    paddingLeft: '20px',
    marginBottom: '20px',
    listStyleType: 'decimal',
  },
  li: {
    fontSize: '15px',
    color: 'var(--textMid)',
    marginBottom: '8px',
  },
  emailLink: {
    color: 'var(--indigo)',
    textDecoration: 'none',
    fontWeight: 500,
  },
}

function LegalLayout({ children }) {
  return (
    <div style={styles.container}>
      <Link to="/" style={styles.logoLink}>
        <svg width="32" height="32" viewBox="0 0 56 56" fill="none" style={styles.logoSvg}>
          <circle cx="22" cy="28" r="14" stroke="var(--indigo)" strokeWidth="3.5" fill="none"/>
          <circle cx="34" cy="28" r="14" stroke="var(--indigo)" strokeWidth="3.5" fill="none"/>
        </svg>
        <span>Third Space</span>
      </Link>
      <div style={styles.contentCard}>
        {children}
      </div>
    </div>
  )
}

export function PrivacyPolicy() {
  return (
    <LegalLayout>
      <h1 style={styles.title}>Privacy Policy</h1>
      <div style={styles.subtitle}>Last updated: July 29, 2026</div>

      <p style={styles.p}>
        Third Space (&ldquo;we&rdquo;, &ldquo;us&rdquo;) operates the Third Space application at{' '}
        <a href="https://third-space-app.com" target="_blank" rel="noopener noreferrer" style={styles.emailLink}>
          third-space-app.com
        </a>{' '}
        and as an iOS application. This policy explains what information we collect, how we use it, and the choices you have.
      </p>

      <h2 style={styles.h2}>Information we collect</h2>
      <ul style={styles.ul}>
        <li style={styles.li}>
          <strong>Account information:</strong> your name, email address, and password (stored hashed, never in plain text). If you sign in with Google or Apple, we receive your name and email address from that provider.
        </li>
        <li style={styles.li}>
          <strong>Profile information you choose to provide:</strong> profile photo, bio, interests, city, and availability.
        </li>
        <li style={styles.li}>
          <strong>Content you create:</strong> circles you join or create, events you create or RSVP to, messages you send, and connection requests.
        </li>
        <li style={styles.li}>
          <strong>Usage information:</strong> which features you use, when you were last active, and diagnostic data needed to keep the service running.
        </li>
      </ul>

      <h2 style={styles.h2}>Google Calendar</h2>
      <p style={styles.p}>
        If you choose to connect your Google Calendar, we request the{' '}
        <code style={{ backgroundColor: 'var(--bg)', padding: '2px 6px', borderRadius: '4px', fontSize: '14px', fontFamily: 'monospace' }}>
          https://www.googleapis.com/auth/calendar.events
        </code>{' '}
        scope from the Google Calendar API. We use this access for exactly two purposes:
      </p>
      <ol style={styles.ol}>
        <li style={styles.li}>
          To read your upcoming calendar events so the Third Space schedule can display your existing commitments alongside Third Space meetups, helping you avoid double-booking.
        </li>
        <li style={styles.li}>
          To create a calendar event when you explicitly choose to add a Third Space meetup to your calendar.
        </li>
      </ol>
      <p style={styles.p}>
        We never read, modify, delete, or share your calendar data for any other purpose. We do not use Google Calendar data for advertising, and we do not share it with third parties. You can disconnect Google Calendar at any time from the Schedule page, which immediately revokes our access and deletes the stored authorization tokens.
      </p>
      <p style={styles.p}>
        Third Space&apos;s use of information received from Google APIs adheres to the Google API Services User Data Policy, including the Limited Use requirements.
      </p>

      <h2 style={styles.h2}>How we use your information</h2>
      <p style={styles.p}>
        We use your information to operate the service: to authenticate you, show you relevant circles and people, deliver messages and notifications, and keep the platform safe. We do not sell your personal information. We do not show advertising and we do not share your data with advertisers.
      </p>

      <h2 style={styles.h2}>Who can see your information</h2>
      <p style={styles.p}>
        Your profile, the circles you join, and the events you RSVP to are visible to other Third Space users according to the privacy settings you choose. Direct messages are visible only to you and the people in that conversation.
      </p>

      <h2 style={styles.h2}>Data storage and security</h2>
      <p style={styles.p}>
        Your data is stored using Supabase, which hosts our database and file storage. Data is encrypted in transit and at rest. Access to your data is restricted by row-level security policies so that users can only read information they are entitled to see.
      </p>

      <h2 style={styles.h2}>Push notifications</h2>
      <p style={styles.p}>
        If you enable push notifications, we store a device token that lets us send notifications to your device. You can disable notifications at any time in your device settings or in the Third Space settings screen.
      </p>

      <h2 style={styles.h2}>Your choices</h2>
      <ul style={styles.ul}>
        <li style={styles.li}>You can edit or delete your profile information at any time.</li>
        <li style={styles.li}>You can disconnect Google Calendar at any time.</li>
        <li style={styles.li}>You can delete your account, which permanently removes your profile, messages, and associated data.</li>
        <li style={styles.li}>You can block or report other users.</li>
      </ul>

      <h2 style={styles.h2}>Children</h2>
      <p style={styles.p}>
        Third Space is not intended for children under 13. We do not knowingly collect information from children under 13.
      </p>

      <h2 style={styles.h2}>Changes to this policy</h2>
      <p style={styles.p}>
        We may update this policy. When we do, we will revise the &ldquo;Last updated&rdquo; date above and, for significant changes, notify you in the app.
      </p>

      <h2 style={styles.h2}>Contact</h2>
      <p style={styles.p}>
        Questions about this policy:{' '}
        <a href="mailto:support@third-space-app.com" style={styles.emailLink}>
          support@third-space-app.com
        </a>
      </p>
    </LegalLayout>
  )
}

export function Terms() {
  return (
    <LegalLayout>
      <h1 style={styles.title}>Terms of Service</h1>
      <div style={styles.subtitle}>Last updated: July 29, 2026</div>

      <h2 style={styles.h2}>Acceptance</h2>
      <p style={styles.p}>
        By creating an account or using Third Space, you agree to these terms. If you do not agree, do not use the service.
      </p>

      <h2 style={styles.h2}>Eligibility</h2>
      <p style={styles.p}>
        You must be at least 13 years old to use Third Space. If you are under 18, you may only use Third Space with the consent of a parent or guardian.
      </p>

      <h2 style={styles.h2}>Your account</h2>
      <p style={styles.p}>
        You are responsible for keeping your account credentials secure and for all activity that happens under your account. Provide accurate information when you sign up.
      </p>

      <h2 style={styles.h2}>Acceptable use</h2>
      <p style={styles.p}>
        Third Space exists to help people build real-world connections. You agree not to:
      </p>
      <ul style={styles.ul}>
        <li style={styles.li}>Harass, threaten, impersonate, or abuse other users</li>
        <li style={styles.li}>Post content that is illegal, hateful, sexually explicit, or violent</li>
        <li style={styles.li}>Spam, scam, or advertise commercial products without permission</li>
        <li style={styles.li}>Attempt to access accounts or data that are not yours</li>
        <li style={styles.li}>Scrape, reverse engineer, or interfere with the service</li>
      </ul>
      <p style={styles.p}>
        We may remove content and suspend or terminate accounts that violate these rules.
      </p>

      <h2 style={styles.h2}>Content you post</h2>
      <p style={styles.p}>
        You retain ownership of the content you post. By posting, you grant us a license to display and distribute that content within Third Space as necessary to operate the service.
      </p>

      <h2 style={styles.h2}>Meeting in person</h2>
      <p style={styles.p}>
        Third Space helps you find and schedule in-person meetups. You are responsible for your own safety when meeting people. We do not conduct background checks on users. Meet in public places, tell someone where you are going, and use your judgment.
      </p>

      <h2 style={styles.h2}>Service availability</h2>
      <p style={styles.p}>
        Third Space is provided &ldquo;as is&rdquo;. We do not guarantee uninterrupted availability, and we may change or discontinue features at any time.
      </p>

      <h2 style={styles.h2}>Limitation of liability</h2>
      <p style={styles.p}>
        To the fullest extent permitted by law, Third Space is not liable for indirect, incidental, or consequential damages arising from your use of the service, including any interaction or meeting arranged through it.
      </p>

      <h2 style={styles.h2}>Changes to these terms</h2>
      <p style={styles.p}>
        We may update these terms. Continued use after an update constitutes acceptance.
      </p>

      <h2 style={styles.h2}>Contact</h2>
      <p style={styles.p}>
        Questions about these terms:{' '}
        <a href="mailto:support@third-space-app.com" style={styles.emailLink}>
          support@third-space-app.com
        </a>
      </p>
    </LegalLayout>
  )
}

export function Support() {
  return (
    <LegalLayout>
      <h1 style={styles.title}>Support</h1>
      <div style={styles.subtitle}>Last updated: July 29, 2026</div>

      <h2 style={styles.h2}>Contact us</h2>
      <p style={styles.p}>
        Questions, bug reports, or account issues:{' '}
        <a href="mailto:support@third-space-app.com" style={styles.emailLink}>
          support@third-space-app.com
        </a>
      </p>
      <p style={styles.p}>We respond within 2 business days.</p>

      <h2 style={styles.h2}>Report a safety concern</h2>
      <p style={styles.p}>
        If someone on Third Space is harassing you, spamming, or behaving unsafely, you can report them directly in the app. Open their profile, tap the menu in the top right, and choose Report. You can also report an individual message by pressing and holding it.
      </p>
      <p style={styles.p}>
        We review every report within 24 hours and take action including warnings, content removal, and account termination.
      </p>
      <p style={styles.p}>
        If you are in immediate danger, contact your local emergency services.
      </p>

      <h2 style={styles.h2}>Block someone</h2>
      <p style={styles.p}>
        To stop all contact with another user, open their profile, tap the menu in the top right, and choose Block. Blocking is mutual — neither of you will be able to see or contact the other. You can manage blocked users any time from Settings.
      </p>

      <h2 style={styles.h2}>Delete your account</h2>
      <p style={styles.p}>
        Open Settings and choose Delete Account. This permanently removes your profile, messages, connections, and circle memberships. This cannot be undone. If you have trouble, email us at{' '}
        <a href="mailto:support@third-space-app.com" style={styles.emailLink}>
          support@third-space-app.com
        </a>{' '}
        and we will remove your account within 5 business days.
      </p>

      <h2 style={styles.h2}>Common questions</h2>
      <p style={styles.p}>
        <strong>How do I connect my Google Calendar?</strong><br />
        Open the Schedule tab and tap Connect Google Calendar. We use your calendar only to display your existing events alongside Third Space meetups and to add Third Space events when you choose to. You can disconnect at any time.
      </p>
      <p style={styles.p}>
        <strong>How does the battery work?</strong><br />
        Your battery reflects real-world activity. Attending meetups and connecting with people charges it. It drains slowly during inactivity.
      </p>
      <p style={styles.p}>
        <strong>Why can&apos;t I join a circle?</strong><br />
        Some circles are private and require an application. Answer the questions the organizer set and they will review your request.
      </p>
      <p style={styles.p}>
        <strong>I forgot my password.</strong><br />
        On the sign-in screen, choose Forgot password and follow the emailed link.
      </p>
    </LegalLayout>
  )
}

