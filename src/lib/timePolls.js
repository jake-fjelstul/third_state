// "When works?" time polls (migration 081). Sent from the iMessage app or
// shared as third-space-app.com/p/<id>.
import { supabase } from './supabase'
import { PUBLIC_APP_URL } from './invites.js'

const rpc = async (fn, args) => {
  const { data, error } = await supabase.rpc(fn, args)
  if (error) throw error
  return data
}

export const pollShareUrl = (id) => `${PUBLIC_APP_URL}/p/${id}`
export const createTimePoll = ({ title, options, place = null }) =>
  rpc('create_time_poll', { p_title: title, p_options: options, p_place: place })
export const getTimePoll = (id) => rpc('get_time_poll', { p_id: id })
export const publicTimePollCard = (id) => rpc('public_time_poll_card', { p_id: id })
export const voteTimePoll = (id, index, on) => rpc('vote_time_poll', { p_poll_id: id, p_option_index: index, p_on: on })
export const makeEventFromPoll = (id, index) => rpc('make_event_from_poll', { p_poll_id: id, p_option_index: index })

export function optionLabel(iso) {
  const d = new Date(iso)
  return d.toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}
