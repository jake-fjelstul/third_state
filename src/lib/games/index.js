import * as ttt from './ticTacToe'
import * as c4 from './connectFour'
import * as checkers from './checkers'
import * as chess from './chess'

export const GAME_TYPES = {
  tic_tac_toe: {
    id: 'tic_tac_toe',
    label: 'Tic-Tac-Toe',
    emoji: '⭕',
    blurb: '3 in a row. Quick & casual.',
    accent: '#5B5FEF',
    module: ttt,
  },
  connect_four: {
    id: 'connect_four',
    label: 'Connect Four',
    emoji: '🔴',
    blurb: '4 in a row. Drop to win.',
    accent: '#EF4444',
    module: c4,
  },
  checkers: {
    id: 'checkers',
    label: 'Checkers',
    emoji: '⚫',
    blurb: 'Jump, capture, crown your kings.',
    accent: '#7C2D12',
    module: checkers,
  },
  chess: {
    id: 'chess',
    label: 'Chess',
    emoji: '♟️',
    blurb: 'The classic. Checkmate to win.',
    accent: '#1F2937',
    module: chess,
  },
}

export const GAME_LIST = Object.values(GAME_TYPES)
