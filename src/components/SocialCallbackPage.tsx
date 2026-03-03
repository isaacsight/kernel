// ─── SocialCallbackPage ────────────────────────────────────────
// OAuth callback handler page. Shows status then auto-closes.

import { useSocialCallback } from '../hooks/useSocialCallback'
import { PLATFORM_META } from '../engine/social/types'
import type { SocialPlatform } from '../engine/social/types'

export function SocialCallbackPage() {
  const { platform, status, error, accountName } = useSocialCallback()
  const meta = platform ? PLATFORM_META[platform as SocialPlatform] : null

  return (
    <div className="ka-social-callback">
      {status === 'loading' && (
        <div className="ka-social-callback-content">
          <div className="ka-social-callback-spinner" />
          <p>Connecting to {meta?.label || platform}...</p>
        </div>
      )}

      {status === 'success' && (
        <div className="ka-social-callback-content">
          <span className="ka-social-callback-check">{'\u2713'}</span>
          <h2>Connected</h2>
          <p>{accountName} on {meta?.label || platform}</p>
          <p className="ka-social-callback-sub">This window will close automatically.</p>
        </div>
      )}

      {status === 'error' && (
        <div className="ka-social-callback-content">
          <span className="ka-social-callback-error">{'\u2717'}</span>
          <h2>Connection Failed</h2>
          <p>{error}</p>
          <button className="ka-social-callback-close" onClick={() => window.close()}>
            Close
          </button>
        </div>
      )}
    </div>
  )
}
