import TicTacToeBoard from './TicTacToeBoard'
import ConnectFourBoard from './ConnectFourBoard'
import CheckersBoard from './CheckersBoard'
import ChessBoard from './ChessBoard'

export default function GameBoard({ gameType, state, myToken, myTurn, onMove }) {
  if (gameType === 'tic_tac_toe')  return <TicTacToeBoard  state={state} myToken={myToken} myTurn={myTurn} onMove={onMove} />
  if (gameType === 'connect_four') return <ConnectFourBoard state={state} myToken={myToken} myTurn={myTurn} onMove={onMove} />
  if (gameType === 'checkers')     return <CheckersBoard    state={state} myToken={myToken} myTurn={myTurn} onMove={onMove} />
  if (gameType === 'chess')        return <ChessBoard       state={state} myToken={myToken} myTurn={myTurn} onMove={onMove} />
  return null
}
