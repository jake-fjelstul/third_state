import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import { AppProvider } from './context/AppContext.jsx'
import { Capacitor } from '@capacitor/core'

// Native-only setup: let the WebView extend under the status bar, and keep
// the status bar text color readable against the current theme.
if (Capacitor.isNativePlatform()) {
  import('@capacitor/status-bar').then(({ StatusBar, Style }) => {
    const applyStatusBarStyle = () => {
      const isDark = document.documentElement.classList.contains('dark')
      // Style.Light renders LIGHT text (for dark backgrounds).
      // Style.Dark renders DARK text (for light backgrounds).
      StatusBar.setStyle({ style: isDark ? Style.Light : Style.Dark }).catch(() => {})
    }

    StatusBar.setOverlaysWebView({ overlay: true }).catch(() => {})
    applyStatusBarStyle()

    // Re-apply whenever the app toggles between light and dark mode.
    const observer = new MutationObserver(applyStatusBarStyle)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    })
  })

  // Handle OAuth callbacks delivered via the thirdspace:// custom URL scheme.
  import('@capacitor/app').then(({ App: CapApp }) => {
    CapApp.addListener('appUrlOpen', async ({ url }) => {
      if (!url || !url.startsWith('thirdspace://')) return

      const { supabase } = await import('./lib/supabase')

      try {
        // Supabase may return either a PKCE authorization code in the query
        // string, or access/refresh tokens in the URL fragment, depending on
        // the configured flow type. Handle both.
        const parsed = new URL(url)
        const code = parsed.searchParams.get('code')

        if (code) {
          await supabase.auth.exchangeCodeForSession(code)
        } else {
          const fragment = url.includes('#') ? url.split('#')[1] : ''
          const params = new URLSearchParams(fragment)
          const access_token = params.get('access_token')
          const refresh_token = params.get('refresh_token')
          if (access_token && refresh_token) {
            await supabase.auth.setSession({ access_token, refresh_token })
          }
        }
      } catch (err) {
        console.error('[deeplink] Failed to complete OAuth session', err)
      }

      // Dismiss the in-app browser regardless of outcome.
      try {
        const { Browser } = await import('@capacitor/browser')
        await Browser.close()
      } catch {}
    })
  })
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AppProvider>
        <App />
      </AppProvider>
    </BrowserRouter>
  </StrictMode>,
)

// Hide the splash screen once React has painted.
if (Capacitor.isNativePlatform()) {
  import('@capacitor/splash-screen').then(({ SplashScreen }) => {
    setTimeout(() => SplashScreen.hide().catch(() => {}), 600)
  })
}
