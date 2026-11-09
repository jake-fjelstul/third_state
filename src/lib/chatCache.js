// Last ~30 messages per chat/channel, in memory and localStorage, so opening
// a chat renders instantly and the network fetch only fills in (item 3).

const MAX = 30
const PREFIX = 'ts.chatCache.'
const memory = new Map()

const keyFor = (chatId, channelId) => `${chatId}:${channelId || 'main'}`

export function getCachedMessages(chatId, channelId) {
  if (!chatId) return null
  const key = keyFor(chatId, channelId)
  if (memory.has(key)) return memory.get(key)
  try {
    const raw = window.localStorage.getItem(PREFIX + key)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return null
    memory.set(key, parsed)
    return parsed
  } catch {
    return null
  }
}

export function setCachedMessages(chatId, channelId, messages) {
  if (!chatId || !Array.isArray(messages)) return
  const key = keyFor(chatId, channelId)
  const tail = messages.slice(-MAX)
  memory.set(key, tail)
  try { window.localStorage.setItem(PREFIX + key, JSON.stringify(tail)) } catch { /* quota/private mode */ }
}

/** Wipe everything (sign-out), so the next user never sees cached messages. */
export function clearChatCache() {
  memory.clear()
  try {
    for (let i = window.localStorage.length - 1; i >= 0; i--) {
      const k = window.localStorage.key(i)
      if (k && k.startsWith(PREFIX)) window.localStorage.removeItem(k)
    }
  } catch { /* noop */ }
}

/** Warm the memory cache from the network ahead of opening a chat. */
const inflight = new Map()
export function prefetchMessages(chatId, channelId, loader) {
  if (!chatId) return
  const key = keyFor(chatId, channelId)
  if (memory.has(key) || inflight.has(key)) return
  const p = loader()
    .then(rows => setCachedMessages(chatId, channelId, rows))
    .catch(() => {})
    .finally(() => inflight.delete(key))
  inflight.set(key, p)
}
