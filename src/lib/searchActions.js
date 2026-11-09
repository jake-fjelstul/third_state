// Direct actions that can appear in search results, so search still works
// like a command bar: type "chess" and jump straight into a game.
// Each action: { id, label, hint, keywords[], run: (ctx) => void }.
// ctx = { navigate, openCreate(kind), openSolo(gameType), openDiscovery }

const GAMES = [
  { type: 'chess', label: 'chess', keywords: ['chess'] },
  { type: 'checkers', label: 'checkers', keywords: ['checkers', 'draughts'] },
  { type: 'connect_four', label: 'Connect Four', keywords: ['connect', 'four', 'connect four', 'connect 4'] },
  { type: 'tic_tac_toe', label: 'tic-tac-toe', keywords: ['tic', 'tac', 'toe', 'tic tac toe', 'noughts', 'xo'] },
]

const ACTIONS = [
  ...GAMES.map(g => ({
    id: `play-${g.type}`, label: `Play ${g.label}`, hint: 'Solo game', icon: 'game',
    keywords: [...g.keywords, 'game', 'games', 'play'],
    run: (ctx) => ctx.openSolo(g.type),
  })),
  { id: 'new-circle', label: 'Create a circle', hint: 'Start a community', icon: 'circle',
    keywords: ['circle', 'group', 'community', 'club', 'create', 'new', 'start'], run: (ctx) => ctx.openCreate('circle') },
  { id: 'new-event', label: 'Host an event', hint: 'Plan a meetup', icon: 'event',
    keywords: ['event', 'meetup', 'host', 'plan', 'party', 'create', 'new'], run: (ctx) => ctx.openCreate('event') },
  { id: 'coffee', label: 'Invite someone for coffee', hint: '1:1 meetup', icon: 'coffee',
    keywords: ['coffee', 'invite', 'catch up', '1:1'], run: (ctx) => ctx.openCreate('coffee') },
  { id: 'status', label: "Set status: I'm free", hint: 'Let friends know', icon: 'status',
    keywords: ['free', 'status', 'lfg', 'available', 'now', 'hang', 'hangout'], run: (ctx) => ctx.openCreate('lfg') },
  { id: 'discover', label: 'Meet someone new', hint: 'Swipe people, circles and events', icon: 'people',
    keywords: ['meet', 'discover', 'swipe', 'people', 'new', 'friends', 'find'], run: (ctx) => ctx.openDiscovery() },
  { id: 'schedule', label: 'Open your schedule', hint: 'Calendar and meetups', icon: 'event',
    keywords: ['schedule', 'calendar', 'meetups', 'plans', 'agenda'], run: (ctx) => ctx.navigate('/schedule') },
  { id: 'messages', label: 'Open messages', hint: 'Chats and circles', icon: 'chat',
    keywords: ['messages', 'chat', 'chats', 'dm', 'inbox', 'text'], run: (ctx) => ctx.navigate('/chat') },
  { id: 'circles', label: 'Browse circles', hint: 'Your circles and new ones', icon: 'circle',
    keywords: ['circles', 'browse', 'groups', 'communities'], run: (ctx) => ctx.navigate('/circles') },
  { id: 'memories', label: 'Open memories', hint: 'Past meetups and photos', icon: 'photo',
    keywords: ['memories', 'photos', 'past', 'recap'], run: (ctx) => ctx.navigate('/memories') },
  { id: 'notifications', label: 'Open notifications', hint: '', icon: 'bell',
    keywords: ['notifications', 'alerts', 'requests'], run: (ctx) => ctx.navigate('/notifications') },
  { id: 'profile', label: 'Open your profile', hint: 'Edit bio and interests', icon: 'user',
    keywords: ['profile', 'bio', 'interests', 'me', 'edit'], run: (ctx) => ctx.navigate('/profile') },
  { id: 'settings', label: 'Open settings', hint: 'Notifications, privacy, appearance', icon: 'settings',
    keywords: ['settings', 'privacy', 'dark', 'light', 'appearance', 'theme', 'account', 'preferences'], run: (ctx) => ctx.navigate('/settings') },
]

/** Actions whose keywords match what was typed, best match first (max 4). */
export function matchActions(query) {
  const q = (query || '').trim().toLowerCase()
  if (q.length < 2) return []
  const words = q.split(/\s+/).filter(Boolean)
  return ACTIONS
    .map(a => {
      let score = 0
      for (const k of a.keywords) {
        if (k === q) score += 6
        else if (k.startsWith(q) || q.includes(k)) score += 3
        else if (words.some(w => w.length >= 3 && (k.startsWith(w) || w.startsWith(k)))) score += 1
      }
      if (a.label.toLowerCase().includes(q)) score += 2
      return { a, score }
    })
    .filter(x => x.score >= 3)
    .sort((x, y) => y.score - x.score)
    .slice(0, 4)
    .map(x => x.a)
}
