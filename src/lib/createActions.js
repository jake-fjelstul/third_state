// Shared definitions for the four create actions.
// Icon path data is taken from Lucide (ISC licensed) so it can be inlined
// inside SVG, where a Lucide React component cannot be nested.

export const CREATE_ACTION_DEFS = [
  {
    id: 'circle',
    title: 'New Circle',
    desc: 'Start a community',
    lucide: 'Users',
    accent: 'var(--wheel-icon-circle)',
    surface: ['var(--wheel-circle-a)', 'var(--wheel-circle-b)'],
    edge: 'var(--wheel-icon-circle)',
    angle: 0,
    paths: [
      'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2',
      'M9 7a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
      'M22 21v-2a4 4 0 0 0-3-3.87',
      'M16 3.13a4 4 0 0 1 0 7.75',
    ],
  },
  {
    id: 'event',
    title: 'New Event',
    desc: 'Host a meetup',
    lucide: 'Calendar',
    accent: 'var(--wheel-icon-event)',
    surface: ['var(--wheel-event-a)', 'var(--wheel-event-b)'],
    edge: 'var(--wheel-icon-event)',
    angle: 90,
    paths: [
      'M8 2v4',
      'M16 2v4',
      'M3 10h18',
      'M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z',
    ],
  },
  {
    id: 'lfg',
    title: 'LFG',
    desc: "I'm free now",
    lucide: 'Zap',
    accent: 'var(--wheel-icon-lfg)',
    surface: ['var(--wheel-lfg-a)', 'var(--wheel-lfg-b)'],
    edge: 'var(--wheel-icon-lfg)',
    angle: 180,
    paths: [
      'M13 2 3 14h9l-1 8 10-12h-9l1-8z',
    ],
  },
  {
    id: 'coffee',
    title: 'Coffee Chat',
    desc: '1:1 meetup',
    lucide: 'Coffee',
    accent: 'var(--wheel-icon-coffee)',
    surface: ['var(--wheel-coffee-a)', 'var(--wheel-coffee-b)'],
    edge: 'var(--wheel-icon-coffee)',
    angle: 270,
    paths: [
      'M10 2v2',
      'M14 2v2',
      'M6 2v2',
      'M18 8h1a4 4 0 0 1 0 8h-1',
      'M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z',
    ],
  },
]

export function getCreateAction(id) {
  return CREATE_ACTION_DEFS.find(a => a.id === id) || null
}
