// Shared definitions for the four create actions.
// Icon path data is taken from Lucide (ISC licensed) so it can be inlined
// inside SVG, where a Lucide React component cannot be nested.

export const CREATE_ACTION_DEFS = [
  {
    id: 'circle',
    title: 'New Circle',
    desc: 'Start a community',
    lucide: 'Users',
    accent: '#C7D2FE',
    surface: ['#3E3D96', '#2A2963'],
    edge: 'rgba(199,210,254,0.30)',
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
    accent: '#99F6E4',
    surface: ['#12655B', '#0C443D'],
    edge: 'rgba(153,246,228,0.30)',
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
    accent: '#FDE68A',
    surface: ['#8A6410', '#5E430B'],
    edge: 'rgba(253,230,138,0.30)',
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
    accent: '#FECDD3',
    surface: ['#8C3A4E', '#5F2634'],
    edge: 'rgba(254,205,211,0.30)',
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
