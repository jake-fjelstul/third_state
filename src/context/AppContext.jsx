import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { currentUser as seedUser, circles, meetups as seedMeetups } from '../data/mockData'

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
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  }, [currentUser, joinedCircles, onboardingComplete, meetups])

  const completeOnboarding = (profileData) => {
    setCurrentUser((prev) => ({
      ...prev,
      ...profileData,
      avatar: prev.avatar,
    }))
    setOnboardingComplete(true)
  }

  const joinCircle = (circleId) => {
    setJoinedCircles((prev) =>
      prev.includes(circleId) ? prev : [...prev, circleId],
    )
  }

  const leaveCircle = (circleId) => {
    setJoinedCircles((prev) => prev.filter((id) => id !== circleId))
  }

  const addMeetup = (meetup) => {
    setMeetups((prev) => [...prev, meetup])
  }

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
    }),
    [currentUser, joinedCircles, onboardingComplete, meetups],
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

