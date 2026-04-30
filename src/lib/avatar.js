const DICEBEAR_BASE = 'https://api.dicebear.com/7.x/notionists/svg?seed='

export function dicebearFor(name = '') {
  return `${DICEBEAR_BASE}${encodeURIComponent(name || 'anon')}`
}

export function avatarFor(person) {
  return person?.avatar || person?.avatar_url || dicebearFor(person?.name)
}
