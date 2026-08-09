import { useState, useEffect, useCallback } from 'react'
import { supabase } from './supabase'

export async function isAdmin() {
  const { data, error } = await supabase.rpc('is_admin')
  if (error) throw error
  return Boolean(data)
}

export async function getOverview(days = 30) {
  const { data, error } = await supabase.rpc('admin_overview', { p_days: days })
  if (error) throw error
  return data
}

export async function getGrowthSeries(days = 30) {
  const { data, error } = await supabase.rpc('admin_growth_series', { p_days: days })
  if (error) throw error
  return data
}

export async function getOnboardingFunnel() {
  const { data, error } = await supabase.rpc('admin_onboarding_funnel')
  if (error) throw error
  return data
}

export async function getCircleStats(limit = 100) {
  const { data, error } = await supabase.rpc('admin_circle_stats', { p_limit: limit })
  if (error) throw error
  return data
}

export async function getEventStats(days = 90) {
  const { data, error } = await supabase.rpc('admin_event_stats', { p_days: days })
  if (error) throw error
  return data
}

export async function getConnectionStats() {
  const { data, error } = await supabase.rpc('admin_connection_stats')
  if (error) throw error
  return data
}

export async function getRetentionCohorts(weeks = 8) {
  const { data, error } = await supabase.rpc('admin_retention_cohorts', { p_weeks: weeks })
  if (error) throw error
  return data
}

export async function getRecentUsers(limit = 50) {
  const { data, error } = await supabase.rpc('admin_recent_users', { p_limit: limit })
  if (error) throw error
  return data
}

export async function getContentStats(days = 30) {
  const { data, error } = await supabase.rpc('admin_content_stats', { p_days: days })
  if (error) throw error
  return data
}

export function useMetric(fetcher, deps = []) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const loadData = useCallback(async (isMountedRef) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetcher()
      if (isMountedRef ? isMountedRef.current : true) {
        setData(res)
        setLoading(false)
      }
    } catch (err) {
      if (isMountedRef ? isMountedRef.current : true) {
        setError(err)
        setLoading(false)
      }
    }
  }, deps) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let mounted = true
    const mountedRef = { current: true }

    setLoading(true)
    setError(null)

    fetcher()
      .then((res) => {
        if (mounted) {
          setData(res)
          setLoading(false)
        }
      })
      .catch((err) => {
        if (mounted) {
          setError(err)
          setLoading(false)
        }
      })

    return () => {
      mounted = false
      mountedRef.current = false
    }
  }, deps) // eslint-disable-line react-hooks/exhaustive-deps

  const reload = useCallback(() => {
    let mounted = true
    setLoading(true)
    setError(null)
    fetcher()
      .then((res) => {
        if (mounted) {
          setData(res)
          setLoading(false)
        }
      })
      .catch((err) => {
        if (mounted) {
          setError(err)
          setLoading(false)
        }
      })
  }, [fetcher])

  return { data, loading, error, reload }
}
