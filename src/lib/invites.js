import { supabase } from './supabase'

function generateToken() {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(36).padStart(2, '0')).join('').slice(0, 22)
}

function getAppBaseUrl() {
  return import.meta.env.VITE_PUBLIC_APP_URL
    || (typeof window !== 'undefined' ? window.location.origin : 'https://third-space-app.com')
}

export function buildInviteUrl(token) {
  return `${getAppBaseUrl()}/invite/${token}`
}

export function buildJoinUrl(code) {
  return `${getAppBaseUrl()}/j/${code}`
}

export async function createInvite({ inviterId, recipientContact = null }) {
  if (!inviterId) throw new Error('Missing inviterId')
  const token = generateToken()
  const { data, error } = await supabase
    .from('invites')
    .insert({ token, inviter_id: inviterId, recipient_contact: recipientContact })
    .select()
    .single()
  if (error) throw error
  return { token: data.token, url: buildInviteUrl(data.token), id: data.id }
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
