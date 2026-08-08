import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const url = new URL(req.url)
  const pathname = url.pathname

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  const googleClientId = Deno.env.get('GOOGLE_CLIENT_ID') || Deno.env.get('VITE_GOOGLE_CLIENT_ID') || ''
  const googleClientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET') || Deno.env.get('VITE_GOOGLE_OAUTH_CLIENT_ID') || ''

  const redirectUri = `${supabaseUrl}/functions/v1/google-calendar/callback`

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

  // ---------------------------------------------------------------------------
  // Action 2: CALLBACK (GET /callback or action: 'callback')
  // ---------------------------------------------------------------------------
  if (pathname.endsWith('/callback') || url.searchParams.has('code')) {
    const code = url.searchParams.get('code')
    const stateRaw = url.searchParams.get('state')

    if (!code || !stateRaw) {
      return new Response('Missing code or state', { status: 400, headers: corsHeaders })
    }

    try {
      let stateData: any = {}
      try {
        stateData = JSON.parse(atob(stateRaw))
      } catch {
        stateData = JSON.parse(stateRaw)
      }

      const { userId, platform, webRedirectUrl } = stateData

      if (!userId) {
        return new Response('Invalid state (missing user id)', { status: 400, headers: corsHeaders })
      }

      // Exchange authorization code for tokens
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: googleClientId,
          client_secret: googleClientSecret,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        }),
      })

      const tokenData = await tokenRes.json()

      if (!tokenRes.ok || tokenData.error) {
        console.error('[google-calendar-callback] Token exchange error:', tokenData)
        return new Response(`Token exchange failed: ${tokenData.error_description || tokenData.error}`, { status: 400, headers: corsHeaders })
      }

      const { access_token, refresh_token, expires_in, scope } = tokenData
      const expires_at = new Date(Date.now() + (expires_in || 3600) * 1000).toISOString()

      // Upsert into google_calendar_tokens
      const { error: dbErr } = await supabaseAdmin
        .from('google_calendar_tokens')
        .upsert({
          user_id: userId,
          refresh_token,
          access_token,
          expires_at,
          scope,
          updated_at: new Date().toISOString(),
        })

      if (dbErr) {
        console.error('[google-calendar-callback] DB error:', dbErr)
        return new Response(`Database store failed: ${dbErr.message}`, { status: 500, headers: corsHeaders })
      }

      // Determine redirect location
      if (platform === 'native') {
        return Response.redirect('com.thirdspace.social://calendar-callback?ok=1', 302)
      } else {
        const dest = webRedirectUrl || 'https://third-space-app.com/calendar/callback?ok=1'
        return Response.redirect(dest, 302)
      }
    } catch (err: any) {
      console.error('[google-calendar-callback] Exception:', err)
      return new Response(`Callback failed: ${err.message}`, { status: 500, headers: corsHeaders })
    }
  }

  // ---------------------------------------------------------------------------
  // Authenticated Actions (start, token, disconnect)
  // ---------------------------------------------------------------------------
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const jwt = authHeader.replace('Bearer ', '').trim()
  const { data: userData, error: authErr } = await supabaseAdmin.auth.getUser(jwt)
  if (authErr || !userData?.user) {
    return new Response(JSON.stringify({ error: 'Invalid auth token' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const user = userData.user

  let body: any = {}
  try {
    body = await req.json()
  } catch {}

  const action = body.action || url.searchParams.get('action') || (pathname.split('/').pop())

  // Action 1: START
  if (action === 'start') {
    const platform = body.platform || 'web'
    const webRedirectUrl = body.webRedirectUrl || ''
    const stateObj = { userId: user.id, platform, webRedirectUrl }
    const state = btoa(JSON.stringify(stateObj))

    const authUrlParams = new URLSearchParams({
      response_type: 'code',
      client_id: googleClientId,
      redirect_uri: redirectUri,
      scope: 'https://www.googleapis.com/auth/calendar.events',
      access_type: 'offline',
      prompt: 'consent',
      state,
    })

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${authUrlParams.toString()}`

    return new Response(JSON.stringify({ url: authUrl }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Action 3: TOKEN
  if (action === 'token') {
    const { data: row, error: rowErr } = await supabaseAdmin
      .from('google_calendar_tokens')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()

    if (rowErr || !row) {
      return new Response(JSON.stringify({ error: 'Not connected' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const expiresAtMs = row.expires_at ? new Date(row.expires_at).getTime() : 0
    const nowMs = Date.now()

    // If access token is valid for > 60 seconds, return stored access token
    if (row.access_token && expiresAtMs > nowMs + 60000) {
      return new Response(JSON.stringify({ access_token: row.access_token }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Refresh token at Google token endpoint
    const refreshRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: googleClientId,
        client_secret: googleClientSecret,
        refresh_token: row.refresh_token,
        grant_type: 'refresh_token',
      }),
    })

    const refreshData = await refreshRes.json()

    if (!refreshRes.ok || refreshData.error) {
      if (refreshData.error === 'invalid_grant') {
        // Token has been revoked or expired; delete row so user can reconnect
        await supabaseAdmin.from('google_calendar_tokens').delete().eq('user_id', user.id)
        return new Response(JSON.stringify({ error: 'invalid_grant' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      return new Response(JSON.stringify({ error: refreshData.error_description || refreshData.error }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const newAccessToken = refreshData.access_token
    const newExpiresIn = refreshData.expires_in || 3600
    const newExpiresAt = new Date(Date.now() + newExpiresIn * 1000).toISOString()

    await supabaseAdmin
      .from('google_calendar_tokens')
      .update({
        access_token: newAccessToken,
        expires_at: newExpiresAt,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)

    return new Response(JSON.stringify({ access_token: newAccessToken }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Action 4: DISCONNECT
  if (action === 'disconnect') {
    const { data: row } = await supabaseAdmin
      .from('google_calendar_tokens')
      .select('refresh_token')
      .eq('user_id', user.id)
      .maybeSingle()

    if (row?.refresh_token) {
      try {
        await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(row.refresh_token)}`, {
          method: 'POST',
        })
      } catch (revokeErr) {
        console.warn('[google-calendar-disconnect] revoke warning', revokeErr)
      }
    }

    await supabaseAdmin.from('google_calendar_tokens').delete().eq('user_id', user.id)

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  return new Response(JSON.stringify({ error: 'Unknown action' }), {
    status: 400,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
