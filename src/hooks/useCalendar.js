import { useCallback, useEffect, useState } from 'react'
import { readCache, writeCache } from '../lib/localCache.js'
import {
  addEventToCalendar,
  connectCalendar,
  disconnectCalendar,
  getStoredCalendarToken,
  isCalendarConnected,
  isCalendarConfigured,
  isEventInCalendar,
  listExternalEvents,
} from '../lib/calendar'

export function useCalendar() {
  const [isConnected, setIsConnected] = useState(() => !!getStoredCalendarToken())
  // Last fetched Google events show immediately; the fetch replaces them.
  const [events, setEvents] = useState(() => (getStoredCalendarToken() ? readCache('gcal.events') || [] : []))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const checkStatus = useCallback(async () => {
    const connected = await isCalendarConnected()
    setIsConnected(connected)
    return connected
  }, [])

  const refresh = useCallback(async () => {
    const connected = await isCalendarConnected()
    setIsConnected(connected)
    if (!connected) {
      setEvents([])
      return []
    }
    try {
      const list = await listExternalEvents()
      setEvents(list)
      writeCache('gcal.events', list)
      return list
    } catch (e) {
      if (String(e?.message || '').toLowerCase().includes('expired')) {
        setIsConnected(false)
      } else {
        setError(e?.message || 'Could not load calendar events')
      }
      return []
    }
  }, [])

  const connect = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      await connectCalendar()
      await checkStatus()
      await refresh()
    } catch (e) {
      const msg = e?.message || 'Could not connect calendar'
      if (!msg.toLowerCase().includes('cancelled')) {
        setError(msg)
      }
      await checkStatus().catch(() => {})
    } finally {
      setLoading(false)
    }
  }, [checkStatus, refresh])

  const disconnect = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      await disconnectCalendar()
      setIsConnected(false)
      setEvents([])
    } catch (e) {
      setError(e?.message || 'Could not disconnect calendar')
    } finally {
      setLoading(false)
    }
  }, [])

  const addEvent = useCallback(async (event) => {
    setError(null)
    try {
      const result = await addEventToCalendar(event)
      await refresh()
      return result
    } catch (e) {
      if (String(e?.message || '').toLowerCase().includes('expired')) {
        setIsConnected(false)
      }
      setError(e?.message || 'Could not add event')
      throw e
    }
  }, [refresh])

  // refresh() checks the connection itself; checking first doubled the round trips.
  useEffect(() => {
    refresh().catch(() => {})
  }, [refresh])

  useEffect(() => {
    const onTokenChange = () => {
      checkStatus().then(connected => {
        if (connected) refresh().catch(() => {})
        else setEvents([])
      })
    }
    window.addEventListener('ts:calendar-token', onTokenChange)
    return () => window.removeEventListener('ts:calendar-token', onTokenChange)
  }, [checkStatus, refresh])

  return {
    isConfigured: isCalendarConfigured(),
    isConnected,
    isLoading: loading,
    error,
    googleEvents: events,
    connect,
    disconnect,
    addEventToGoogle: addEvent,
    isInGoogle: isEventInCalendar,
    refresh,
  }
}
