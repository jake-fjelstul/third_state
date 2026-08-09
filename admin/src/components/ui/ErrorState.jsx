import { supabase } from '../../lib/supabase'

export function ErrorState({ error, reload }) {
  const errMsg = error?.message || error?.toString() || 'Unknown error'
  const isNotAuthorized = errMsg.toLowerCase().includes('not authorized') || errMsg.includes('42501')

  const handleSignOut = () => {
    supabase.auth.signOut()
  }

  return (
    <div className="bg-panel border border-line rounded-xl p-8 text-center max-w-md mx-auto my-8">
      <h3 className="font-display text-lg font-bold text-text mb-2">
        {isNotAuthorized ? 'This account lost admin access.' : "Couldn't load this"}
      </h3>
      <p className="font-body text-sm text-muted mb-4">
        {isNotAuthorized ? 'Your session is no longer authorized as an admin.' : 'The server returned an error.'}
      </p>
      <div className="font-mono text-[11px] text-faint bg-raised/50 p-2.5 rounded-md mb-6 break-words">
        {errMsg}
      </div>
      <div>
        {isNotAuthorized ? (
          <button
            type="button"
            onClick={handleSignOut}
            className="px-4 py-2 bg-indigo text-text font-body text-sm font-medium rounded-lg hover:bg-indigo/90 transition-colors"
          >
            Sign out
          </button>
        ) : (
          <button
            type="button"
            onClick={reload}
            className="px-4 py-2 bg-raised border border-line text-text font-body text-sm font-medium rounded-lg hover:bg-line/50 transition-colors"
          >
            Try again
          </button>
        )}
      </div>
    </div>
  )
}
