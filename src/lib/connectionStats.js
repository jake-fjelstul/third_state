import { supabase } from './supabase'

/**
 * Returns a summary object for rendering the Connection mini-card.
 * Caller is responsible for gating on isConnected.
 *
 * @param {object} args
 * @param {string} args.viewerId
 * @param {string} args.targetId
 * @param {string|null} args.connectedAt  - ISO timestamp from connections.created_at
 * @param {string|null} args.lastHangout  - ISO timestamp from connections.last_hangout
 * @param {number} args.reconnectThresholdDays
 */
export async function getConnectionStats({ viewerId, targetId, connectedAt, lastHangout, reconnectThresholdDays = 21 }) {
  const { data: shared, error } = await supabase.rpc('shared_meetup_count', {
    p_user_a: viewerId,
    p_user_b: targetId,
  })
  if (error) throw error

  const now = Date.now()
  const connectedMs = connectedAt ? now - new Date(connectedAt).getTime() : null
  const daysConnected = connectedMs != null ? Math.max(0, Math.floor(connectedMs / 86400000)) : null

  const lastHangoutMs = lastHangout ? now - new Date(lastHangout).getTime() : null
  const daysSinceHangout = lastHangoutMs != null ? Math.floor(lastHangoutMs / 86400000) : null

  // Status pill logic:
  //   "New"      → connected < 7 days
  //   "Active"   → last hangout within reconnectThresholdDays (or no threshold lapse yet)
  //   "Reconnect"→ last hangout > reconnectThresholdDays OR no hangout and connected > threshold
  let status = 'New'
  if (daysConnected != null && daysConnected >= 7) {
    if (daysSinceHangout != null) {
      status = daysSinceHangout <= reconnectThresholdDays ? 'Active' : 'Reconnect'
    } else if (daysConnected > reconnectThresholdDays) {
      status = 'Reconnect'
    } else {
      status = 'Active'
    }
  }

  // Streak logic: approximate consecutive-week streak.
  // If they've had meetups and the last hangout was recent, derive a streak
  // from the ratio of shared meetups to weeks connected.
  let streak = 0
  if (shared > 0 && daysConnected != null && daysConnected > 0) {
    const weeksConnected = Math.max(1, Math.ceil(daysConnected / 7))
    // If last hangout was within the threshold, count active weeks
    if (daysSinceHangout != null && daysSinceHangout <= reconnectThresholdDays) {
      // Streak = min of shared meetups and weeks connected (can't streak more weeks than existed)
      streak = Math.min(shared, weeksConnected)
    }
  }

  return {
    daysConnected,
    sharedMeetups: shared || 0,
    daysSinceHangout,    // null if never
    lastHangout,         // raw ISO for display
    status,              // 'New' | 'Active' | 'Reconnect'
    streak,              // consecutive-week approximation
  }
}
