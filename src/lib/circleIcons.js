import {
  Sparkles, Circle, Flame, Palette, Camera, Volleyball, Footprints, Coffee,
  BookOpen, Music, Gamepad2, Pizza, Mountain, Bike, Flower2, Clapperboard,
  Dog, Plane, Lightbulb, Sprout, Dribbble, Mic, Dices, Heart, Users,
} from 'lucide-react'

/** The icon vocabulary offered in the circle form, in display order. */
export const CIRCLE_ICONS = [
  { key: 'Users', Comp: Users, label: 'Community' },
  { key: 'Sparkles', Comp: Sparkles, label: 'Sparkles' },
  { key: 'Flame', Comp: Flame, label: 'Fire' },
  { key: 'Palette', Comp: Palette, label: 'Art' },
  { key: 'Camera', Comp: Camera, label: 'Photo' },
  { key: 'Volleyball', Comp: Volleyball, label: 'Sport' },
  { key: 'Footprints', Comp: Footprints, label: 'Running' },
  { key: 'Coffee', Comp: Coffee, label: 'Coffee' },
  { key: 'BookOpen', Comp: BookOpen, label: 'Books' },
  { key: 'Music', Comp: Music, label: 'Music' },
  { key: 'Gamepad2', Comp: Gamepad2, label: 'Gaming' },
  { key: 'Pizza', Comp: Pizza, label: 'Food' },
  { key: 'Mountain', Comp: Mountain, label: 'Climbing' },
  { key: 'Bike', Comp: Bike, label: 'Cycling' },
  { key: 'Flower2', Comp: Flower2, label: 'Wellness' },
  { key: 'Clapperboard', Comp: Clapperboard, label: 'Film' },
  { key: 'Dog', Comp: Dog, label: 'Pets' },
  { key: 'Plane', Comp: Plane, label: 'Travel' },
  { key: 'Lightbulb', Comp: Lightbulb, label: 'Ideas' },
  { key: 'Sprout', Comp: Sprout, label: 'Growth' },
  { key: 'Dribbble', Comp: Dribbble, label: 'Basketball' },
  { key: 'Mic', Comp: Mic, label: 'Talks' },
  { key: 'Dices', Comp: Dices, label: 'Games' },
  { key: 'Heart', Comp: Heart, label: 'Care' },
  { key: 'Circle', Comp: Circle, label: 'Neutral' },
]

const BY_KEY = Object.fromEntries(CIRCLE_ICONS.map(i => [i.key, i.Comp]))

/** Fallback for rows whose icon column did not backfill cleanly. */
const EMOJI_TO_KEY = {
  '✨': 'Sparkles', '⭕': 'Circle', '🔥': 'Flame', '🎨': 'Palette',
  '📸': 'Camera', '⚽': 'Volleyball', '🏃': 'Footprints', '☕': 'Coffee',
  '📚': 'BookOpen', '🎵': 'Music', '🎮': 'Gamepad2', '🍕': 'Pizza',
  '🧗': 'Mountain', '🚲': 'Bike', '🧘': 'Flower2', '🎬': 'Clapperboard',
  '🐶': 'Dog', '✈️': 'Plane', '✈': 'Plane', '💡': 'Lightbulb',
  '🌱': 'Sprout', '🏀': 'Dribbble', '🎤': 'Mic', '🎲': 'Dices',
  '❤️': 'Heart', '❤': 'Heart',
}

export const DEFAULT_CIRCLE_ICON = 'Users'

/** Resolves a circle to a Lucide component: icon key, then emoji, then default. */
export function circleIconComponent(circle) {
  if (circle?.icon && BY_KEY[circle.icon]) return BY_KEY[circle.icon]
  const viaEmoji = circle?.emoji ? EMOJI_TO_KEY[circle.emoji] : null
  if (viaEmoji && BY_KEY[viaEmoji]) return BY_KEY[viaEmoji]
  return BY_KEY[DEFAULT_CIRCLE_ICON]
}
