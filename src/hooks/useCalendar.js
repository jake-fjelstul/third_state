import { useCallback, useEffect, useState } from 'react'
import {
  addEventToCalendar,
  connectCalendar,
  disconnectCalendar,
  getStoredCalendarToken,
  isCalendarConnected,
  isCalendarConfigured,
  listExternalEvents,
} from '../lib/calendar'

export function useCalendar() {
  const [isConnected, setIsConnected] = useState(() => !!getStoredCalendarToken())
  const [events, setEvents] = useState([])
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
      await addEventToCalendar(event)
      await refresh()
    } catch (e) {
      if (String(e?.message || '').toLowerCase().includes('expired')) {
        setIsConnected(false)
      }
      setError(e?.message || 'Could not add event')
      throw e
    }
  }, [refresh])

  useEffect(() => {
    checkStatus().then(connected => {
      if (connected) {
        refresh().catch(() => {})
      }
    })
  }, [checkStatus, refresh])

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
    refresh,
  }
}
