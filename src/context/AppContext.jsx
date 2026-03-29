import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react'
import { currentUser as seedUser, circles, meetups as seedMeetups, chats as mockChats, seedNotifications, people } from '../data/mockData'

const AppContext = createContext(null)

const STORAGE_KEY = 'third-space-state'

export function AppProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(seedUser)
  const [joinedCircles, setJoinedCircles] = useState(() =>
    circles
      .filter((circle) =>
        circle.members.some((m) => m.name === seedUser.name),
      )
      .map((c) => c.id),
  )
  const [onboardingComplete, setOnboardingComplete] = useState(false)
  const [meetups, setMeetups] = useState(seedMeetups)
  const [theme, setTheme] = useState('dark')
  const [connections, setConnections] = useState(['p-daniel'])
  const [notifications, setNotifications] = useState(seedNotifications)
  const [reconnectThresholdDays, setReconnectThresholdDays] = useState(21)
  const [searchRadius, setSearchRadius] = useState(10)
  const [pendingApplications, setPendingApplications] = useState([])

  const [chatState, setChatState] = useState(() => {
    const initial = {}
    mockChats.forEach(c => {
      initial[c.id] = {
        ...c,
        messages: c.messages ?? []
      }
    })
    return initial
  })

  const [discoverySwipes, setDiscoverySwipes] = useState(() => {
    return { date: new Date().toDateString(), person: 0, circle: 0, event: 0 }
  })

  // Battery state
  const [batteryPoints, setBatteryPoints] = useState(() => {
    return parseInt(window.localStorage.getItem('ts_battery') ?? '40')
  })
  const [batteryHistory, setBatteryHistory] = useState(() => {
    try {
      return JSON.parse(window.localStorage.getItem('ts_battery_history') ?? '[]')
    } catch { return [] }
  })
  const [lastActiveDate, setLastActiveDate] = useState(() => {
    return window.localStorage.getItem('ts_last_active') ?? new Date().toDateString()
  })

  useEffect(() => {
    window.localStorage.setItem('ts_battery', batteryPoints.toString())
  }, [batteryPoints])

  useEffect(() => {
    window.localStorage.setItem('ts_battery_history', JSON.stringify(batteryHistory.slice(-20)))
  }, [batteryHistory])

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw)
      if (parsed.currentUser) setCurrentUser(parsed.currentUser)
      if (Array.isArray(parsed.joinedCircles)) setJoinedCircles(parsed.joinedCircles)
      if (typeof parsed.onboardingComplete === 'boolean') {
        setOnboardingComplete(parsed.onboardingComplete)
      }
      if (Array.isArray(parsed.meetups)) setMeetups(parsed.meetups)
      if (parsed.theme) setTheme(parsed.theme)
      if (Array.isArray(parsed.connections)) setConnections(parsed.connections)
      if (parsed.chatState) setChatState(parsed.chatState)
      if (parsed.discoverySwipes) setDiscoverySwipes(parsed.discoverySwipes)
      if (Array.isArray(parsed.notifications)) setNotifications(parsed.notifications)
      if (typeof parsed.reconnectThresholdDays === 'number') setReconnectThresholdDays(parsed.reconnectThresholdDays)
      if (typeof parsed.searchRadius === 'number') setSearchRadius(parsed.searchRadius)
    } catch {
      // ignore malformed localStorage
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const payload = {
      currentUser,
      joinedCircles,
      onboardingComplete,
      meetups,
      chatState,
      discoverySwipes,
      connections,
      notifications,
      reconnectThresholdDays,
      searchRadius
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  }, [currentUser, joinedCircles, onboardingComplete, meetups, theme, chatState, discoverySwipes, connections, notifications, reconnectThresholdDays, searchRadius])

  // Reconnect Nudge Engine
  useEffect(() => {
    if (!connections || connections.length === 0) return

    setNotifications(prev => {
      let nuList = [...prev]
      let changed = false

      connections.forEach(connId => {
        const person = people.find(p => p.id === connId)
        if (!person || !person.lastHangout) return

        const daysSince = (Date.now() - new Date(person.lastHangout).getTime()) / (1000 * 60 * 60 * 24)
        
        if (daysSince >= reconnectThresholdDays) {
          const alreadyNudged = nuList.some(n => n.type === 'reconnect_nudge' && n.targetId === person.id)
          if (!alreadyNudged) {
            changed = true
            
            // Look for a shared upcoming meetup
            const sharedEvent = meetups.find(m => 
              m.attendees?.some(a => a.name === currentUser.name) && 
              m.attendees?.some(a => a.name === person.name)
            )

            let message = ''
            let suggestions = []

            if (sharedEvent) {
              const eventDate = new Date(sharedEvent.date).toLocaleDateString('en-US', { weekday: 'long' })
              message = `You haven't hung out with ${person.name.split(' ')[0]} in a while — there's a ${sharedEvent.title} this ${eventDate} you're both signed up for.`
              suggestions = [
                `Hey! Still going to the ${sharedEvent.title}?`,
                `Want to grab coffee before the event on ${eventDate}?`,
                `It's been a minute! How have you been?`
              ]
            } else {
              message = `You haven't hung out with ${person.name.split(' ')[0]} in a while. Reach out to reconnect!`
              suggestions = [
                `Hey! Long time no see!`,
                `Are you free for coffee sometime next week?`,
                `It's been a minute! How have you been?`
              ]
            }

            nuList.unshift({
              id: `notif-nudge-${person.id}-${Date.now()}`,
              type: 'reconnect_nudge',
              targetId: person.id,
              user: { name: person.name, avatar: person.avatar },
              message,
              suggestions,
              timestamp: 'Just now',
              isRead: false
            })
          }
        }
      })

      return changed ? nuList : prev
    })
  }, [connections, reconnectThresholdDays, meetups, currentUser.name])

  // Inactivity drain
  useEffect(() => {
    const today = new Date().toDateString()
    const lastDate = window.localStorage.getItem('ts_last_active')
    
    if (lastDate && lastDate !== today) {
      const last = new Date(lastDate)
      const now = new Date()
      const days = Math.floor((now - last) / (1000 * 60 * 60 * 24))
      if (days > 0) {
        const drain = Math.min(days * 8, 40)
        chargeBattery(-drain, `${days} day${days > 1 ? 's' : ''} inactive`)
      }
    }
    window.localStorage.setItem('ts_last_active', today)
    setLastActiveDate(today)
  }, [])

  const chargeBattery = useCallback((points, reason) => {
    setBatteryPoints(prev => {
      const next = Math.max(0, Math.min(100, prev + points))
      setBatteryHistory(h => [...h, {
        points,
        reason,
        result: next,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      }])
      return next
    })
  }, [])

  // Apply dark mode class to <html>
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [theme])

  const completeOnboarding = (profileData) => {
    setCurrentUser((prev) => ({
      ...prev,
      ...profileData,
      avatar: prev.avatar,
    }))
    setOnboardingComplete(true)
  }

  const joinCircle = (circleId) => {
    setJoinedCircles((prev) => {
      if (!prev.includes(circleId)) {
        chargeBattery(15, 'Joined a new circle')
        return [...prev, circleId]
      }
      return prev
    })
  }

  const leaveCircle = (circleId) => {
    setJoinedCircles((prev) => prev.filter((id) => id !== circleId))
  }

  const addMeetup = (meetup) => {
    setMeetups((prev) => [...prev, meetup])
    chargeBattery(20, 'Attending an event')
  }

  const rsvpEvent = (event, circle) => {
    // Don't duplicate if already RSVP'd
    if (meetups.some(m => m.id === event.id || m.sourceEventId === event.id)) return
    const newMeetup = {
      id: event.id,
      sourceEventId: event.id,
      title: event.title,
      circleId: circle?.id ?? event.circleId ?? '',
      circleName: circle?.name ?? event.circleName ?? '',
      date: event.date,
      time: event.time,
      location: event.location ?? 'TBD',
      notes: event.notes ?? '',
      attendees: event.attendees ?? [],
      attendeesCount: event.attendeesCount ?? 0,
    }
    setMeetups(prev => [...prev, newMeetup])
    chargeBattery(20, 'Attending an event')
  }

  const cancelRsvp = (eventId) => {
    setMeetups(prev => prev.filter(m => m.id !== eventId && m.sourceEventId !== eventId))
  }

  const isRsvpd = (eventId) => {
    return meetups.some(m => m.id === eventId || m.sourceEventId === eventId)
  }

  const sendMessage = (chatId, text, channelId = 'general') => {
    if (!text.trim()) return
    
    const today = new Date().toDateString()
    const dmKey = `ts_msg_${chatId}_${today}`
    if (!window.sessionStorage.getItem(dmKey)) {
      chargeBattery(5, 'Sent a message')
      window.sessionStorage.setItem(dmKey, '1')
    }

    const newMsg = {
      id: `msg-${Date.now()}`,
      sender: 'You',
      text: text.trim(),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      channelId,
    }
    setChatState(prev => ({
      ...prev,
      [chatId]: {
        ...prev[chatId],
        messages: [...(prev[chatId]?.messages ?? []), newMsg],
        lastMessage: text.trim(),
        time: newMsg.time,
        unread: 0,
      }
    }))
  }

  const startDM = (person) => {
    const existing = Object.values(chatState).find(
      c => c.type === 'dm' && c.personId === person.id
    )
    if (existing) return existing.id
    const newId = `dm-${person.id}`
    setChatState(prev => ({
      ...prev,
      [newId]: {
        id: newId,
        type: 'dm',
        personId: person.id,
        name: person.name,
        avatar: person.avatar,
        online: person.online ?? false,
        messages: [],
        time: '',
        unread: 0,
      }
    }))
    return newId
  }

  const startGroupChat = (circle) => {
    const newId = circle.chatId || `circle-${circle.id}`
    if (chatState[newId]) return newId
    setChatState(prev => ({
      ...prev,
      [newId]: {
        id: newId,
        type: 'group',
        circleName: circle.name,
        avatar: null,
        members: circle.members,
        memberCount: circle.memberCount || circle.members?.length || 0,
        messages: [],
        channels: ['general', 'planning', 'photos', 'meetups'],
        time: '',
        unread: 0,
      }
    }))
    return newId
  }

  const recordSwipe = (type) => {
    setDiscoverySwipes(prev => {
      const today = new Date().toDateString()
      if (prev.date !== today) {
        return { date: today, person: 0, circle: 0, event: 0, [type]: 1 }
      }
      return { ...prev, [type]: prev[type] + 1 }
    })
  }

  const connectWithPerson = (personId) => {
    setConnections(prev => prev.includes(personId) ? prev : [...prev, personId])
  }

  const submitApplication = useCallback((application) => {
    setPendingApplications(prev => [application, ...prev])
  }, [])

  const approveApplication = useCallback((appId) => {
    setPendingApplications(prev => prev.map(app => app.id === appId ? { ...app, status: 'approved' } : app))
    const app = pendingApplications.find(a => a.id === appId)
    if (app && app.circleId) {
      if (app.applicantId === currentUser.id) {
        setJoinedCircles(prev => Array.from(new Set([...prev, app.circleId])))
      }
      setNotifications(prev => [{
        id: `notify-${Date.now()}`,
        type: 'application_approved',
        message: `You've been approved to join a circle! 🎉`,
        timestamp: new Date().toISOString(),
        isRead: false
      }, ...prev])
    }
  }, [pendingApplications, currentUser.id])

  const declineApplication = useCallback((appId) => {
    setPendingApplications(prev => prev.map(app => app.id === appId ? { ...app, status: 'declined' } : app))
    setNotifications(prev => [{
      id: `notify-${Date.now()}`,
      type: 'application_declined',
      message: `Your application was not approved this time.`,
      timestamp: new Date().toISOString(),
      isRead: false
    }, ...prev])
  }, [])

  const importDiscordServer = useCallback((serverName, membersText) => {
    const rawNames = membersText.split(/[\n,]+/).map(n => n.trim()).filter(Boolean)
    const newMembers = rawNames.map((n, i) => ({
      id: `m-discord-${Date.now()}-${i}`,
      name: n,
      avatar: `https://api.dicebear.com/7.x/notionists/svg?seed=${encodeURIComponent(n)}`
    }))

    const newCircleId = `c-discord-${Date.now()}`
    const newCircle = {
      id: newCircleId,
      name: serverName,
      type: 'private',
      category: 'social',
      interestTag: 'Discord Import',
      description: `Imported from Discord server: ${serverName}`,
      memberCount: newMembers.length + 1,
      members: [{ id: currentUser.id, name: currentUser.name, avatar: currentUser.avatar }, ...newMembers],
      emoji: '👾',
      coverGradient: 'linear-gradient(135deg, #5865F2 0%, #7289da 100%)',
      events: []
    }

    circles.unshift(newCircle)
    setJoinedCircles(prev => [newCircleId, ...prev])

    setChatState(prev => ({
      ...prev,
      [newCircleId]: {
        id: newCircleId,
        circleId: newCircleId,
        type: 'group',
        circleName: serverName,
        unread: 1,
        time: 'Just now',
        messages: [{
          id: Date.now(),
          sender: 'System',
          text: `Welcome to your imported Circle! ${newMembers.length} members have been privately invited.`,
          timestamp: new Date().toISOString(),
          isSystem: true
        }]
      }
    }))
  }, [currentUser])

  const value = useMemo(
    () => ({
      currentUser,
      setCurrentUser,
      joinedCircles,
      onboardingComplete,
      meetups,
      completeOnboarding,
      joinCircle,
      leaveCircle,
      addMeetup,
      rsvpEvent,
      cancelRsvp,
      isRsvpd,
      theme,
      setTheme,
      chatState,
      setChatState,
      sendMessage,
      startDM,
      startGroupChat,
      discoverySwipes,
      recordSwipe,
      connections,
      connectWithPerson,
      batteryPoints,
      batteryHistory,
      chargeBattery,
      notifications,
      setNotifications,
      reconnectThresholdDays,
      setReconnectThresholdDays,
      searchRadius,
      setSearchRadius,
      importDiscordServer,
      pendingApplications,
      submitApplication,
      approveApplication,
      declineApplication
    }),
    [currentUser, joinedCircles, onboardingComplete, meetups, theme, chatState, discoverySwipes, connections, batteryPoints, batteryHistory, chargeBattery, notifications, reconnectThresholdDays, searchRadius, importDiscordServer, pendingApplications, submitApplication, approveApplication, declineApplication],
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

