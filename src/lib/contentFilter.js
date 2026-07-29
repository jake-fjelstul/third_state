// Client-side content moderation filter for Third Space (App Store Guideline 1.2)

const BLOCKED_WORDS = [
  // Racial slurs
  'nigger', 'niggers', 'nigga', 'niggas', 'niggah', 'niggahs', 'nigg', 'kike', 'kikes',
  'chink', 'chinks', 'spic', 'spics', 'wetback', 'wetbacks', 'gook', 'gooks',
  'raghead', 'ragheads', 'towelhead', 'towelheads',
  // LGBTQ+ slurs
  'faggot', 'faggots', 'fag', 'fags', 'fagg', 'tranny', 'trannies', 'shemale', 'shemales', 'dyke', 'dykes',
  // Ableist slurs
  'retard', 'retarded', 'retards',
  // Child exploitation & explicit solicitation
  'pedophile', 'pedophiles', 'paedophile', 'paedophiles', 'pedophilia', 'paedophilia', 'pedofile', 'childporn', 'cp', 'zoophilia', 'bestiality',
]

// Normalized stems of severe terms (with repeated letters collapsed)
const BLOCKED_STEMS = new Set(
  BLOCKED_WORDS.map(w => w.replace(/(.)\1+/g, '$1'))
)

const BLOCKED_EXACT = new Set(BLOCKED_WORDS)

// Allowlist of words that should never trigger false positives
const ALLOWLIST = new Set([
  'assassin', 'assassins', 'assassination', 'assassinate',
  'classic', 'classical', 'classics', 'class', 'classes', 'classicism',
  'scunthorpe', 'cockburn',
  'analysis', 'analytical', 'analyst', 'analysts', 'analyze', 'analyzes',
  'shiitake', 'shiitakes',
  'cocktail', 'cocktails', 'peacock', 'peacocks', 'shuttlecock',
  'pass', 'passage', 'passenger', 'passport', 'compass', 'glass', 'grass', 'mass', 'massive',
  'asset', 'assets', 'assemble', 'assembly', 'assist', 'assistant', 'assistance', 'associate', 'associated',
  'dickens', 'dickinson',
  'bass', 'basset', 'brass', 'embarrass', 'harass', 'harassment',
])

/**
 * Normalizes input string for leetspeak and substitutions
 */
function normalizeText(str) {
  if (!str) return ''
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/@/g, 'a')
    .replace(/\$/g, 's')
    .replace(/!/g, 'i')
    .replace(/0/g, 'o')
    .replace(/1/g, 'i')
    .replace(/3/g, 'e')
    .replace(/4/g, 'a')
    .replace(/5/g, 's')
    .replace(/7/g, 't')
}

/**
 * Checks text for severe blocked content.
 * Returns { ok: true } or { ok: false, reason: string }
 */
export function checkContent(text) {
  if (!text || typeof text !== 'string') return { ok: true }
  
  const normalized = normalizeText(text)
  const words = normalized.split(/[^a-z0-9]+/i).filter(Boolean)

  for (const rawWord of words) {
    if (ALLOWLIST.has(rawWord)) continue

    const collapsed = rawWord.replace(/(.)\1+/g, '$1')
    if (ALLOWLIST.has(collapsed)) continue

    if (BLOCKED_EXACT.has(rawWord) || BLOCKED_STEMS.has(collapsed) || BLOCKED_STEMS.has(rawWord)) {
      return {
        ok: false,
        reason: "This content contains language that isn't allowed in Third Space.",
      }
    }
  }

  // Check whole-string stripped of spaces/separators for spaced-out evasions (e.g. f a g g o t)
  const strippedAll = normalized.replace(/[^a-z0-9]/g, '')
  const collapsedAll = strippedAll.replace(/(.)\1+/g, '$1')

  for (const stem of BLOCKED_STEMS) {
    if (stem.length >= 3 && collapsedAll.includes(stem)) {
      // Check if any allowlisted word in the input matches
      let isAllowed = false
      for (const rawWord of words) {
        if (ALLOWLIST.has(rawWord)) {
          isAllowed = true
          break
        }
      }
      if (!isAllowed) {
        return {
          ok: false,
          reason: "This content contains language that isn't allowed in Third Space.",
        }
      }
    }
  }

  return { ok: true }
}

/**
 * Helper returning boolean indicating if text contains blocked content.
 */
export function containsBlockedContent(text) {
  return !checkContent(text).ok
}
