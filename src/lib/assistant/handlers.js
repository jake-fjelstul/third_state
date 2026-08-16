import { listProfiles } from '../profiles'
import { listVisibleCircles } from '../circles'
import { listUpcomingEvents } from '../events'
import {
  assistantText, assistantPeople, assistantCircles, assistantEvents,
  assistantEventForm, assistantCircleForm, assistantNavigate, assistantHelp,
} from './conversation'

/** Topic-aware filter helper. Matches against name, bio, interests, tags, etc. */
function matchesTopic(item, topic, fields) {
  if (!topic) return true
  const t = topic.toLowerCase()
  for (const f of fields) {
    const v = item[f]
    if (typeof v === 'string' && v.toLowerCase().includes(t)) return true
    if (Array.isArray(v) && v.some(x => typeof x === 'string' && x.toLowerCase().includes(t))) return true
  }
  return false
}

export async function handleFindPeople({ topic, ctx }) {
  const all = await listProfiles({ excludeUserId: ctx.currentUser?.id })
  const activeBlockedIds = ctx.blockedUserIds || []
  const filtered = all
    .filter(p => !activeBlockedIds.includes(p.id))
    .filter(p => matchesTopic(p, topic, ['name', 'bio', 'interests', 'city']))
  if (filtered.length === 0) {
    return [
      assistantText(`I couldn't find anyone${topic ? ` matching "${topic}"` : ''} right now. Try a broader search, or check out Discover for a wider net.`),
      assistantNavigate('Open Discover', '/feed?discover=1', 'Discover'),
    ]
  }
  return [assistantPeople(
    topic ? `Here are some people into ${topic}.` : `Some folks you might vibe with.`,
    filtered.slice(0, 12),
  )]
}

export async function handleFindCircles({ topic, ctx }) {
  const all = await listVisibleCircles(ctx.currentUser?.id)
  const filtered = all.filter(c => matchesTopic(c, topic, ['name', 'description', 'category', 'interestTag', 'vibe']))
  if (filtered.length === 0) {
    return [
      assistantText(`No circles${topic ? ` for "${topic}"` : ''} just yet. You could start one — want me to set it up?`),
      assistantCircleForm('Tap to create a circle.', { name: topic ? topic[0].toUpperCase() + topic.slice(1) : '', category: '' }),
    ]
  }
  return [assistantCircles(
    topic ? `Circles around ${topic}:` : 'Circles you might like:',
    filtered.slice(0, 10),
  )]
}

export async function handleFindEvents({ topic, ctx }) {
  const all = await listUpcomingEvents({ limit: 50 })
  const filtered = all.filter(e => matchesTopic(e, topic, ['title', 'description', 'location', 'circleName']))
  if (filtered.length === 0) {
    return [
      assistantText(`Nothing on the schedule${topic ? ` for "${topic}"` : ''}. Want to host one?`),
      assistantEventForm('Open the event form.', { title: topic ? `${topic[0].toUpperCase()}${topic.slice(1)} meetup` : '' }),
    ]
  }
  return [assistantEvents(
    topic ? `Upcoming events around ${topic}:` : 'Upcoming events:',
    filtered.slice(0, 10),
  )]
}

export function handleCreateEvent({ topic }) {
  return [assistantEventForm(
    "Let's get this on the books. Fill in the details below.",
    { title: topic ? `${topic[0].toUpperCase()}${topic.slice(1)} meetup` : '' },
  )]
}

export function handleCreateCircle({ topic }) {
  return [assistantCircleForm(
    "Let's start a new circle. A few quick details:",
    { name: topic ? topic[0].toUpperCase() + topic.slice(1) : '', category: '' },
  )]
}

export function handleNavigate({ topic }) {
  // topic IS the path here, set by the classifier
  const path = topic || '/feed'
  const label = (
    path === '/profile'       ? 'Profile'
  : path === '/settings'      ? 'Settings'
  : path === '/notifications' ? 'Notifications'
  : path === '/chat'          ? 'Chats'
  : path === '/schedule'      ? 'Schedule'
  : path === '/circles'       ? 'Circles'
  : 'this page'
  )
  return [
    assistantText(`Sounds like you want the ${label} page.`),
    assistantNavigate(`Open ${label}`, path, label),
  ]
}

export function handleDiscover() {
  return [
    assistantText("Let's find you someone new — swipe through people, circles and events."),
    assistantNavigate('Open Discover', '/feed?discover=1', 'Discover'),
  ]
}

export function handleHelp() {
  return [assistantHelp()]
}
