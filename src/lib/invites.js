import { supabase } from './supabase'

// Links must open for other people, so they always use the public web
// origin. On native, window.location.origin is capacitor://localhost.
export const PUBLIC_APP_URL = (import.meta.env.VITE_PUBLIC_APP_URL || 'https://third-space-app.com').replace(/\/+$/, '')

function getAppBaseUrl() {
  return PUBLIC_APP_URL
}

export function buildInviteUrl(token) {
  return `${getAppBaseUrl()}/invite/${token}`
}

export function buildJoinUrl(code) {
  return `${getAppBaseUrl()}/j/${code}`
}

export async function redeemInvite(token) {
  if (!token) throw new Error('Missing invite token')
  const { data, error } = await supabase.rpc('redeem_invite', { p_token: token })
  if (error) throw error
  return data
}

export async function createCircleInviteLink(circleId, label) {
  if (!circleId) throw new Error('Missing circleId')
  const { data, error } = await supabase.rpc('create_circle_invite_link', {
    p_circle_id: circleId,
    p_label: label ?? null,
  })
  if (error) throw error
  return { code: data.code, url: buildJoinUrl(data.code) }
}

export async function createPersonalInviteLink() {
  const { data, error } = await supabase.rpc('create_personal_invite_link')
  if (error) throw error
  return { code: data.code, url: buildJoinUrl(data.code) }
}

/** Public preview of one invite code: { kind, circle_name, inviter_name } or null. */
export async function previewInvite(code) {
  if (!code) return null
  const { data, error } = await supabase.rpc('preview_invite', { p_code: code })
  if (error) throw error
  return data || null
}

export async function redeemInviteCode(code) {
  if (!code) throw new Error('Missing invite code')
  const { data, error } = await supabase.rpc('redeem_invite_code', { p_code: code })
  if (error) throw error
  return data
}

export function classifyContact(input) {
  const trimmed = (input || '').trim()
  if (!trimmed) return null
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return 'email'
  const digits = trimmed.replace(/\D/g, '')
  if (digits.length >= 7 && /^[+\d\s\-().]+$/.test(trimmed)) return 'phone'
  return null
}

export function buildInviteMessage({ senderName, url }) {
  const first = (senderName || '').split(' ')[0] || 'A friend'
  return `Hey! ${first} invited you to Third Space — find people and meetups near you. Join here: ${url}`
}

export function buildCircleInviteMessage({ senderName, circleName, url }) {
  const first = (senderName || '').split(' ')[0] || 'A friend'
  return `Hey! ${first} invited you to join ${circleName || 'a circle'} on Third Space: ${url}`
}
