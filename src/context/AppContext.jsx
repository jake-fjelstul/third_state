import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react'
import {
  listMyMeetups,
  rsvp as rsvpDb,
  cancelRsvp as cancelRsvpDb,
  createEvent,
} from '../lib/events'
import { supabase } from '../lib/supabase'
import { updatePrivacy, defaultPrivacy } from '../lib/profiles'
import {
  fetchProfileForUser,
  isProfileSessionFatalError,
  signOut as authSignOut,
} from '../lib/auth'
import {
  listMyConnections,
  sendConnectionRequest,
  acceptConnectionRequest,
  declineConnectionRequest,
  disconnectFrom,
} from '../lib/connections'
import {
  listMyCircleIds,
  createCircle as createCircleDb,
  createHoopsForCircle,
  joinCircle as joinCircleDb,
  leaveCircle as leaveCircleDb,
  applyToCircle as applyToCircleDb,
  listApplicationsForCircle,
  approveApplication as approveAppDb,
  declineApplication as declineAppDb,
} from '../lib/circles'
import {
  listChats as listChatsDb,
  sendMessage as sendMessageDb,
  markRead as markReadDb,
  startDM as startDmDb,
  hideChat as hideChatDb,
} from '../lib/chat'
import { listNotifications, markRead as markNotifReadDb, markAllRead as markAllNotifsReadDb, deleteNotification as deleteNotifDb, mapNotificationRow, deleteNotificationsForChat, deleteNotifications } from '../lib/notifications'
import { redeemInvite } from '../lib/invites'
import { createChatGame, commitGameMove, resignGame } from '../lib/games'
import { createPoll as createPollDb } from '../lib/polls'
import { blockUser, unblockUser, listBlockedUserIds } from '../lib/moderation'
import {
  getDailyQuestion as getDailyQuestionDb,
  answerDailyQuestion as answerDailyQuestionDb,
  dismissDailyQuestion as dismissDailyQuestionDb,
  syncQuestionReveals as syncQuestionRevealsDb,
  getPendingQuestion as getPendingQuestionDb,
  askSpontaneousQuestion as askSpontaneousQuestionDb,
  answerSpontaneousQuestion as answerSpontaneousQuestionDb,
  cancelSpontaneousQuestion as cancelSpontaneousQuestionDb,
} from '../lib/questions'

const AppContext = createContext(null)

const UI_STORAGE_KEY = 'ts-ui-state'
const PENDING_INVITE_KEY = 'ts.pendingInviteToken'

export function AppProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null)
  const [joinedCircles, setJoinedCircles] = useState([])
  const [session, setSession] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [profileLoading, setProfileLoading] = useState(false)
  const [recentInviter, setRecentInviter] = useState(null)
  const [meetups, setMeetups] = useState([])         // events the user has RSVP'd to (full event objects)
  const [rsvpdEventIds, setRsvpdEventIds] = useState(new Set()) // O(1) lookup for isRsvpd
  const [theme, setTheme] = useState('dark')
  const [connections, setConnections] = useState([])
  const [notifications, setNotifications] = useState([])
  const [reconnectThresholdDays, setReconnectThresholdDays] = useState(21)
  const [searchRadius, setSearchRadius] = useState(10)
  const [pendingApplications, setPendingApplications] = useState([])
  const [circleMembershipVersion, setCircleMembershipVersion] = useState(0)

  const [chatState, setChatState] = useState({}) // { [chatId]: { id, type, circleId, name, lastMessage, time, unread, memberCount } }
  const [chatStateLoading, setChatStateLoading] = useState(false)
  const [currentlyOpenChatId, setCurrentlyOpenChatId] = useState(null)
  const [profileError, setProfileError] = useState(null)
  const [blockedUserIds, setBlockedUserIds] = useState([])

  const [discoverySwipes, setDiscoverySwipes] = useState(() => {
    return { date: new Date().toDateString(), person: 0, circle: 0, event: 0 }
  })

  // Battery state
  const [batteryPoints, setBatteryPoints] = useState(40)
  const [lastActiveDate, setLastActiveDate] = useState(() => {
    return window.localStorage.getItem('ts_last_active') ?? new Date().toDateString()
  })

  useEffect(() => {
    let mounted = true

    // Initial session check
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return
      setSession(session)
      setAuthLoading(false)
    })

    // Subscribe to changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setAuthLoading(false)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  const mapProfileToCurrentUser = useCallback((profile) => ({
    id: profile.id,
    name: profile.name,
    age: profile.age,
    city: profile.city,
    bio: profile.bio,
    avatar: profile.avatar_url || '',
    intents: profile.intents || [],
    intentCapturedAt: profile.intentCapturedAt || null,
    intentNote: profile.intentNote || '',
    interests: profile.interests || [],
    latitude: profile.latitude,
    longitude: profile.longitude,
    privacy: profile.privacy ?? defaultPrivacy(),
    notificationPrefs: profile.notificationPrefs,
    stats: { circlesJoined: 0, meetupsAttended: 0, connections: 0 },
  }), [])

  const resetLocalAuthState = useCallback(() => {
    setCurrentUser(null)
    setJoinedCircles([])
    setPendingApplications([])
    setConnections([])
    setMeetups([])
    setRsvpdEventIds(new Set())
    setChatState({})
    setNotifications([])
    try { window.localStorage.removeItem(UI_STORAGE_KEY) } catch { }
  }, [])

  const refreshProfile = useCallback(async () => {
    if (!session?.user?.id) return null
    try {
      const profile = await fetchProfileForUser(session.user)
      setCurrentUser(mapProfileToCurrentUser(profile))
      if (typeof profile.theme === 'string') setTheme(profile.theme)
      if (typeof profile.reconnect_threshold_days === 'number') setReconnectThresholdDays(profile.reconnect_threshold_days)
      if (typeof profile.search_radius === 'number') setSearchRadius(profile.search_radius)
      if (typeof profile.battery_points === 'number') setBatteryPoints(profile.battery_points)
      return profile
    } catch (err) {
      if (isProfileSessionFatalError(err)) {
        await authSignOut().catch(() => {})
        resetLocalAuthState()
        setProfileError(null)
        return null
      }
      throw err
    }
  }, [mapProfileToCurrentUser, resetLocalAuthState, session?.user])

  const refreshConnections = useCallback(async () => {
    if (!session?.user?.id) return
    try {
      const list = await listMyConnections(session.user.id)
      setConnections(list)
    } catch (err) {
      console.error('[AppContext] refreshConnections failed', err)
    }
  }, [session?.user?.id])

  useEffect(() => {
    if (!currentUser?.id) { setBlockedUserIds([]); return }
    let cancelled = false
    listBlockedUserIds()
      .then(ids => { if (!cancelled) setBlockedUserIds(ids) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [currentUser?.id])

  // Load profile whenever session changes
  useEffect(() => {
    if (!session?.user) {
      setCurrentUser(null)
      setJoinedCircles([])
      setPendingApplications([])
      setConnections([])
      setMeetups([])
      setRsvpdEventIds(new Set())
      setChatState({})
      setNotifications([])
      return
    }
    let cancelled = false
    setProfileLoading(true)
    setProfileError(null)
    fetchProfileForUser(session.user)
      .then(profile => {
        if (cancelled) return
        setCurrentUser(mapProfileToCurrentUser(profile))
        if (typeof profile.theme === 'string') setTheme(profile.theme)
        if (typeof profile.reconnect_threshold_days === 'number') setReconnectThresholdDays(profile.reconnect_threshold_days)
        if (typeof profile.search_radius === 'number') setSearchRadius(profile.search_radius)
        if (typeof profile.battery_points === 'number') setBatteryPoints(profile.battery_points)

        listMyCircleIds(profile.id)
          .then(ids => { if (!cancelled) setJoinedCircles(ids) })
          .catch(err => console.error('[AppContext] failed to load joined circles', err))

        listMyConnections(profile.id)
          .then(list => { if (!cancelled) setConnections(list) })
          .catch(err => console.error('[AppContext] failed to load connections', err))

        listMyMeetups(profile.id)
          .then(list => {
            if (cancelled) return
            setMeetups(list)
            setRsvpdEventIds(new Set(list.map(e => e.id)))
          })
          .catch(err => console.error('[AppContext] failed to load meetups', err))

        setChatStateLoading(true)
        listChatsDb()
          .then(list => {
            if (cancelled) return
            const map = {}
            list.forEach(c => { map[c.id] = c })
            setChatState(map)
          })
          .catch(err => console.error('[AppContext] failed to load chats', err))
          .finally(() => { if (!cancelled) setChatStateLoading(false) })

        listNotifications(profile.id)
          .then(list => {
            if (cancelled) return
            const now = Date.now()
            const stale = list.filter(n =>
              n.type === 'event_approaching' &&
              n.event?.startsAt &&
              new Date(n.event.startsAt).getTime() < now
            ).map(n => n.id)

            setNotifications(list.filter(n => !stale.includes(n.id)))
            if (stale.length) {
              deleteNotifications(stale).catch(err =>
                console.error('[AppContext] prune stale event notifications failed', err))
            }
          })
          .catch(err => console.error('[AppContext] failed to load notifications', err))
      })
      .catch(async err => {
        console.error('[AppContext] failed to load profile', err)
        if (cancelled) return
        if (isProfileSessionFatalError(err)) {
          try {
            await authSignOut()
            resetLocalAuthState()
            setProfileError(null)
          } catch {
            setProfileError(err)
          }
          return
        }
        setProfileError(err)
      })
      .finally(() => {
        if (!cancelled) setProfileLoading(false)
      })
    return () => { cancelled = true }
  }, [mapProfileToCurrentUser, resetLocalAuthState, session])

  useEffect(() => {
    if (!session?.user?.id || !currentUser?.id) return
    let cancelled = false

    ;(async () => {
      try {
        const pendingToken = window.localStorage.getItem(PENDING_INVITE_KEY)
        if (pendingToken) {
          try {
            const inviterId = await redeemInvite(pendingToken)
            window.localStorage.removeItem(PENDING_INVITE_KEY)
            const list = await listMyConnections(session.user.id)
            if (!cancelled) {
              setConnections(list)
              if (inviterId) {
                const { getProfileById } = await import('../lib/profiles')
                const inviterProfile = await getProfileById(inviterId)
                if (inviterProfile) setRecentInviter(inviterProfile)
              }
            }
          } catch (err) {
            console.warn('[AppContext] pending invite redeem failed', err)
            window.localStorage.removeItem(PENDING_INVITE_KEY)
          }
        }

        const pendingJoinCode = window.localStorage.getItem('ts.pendingJoinCode')
        if (pendingJoinCode) {
          try {
            const { redeemInviteCode } = await import('../lib/invites.js')
            const res = await redeemInviteCode(pendingJoinCode)
            window.localStorage.removeItem('ts.pendingJoinCode')
            const list = await listMyConnections(session.user.id)
            if (!cancelled) setConnections(list)
            if (res?.circle_id && !cancelled) {
              window.location.href = `/circles/${res.circle_id}`
            }
          } catch (err) {
            console.warn('[AppContext] pending join code redeem failed', err)
            window.localStorage.removeItem('ts.pendingJoinCode')
          }
        }
      } catch {
        // localStorage unavailable
      }
    })()

    return () => { cancelled = true }
  }, [session?.user?.id, currentUser?.id])

  // Global realtime subscription for incoming chat messages
  useEffect(() => {
    if (!session?.user) return
    const sub = supabase
      .channel(`my-incoming-messages:${session.user.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          const row = payload.new
          if (!row) return
          // only bump for chats we're in
          setChatState(prev => {
            const existing = prev[row.chat_id]
            if (!existing) return prev
            // if it's our own message, don't bump unread but do update preview
            const fromMe = row.sender_id === session.user.id
            if (!fromMe && row.chat_id === currentlyOpenChatId) {
              markReadDb({ userId: session.user.id, chatId: row.chat_id }).catch(err => {
                console.error('[AppContext] markChatRead failed', err)
              })
              return {
                ...prev,
                [row.chat_id]: {
                  ...existing,
                  lastMessage: row.text,
                  lastMessageAt: row.created_at,
                  time: new Date(row.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                  unread: 0,
                },
              }
            }
            return {
              ...prev,
              [row.chat_id]: {
                ...existing,
                lastMessage: row.text,
                lastMessageAt: row.created_at,
                time: new Date(row.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                unread: fromMe ? existing.unread : (existing.unread || 0) + 1,
              },
            }
          })
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(sub) }
  }, [currentlyOpenChatId, session?.user?.id])

  useEffect(() => {
    if (!session?.user?.id) return
    const sub = supabase
      .channel(`my-chat-members:${session.user.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_members', filter: `user_id=eq.${session.user.id}` },
        async () => {
          try {
            const list = await listChatsDb()
            setChatState(prev => {
              const next = { ...prev }
              list.forEach(c => { next[c.id] = c })
              return next
            })
          } catch (err) {
            console.error('[AppContext] failed to refresh chats after chat_members insert', err)
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'chat_members', filter: `user_id=eq.${session.user.id}` },
        (payload) => {
          const chatId = payload.old?.chat_id
          if (!chatId) return
          setChatState(prev => {
            const next = { ...prev }
            delete next[chatId]
            return next
          })
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(sub) }
  }, [session?.user?.id])

  // Global realtime subscription for the user's notifications
  useEffect(() => {
    if (!session?.user) return
    const sub = supabase
      .channel(`my-notifications:${session.user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${session.user.id}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const mapped = mapNotificationRow(payload.new)
            if (!mapped) return
            setNotifications(prev => prev.some(n => n.id === mapped.id) ? prev : [mapped, ...prev])
            if (payload.new?.type === 'connection_accepted' && session?.user?.id) {
              listMyConnections(session.user.id)
                .then(list => setConnections(list))
                .catch(err => console.error('[AppContext] refresh connections on connection_accepted failed', err))
            }
          } else if (payload.eventType === 'UPDATE') {
            const mapped = mapNotificationRow(payload.new)
            if (!mapped) return
            setNotifications(prev => prev.map(n => n.id === mapped.id ? mapped : n))
          } else if (payload.eventType === 'DELETE') {
            const id = payload.old?.id
            if (!id) return
            setNotifications(prev => prev.filter(n => n.id !== id))
          }
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(sub) }
  }, [session?.user?.id])

  // Global realtime subscription for user profile changes (e.g. battery updates, settings)
  useEffect(() => {
    if (!session?.user?.id) return
    const sub = supabase
      .channel(`my-profile-changes:${session.user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${session.user.id}`,
        },
        (payload) => {
          const profile = payload.new
          if (!profile) return
          if (typeof profile.battery_points === 'number') setBatteryPoints(profile.battery_points)
          if (typeof profile.reconnect_threshold_days === 'number') setReconnectThresholdDays(profile.reconnect_threshold_days)
          if (typeof profile.search_radius === 'number') setSearchRadius(profile.search_radius)
          if (typeof profile.theme === 'string') setTheme(profile.theme)
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(sub) }
  }, [session?.user?.id])

  // Restore local-only UI state from localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const raw = window.localStorage.getItem(UI_STORAGE_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw)
      if (parsed.discoverySwipes) setDiscoverySwipes(parsed.discoverySwipes)
    } catch {
      // ignore malformed localStorage
    }
  }, [])

  // Persist local-only UI state to localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return
    const payload = {
      discoverySwipes,
    }
    window.localStorage.setItem(UI_STORAGE_KEY, JSON.stringify(payload))
  }, [discoverySwipes])

  const chargeBattery = useCallback(async (points, reason) => {
    setBatteryPoints(prev => Math.max(0, Math.min(100, (prev || 0) + points)))
    try {
      const { data, error } = await supabase.rpc('adjust_battery', { p_points: points, p_reason: reason || null })
      if (error) throw error
      if (typeof data === 'number') setBatteryPoints(data)
      return data
    } catch (err) {
      console.error('[AppContext] chargeBattery failed', err)
      await refreshProfile().catch(() => {})
      throw err
    }
  }, [refreshProfile])

  // Inactivity drain (once per session load, using accurate timestamps)
  useEffect(() => {
    if (!currentUser?.id) return
    const today = new Date().toDateString()
    const now = Date.now()
    const rawLast = window.localStorage.getItem('ts_last_active_at') || window.localStorage.getItem('ts_last_active')

    if (rawLast) {
      const lastTime = new Date(rawLast).getTime()
      if (!isNaN(lastTime)) {
        const diffMs = now - lastTime
        // Only drain if at least 24 full hours (86,400,000 ms) have passed since last activity
        if (diffMs >= 24 * 60 * 60 * 1000) {
          const days = Math.floor(diffMs / (1000 * 60 * 60 * 24))
          if (days > 0) {
            const drain = Math.min(days * 8, 40)
            chargeBattery(-drain, `${days} day${days > 1 ? 's' : ''} inactive`).catch(() => {})
          }
        }
      }
    }

    const isoNow = new Date().toISOString()
    window.localStorage.setItem('ts_last_active_at', isoNow)
    window.localStorage.setItem('ts_last_active', today)
    setLastActiveDate(today)
  }, [chargeBattery, currentUser?.id])

  // Apply dark mode class to <html>
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
    try { window.localStorage.setItem('ts_theme', theme) } catch (e) {}
  }, [theme])

  const signOut = async () => {
    await authSignOut()
    resetLocalAuthState()
  }

  const updateMyPrivacy = useCallback(async (patch) => {
    if (!currentUser?.id) return
    setCurrentUser(prev => prev ? {
      ...prev,
      privacy: { ...prev.privacy, ...patch }
    } : prev)
    try {
      await updatePrivacy(currentUser.id, patch)
    } catch (err) {
      console.error('[AppContext] updateMyPrivacy failed', err)
      refreshProfile().catch(() => {})
      throw err
    }
  }, [currentUser?.id, refreshProfile])

  const updateMyNotificationPrefs = useCallback(async (patch) => {
    if (!currentUser?.id) return
    setCurrentUser(prev => prev ? {
      ...prev,
      notificationPrefs: { ...prev.notificationPrefs, ...patch }
    } : prev)
    try {
      const { updateNotificationPrefs } = await import('../lib/profiles')
      await updateNotificationPrefs(currentUser.id, patch)
    } catch (err) {
      console.error('[AppContext] updateMyNotificationPrefs failed', err)
      refreshProfile().catch(() => {})
      throw err
    }
  }, [currentUser?.id, refreshProfile])

  const updateMyIntents = useCallback(async ({ intents, note }) => {
    if (!currentUser?.id) return
    const now = new Date().toISOString()
    setCurrentUser(prev => prev ? { ...prev, intents, intentNote: note, intentCapturedAt: now } : prev)
    try { window.localStorage.setItem(`ts_intent_${currentUser.id}`, '1') } catch (e) {}
    try {
      const { saveIntents } = await import('../lib/profiles')
      await saveIntents(currentUser.id, { intents, note })
    } catch (err) {
      console.error('[AppContext] updateMyIntents failed', err)
      refreshProfile().catch(() => {})
      throw err
    }
  }, [currentUser?.id, refreshProfile])

  const skipIntentCapture = useCallback(async () => {
    if (!currentUser?.id) return
    const now = new Date().toISOString()
    setCurrentUser(prev => prev ? { ...prev, intentCapturedAt: now } : prev)
    try { window.localStorage.setItem(`ts_intent_${currentUser.id}`, '1') } catch (e) {}
    try {
      const { saveIntents } = await import('../lib/profiles')
      await saveIntents(currentUser.id, { intents: currentUser.intents || [], note: currentUser.intentNote || '' })
    } catch (err) {
      console.error('[AppContext] skipIntentCapture failed', err)
      refreshProfile().catch(() => {})
      throw err
    }
  }, [currentUser?.id, currentUser?.intents, currentUser?.intentNote, refreshProfile])

  const clearRecentInviter = useCallback(() => setRecentInviter(null), [])

  const joinCircle = useCallback(async (circleId) => {
    if (!session?.user) return
    // optimistic
    setJoinedCircles(prev => prev.includes(circleId) ? prev : [...prev, circleId])
    try {
      await joinCircleDb({ userId: session.user.id, circleId })
      setCircleMembershipVersion(v => v + 1)
      chargeBattery(15, 'Joined a new circle')
    } catch (err) {
      // rollback
      setJoinedCircles(prev => prev.filter(id => id !== circleId))
      console.error('[AppContext] joinCircle failed', err)
      throw err
    }
  }, [session, chargeBattery])

  const leaveCircle = useCallback(async (circleId) => {
    if (!session?.user) return
    const prev = joinedCircles
    setJoinedCircles(p => p.filter(id => id !== circleId))
    try {
      await leaveCircleDb({ userId: session.user.id, circleId })
      setCircleMembershipVersion(v => v + 1)
    } catch (err) {
      setJoinedCircles(prev) // rollback
      console.error('[AppContext] leaveCircle failed', err)
      throw err
    }
  }, [session, joinedCircles])

  const createCircle = useCallback(async ({ hoops, ...payload }) => {
    if (!session?.user?.id) throw new Error('Not authenticated')
    const created = await createCircleDb({ userId: session.user.id, ...payload })
    if (hoops?.length) {
      await createHoopsForCircle(created.id, hoops)
    }
    const myCircleIds = await listMyCircleIds(session.user.id)
    setJoinedCircles(myCircleIds)
    try {
      const chats = await listChatsDb()
      const map = {}
      chats.forEach(c => { map[c.id] = c })
      setChatState(map)
    } catch (err) {
      console.error('[AppContext] failed to refresh chats after createCircle', err)
    }
    return created
  }, [session?.user?.id])

  const createEventAndRsvp = useCallback(async ({ circleId, title, date, time, location, locationLat, locationLng, locationAddress, notes, coverImageUrl, recurrenceRule, recurrenceEndDate }) => {
    if (!session?.user) throw new Error('Not authenticated')
    const event = await createEvent({
      userId: session.user.id,
      circleId,
      title,
      date,
      time,
      location,
      locationLat,
      locationLng,
      locationAddress,
      notes,
      coverImageUrl,
      recurrenceRule,
      recurrenceEndDate,
    })
    // creator is auto-RSVP'd server-side; reflect locally
    setMeetups(prev => [...prev, event])
    setRsvpdEventIds(prev => {
      const next = new Set(prev)
      next.add(event.id)
      return next
    })
    return event
  }, [session])

  const rsvpEvent = useCallback(async (event /*, circle */) => {
    if (!session?.user || !event?.id) return
    if (rsvpdEventIds.has(event.id)) return

    // optimistic
    setMeetups(prev => prev.some(m => m.id === event.id) ? prev : [...prev, event])
    setRsvpdEventIds(prev => {
      const next = new Set(prev)
      next.add(event.id)
      return next
    })

    try {
      await rsvpDb({ userId: session.user.id, eventId: event.id })
      await refreshProfile().catch(() => {})
    } catch (err) {
      // rollback
      setMeetups(prev => prev.filter(m => m.id !== event.id))
      setRsvpdEventIds(prev => {
        const next = new Set(prev)
        next.delete(event.id)
        return next
      })
      console.error('[AppContext] rsvpEvent failed', err)
      throw err
    }
  }, [refreshProfile, rsvpdEventIds, session])

  const cancelRsvp = useCallback(async (eventId) => {
    if (!session?.user || !eventId) return
    const prevMeetups = meetups
    const wasRsvpd = rsvpdEventIds.has(eventId)
    setMeetups(prev => prev.filter(m => m.id !== eventId))
    setRsvpdEventIds(prev => {
      const next = new Set(prev)
      next.delete(eventId)
      return next
    })
    try {
      await cancelRsvpDb({ userId: session.user.id, eventId })
    } catch (err) {
      // rollback
      setMeetups(prevMeetups)
      if (wasRsvpd) {
        setRsvpdEventIds(prev => {
          const next = new Set(prev)
          next.add(eventId)
          return next
        })
      }
      console.error('[AppContext] cancelRsvp failed', err)
      throw err
    }
  }, [session, meetups, rsvpdEventIds])

  const isRsvpd = useCallback((eventId) => rsvpdEventIds.has(eventId), [rsvpdEventIds])

  const sendMessage = useCallback(async (chatId, text, channelId = null, kind = 'text', payload = null) => {
    if (!session?.user || !chatId || !text?.trim()) return
    // daily-throttled battery reward
    const today = new Date().toDateString()
    const msgKey = `ts_last_msg_reward_${session.user.id}_${today}`
    if (typeof window !== 'undefined' && !window.localStorage.getItem(msgKey)) {
      chargeBattery(5, 'Sent a message')
      window.localStorage.setItem(msgKey, '1')
    }

    // optimistically bump preview locally; realtime will reconcile
    setChatState(prev => {
      const existing = prev[chatId]
      if (!existing) return prev
      return {
        ...prev,
        [chatId]: {
          ...existing,
          lastMessage: text.trim(),
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          unread: 0,
        }
      }
    })

    try {
      await sendMessageDb({ userId: session.user.id, chatId, channelId, text, kind, payload })
    } catch (err) {
      console.error('[AppContext] sendMessage failed', err)
      throw err
    }
  }, [session, chargeBattery])

  const startDM = useCallback(async (person) => {
    if (!session?.user || !person?.id) throw new Error('startDM requires a person')
    const chatId = await startDmDb({ userId: session.user.id, peerUserId: person.id })
    // Eagerly insert a placeholder summary so list shows it until realtime/refetch lands.
    setChatState(prev => prev[chatId] ? prev : {
      ...prev,
      [chatId]: {
        id: chatId,
        type: 'dm',
        circleId: null,
        name: person.name,
        lastMessage: '',
        lastMessageAt: null,
        time: '',
        unread: 0,
        memberCount: 2,
        // extras for the chat list UI
        avatar: person.avatar || '',
        personId: person.id,
      },
    })
    return chatId
  }, [session])

  const markChatRead = useCallback(async (chatId) => {
    if (!session?.user || !chatId) return
    setChatState(prev => prev[chatId]
      ? { ...prev, [chatId]: { ...prev[chatId], unread: 0 } }
      : prev)
    // Optimistically drop any notification for this chat.
    setNotifications(prev => prev.filter(n => n.chatId !== chatId))
    try {
      await markReadDb({ userId: session.user.id, chatId })
    } catch (err) {
      console.error('[AppContext] markChatRead failed', err)
    }
    try {
      await deleteNotificationsForChat(session.user.id, chatId)
    } catch (err) {
      console.error('[AppContext] deleteNotificationsForChat failed', err)
    }
  }, [session])

  const deleteChat = useCallback(async (chatId) => {
    let previous = null
    setChatState(prev => {
      previous = prev[chatId]
      const next = { ...prev }
      delete next[chatId]
      return next
    })
    try {
      await hideChatDb(chatId)
    } catch (err) {
      console.error('[AppContext] failed to hide chat', err)
      if (previous) setChatState(prev => ({ ...prev, [chatId]: previous }))
      throw err
    }
  }, [])

  const recordSwipe = (type) => {
    setDiscoverySwipes(prev => {
      const today = new Date().toDateString()
      if (prev.date !== today) {
        return { date: today, person: 0, circle: 0, event: 0, [type]: 1 }
      }
      return { ...prev, [type]: prev[type] + 1 }
    })
  }

  const resetDiscoverySwipes = useCallback(() => {
    const today = new Date().toDateString()
    setDiscoverySwipes({ date: today, person: 0, circle: 0, event: 0 })
    import('@capacitor/preferences').then(({ Preferences }) => {
      Preferences.remove({ key: 'ts.discovery.passed' }).catch(() => {})
    }).catch(() => {})
  }, [])

  // ---------- Connection Request Flow ----------

  const connectWithPerson = useCallback(async (person) => {
    if (!session?.user || !person) return
    const personId = typeof person === 'string' ? person : person.id
    if (!personId) return
    try {
      await sendConnectionRequest({ requesterId: session.user.id, recipientId: personId })
    } catch (err) {
      console.error('[AppContext] connectWithPerson (request) failed', err)
      throw err
    }
  }, [session])

  const acceptConnection = useCallback(async (requestId, notificationId) => {
    await acceptConnectionRequest(requestId)
    if (notificationId) {
      setNotifications(prev => prev.filter(n => n.id !== notificationId))
      try { await deleteNotifDb(notificationId) }
      catch (err) { console.error('[AppContext] delete notification failed', err) }
    }
    if (session?.user) {
      try {
        const list = await listMyConnections(session.user.id)
        setConnections(list)
      } catch (err) {
        console.error('[AppContext] refetch connections failed', err)
      }
    }
  }, [session])

  const declineConnection = useCallback(async (requestId, notificationId) => {
    await declineConnectionRequest(requestId)
    if (notificationId) {
      setNotifications(prev => prev.filter(n => n.id !== notificationId))
      try { await deleteNotifDb(notificationId) }
      catch (err) { console.error('[AppContext] delete notification failed', err) }
    }
  }, [])

  const disconnectFromPerson = useCallback(async (personId) => {
    if (!currentUser?.id || !personId) return
    try {
      await disconnectFrom(personId)
      // Refresh connections from the DB so the UI re-renders correctly
      const list = await listMyConnections(currentUser.id)
      setConnections(list)
    } catch (err) {
      console.error('[AppContext] disconnectFromPerson failed', err)
      throw err
    }
  }, [currentUser])

  const blockUserById = useCallback(async (targetId) => {
    await blockUser(targetId)
    const ids = await listBlockedUserIds().catch(() => [])
    setBlockedUserIds(ids)
    await refreshConnections().catch(() => {})
  }, [refreshConnections])

  const unblockUserById = useCallback(async (targetId) => {
    await unblockUser(targetId)
    const ids = await listBlockedUserIds().catch(() => [])
    setBlockedUserIds(ids)
  }, [])

  // ---------- Notification Handlers ----------

  const dismissNotification = useCallback(async (notificationId) => {
    // optimistic
    setNotifications(prev => prev.filter(n => n.id !== notificationId))
    try {
      await deleteNotifDb(notificationId)
    } catch (err) {
      console.error('[AppContext] dismissNotification failed', err)
    }
  }, [])

  const markNotificationRead = useCallback(async (notificationId) => {
    setNotifications(prev => prev.map(n => n.id === notificationId ? { ...n, isRead: true } : n))
    try { await markNotifReadDb(notificationId) }
    catch (err) { console.error('[AppContext] markNotificationRead failed', err) }
  }, [])

  const markAllNotificationsRead = useCallback(async () => {
    if (!session?.user) return
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })))
    try { await markAllNotifsReadDb(session.user.id) }
    catch (err) { console.error('[AppContext] markAllNotificationsRead failed', err) }
  }, [session])

  // ---------- Circle Applications ----------

  const submitApplication = useCallback(async ({ circle, responses }) => {
    if (!session?.user) throw new Error('Not authenticated')
    const answersArr = (circle.hoops || []).map(h => ({
      hoopId: h.id,
      answer: responses?.[h.id] ?? '',
    }))
    const app = await applyToCircleDb({
      userId: session.user.id,
      circleId: circle.id,
      answers: answersArr,
    })
    // record locally so OrganizerReview etc can reflect it without a refetch
    setPendingApplications(prev => [{
      id: app.id,
      circleId: circle.id,
      applicantId: session.user.id,
      applicantName: currentUser?.name,
      applicantAvatar: currentUser?.avatar,
      status: 'pending',
      submittedAt: app.submitted_at,
      responses: (circle.hoops || []).map(h => ({
        hoopId: h.id, type: h.type, prompt: h.prompt, response: responses?.[h.id]
      })),
    }, ...prev])
    return app
  }, [session, currentUser])

  const approveApplication = useCallback(async (appId) => {
    await approveAppDb(appId)
    setPendingApplications(prev => prev.map(a => a.id === appId ? { ...a, status: 'approved' } : a))
    setCircleMembershipVersion(v => v + 1)
  }, [])

  const declineApplication = useCallback(async (appId) => {
    await declineAppDb(appId)
    setPendingApplications(prev => prev.map(a => a.id === appId ? { ...a, status: 'declined' } : a))
  }, [])

  const loadApplicationsForCircle = useCallback(async (circleId) => {
    const apps = await listApplicationsForCircle(circleId)
    setPendingApplications(prev => {
      const others = prev.filter(a => a.circleId !== circleId)
      return [...apps, ...others]
    })
    return apps
  }, [])

  const startChatGame = useCallback(async ({ chatId, gameType }) => {
    return await createChatGame({ chatId, gameType })
  }, [])

  const startChatPoll = useCallback(async ({ chatId, channelId = null, question, options, allowMultiple = false }) => {
    return createPollDb({ chatId, channelId, question, options, allowMultiple })
  }, [])

  const makeGameMove = useCallback(async ({ gameId, newState, declaredWinner = null }) => {
    return await commitGameMove({ gameId, newState, declaredWinner })
  }, [])

  const forfeitGame = useCallback(async (gameId) => {
    return await resignGame(gameId)
  }, [])

  const getDailyQuestion = useCallback(async () => {
    return await getDailyQuestionDb()
  }, [])

  const answerDailyQuestion = useCallback(async (text) => {
    return await answerDailyQuestionDb(text)
  }, [])

  const dismissDailyQuestion = useCallback(async (permanent) => {
    return await dismissDailyQuestionDb(permanent)
  }, [])

  const syncQuestionReveals = useCallback(async () => {
    return await syncQuestionRevealsDb()
  }, [])

  const getPendingQuestion = useCallback(async (chatId) => {
    return await getPendingQuestionDb(chatId)
  }, [])

  const askSpontaneousQuestion = useCallback(async ({ chatId, question, myAnswer }) => {
    return await askSpontaneousQuestionDb({ chatId, question, myAnswer })
  }, [])

  const answerSpontaneousQuestion = useCallback(async ({ id, text }) => {
    return await answerSpontaneousQuestionDb({ id, text })
  }, [])

  const cancelSpontaneousQuestion = useCallback(async (id) => {
    return await cancelSpontaneousQuestionDb(id)
  }, [])

  const value = useMemo(
    () => ({
      currentUser,
      setCurrentUser,
      recentInviter,
      clearRecentInviter,
      updateMyIntents,
      skipIntentCapture,
      updateMyNotificationPrefs,
      joinedCircles,
      createCircle,
      meetups,
      joinCircle,
      leaveCircle,
      createEventAndRsvp,
      rsvpEvent,
      cancelRsvp,
      isRsvpd,
      theme,
      setTheme,
      chatState,
      sendMessage,
      startDM,
      markChatRead,
      deleteChat,
      discoverySwipes,
      recordSwipe,
      resetDiscoverySwipes,
      circleMembershipVersion,
      connections,
      connectWithPerson,
      disconnectFromPerson,
      batteryPoints,
      chargeBattery,
      notifications,
      dismissNotification,
      markNotificationRead,
      markAllNotificationsRead,
      acceptConnection,
      declineConnection,
      reconnectThresholdDays,
      setReconnectThresholdDays,
      searchRadius,
      setSearchRadius,
      updateMyPrivacy,
      pendingApplications,
      submitApplication,
      approveApplication,
      declineApplication,
      loadApplicationsForCircle,
      refreshProfile,
      refreshConnections,
      currentlyOpenChatId,
      setCurrentlyOpenChatId,
      profileError,
      session,
      authLoading,
      profileLoading,
      signOut,
      startChatGame,
      startChatPoll,
      makeGameMove,
      forfeitGame,
      blockedUserIds,
      blockUserById,
      unblockUserById,
      getDailyQuestion,
      answerDailyQuestion,
      dismissDailyQuestion,
      syncQuestionReveals,
      getPendingQuestion,
      askSpontaneousQuestion,
      answerSpontaneousQuestion,
      cancelSpontaneousQuestion,
    }),
    [currentUser, recentInviter, updateMyIntents, skipIntentCapture, updateMyNotificationPrefs, clearRecentInviter, joinedCircles, createCircle, meetups, createEventAndRsvp, rsvpEvent, cancelRsvp, isRsvpd, theme, chatState, connections, batteryPoints, chargeBattery, notifications, dismissNotification, markNotificationRead, markAllNotificationsRead, acceptConnection, declineConnection, reconnectThresholdDays, searchRadius, updateMyPrivacy, pendingApplications, submitApplication, approveApplication, declineApplication, loadApplicationsForCircle, refreshProfile, refreshConnections, currentlyOpenChatId, profileError, session, authLoading, profileLoading, signOut, connectWithPerson, disconnectFromPerson, sendMessage, startDM, markChatRead, deleteChat, discoverySwipes, recordSwipe, resetDiscoverySwipes, circleMembershipVersion, startChatGame, startChatPoll, makeGameMove, forfeitGame, blockedUserIds, blockUserById, unblockUserById, getDailyQuestion, answerDailyQuestion, dismissDailyQuestion, syncQuestionReveals, getPendingQuestion, askSpontaneousQuestion, answerSpontaneousQuestion, cancelSpontaneousQuestion],
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useAppContext() {
  const ctx = useContext(AppContext)
  if (!ctx) {
    throw new Error('useAppContext must be used within an AppProvider')
  }
  return ctx
}
