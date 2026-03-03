// ─── Author Card ───────────────────────────────────────────────
//
// Compact author info card with follow button.

import type { AuthorProfile } from '../../stores/discoveryStore'

interface AuthorCardProps {
  authorId: string
  profile: AuthorProfile
  isFollowing: boolean
  onToggleFollow: (authorId: string) => void
  isOwnProfile?: boolean
}

export function AuthorCard({ authorId, profile, isFollowing, onToggleFollow, isOwnProfile }: AuthorCardProps) {
  return (
    <div className="ka-author-card">
      <div className="ka-author-card-avatar">
        {profile.avatar_url
          ? <img src={profile.avatar_url} alt="" className="ka-author-card-img" />
          : <span className="ka-author-card-initial">{(profile.display_name || 'A')[0].toUpperCase()}</span>
        }
      </div>
      <div className="ka-author-card-info">
        <span className="ka-author-card-name">
          {profile.display_name || 'Anonymous'}
        </span>
        {profile.bio && (
          <span className="ka-author-card-bio">{profile.bio}</span>
        )}
        <div className="ka-author-card-stats">
          <span>{profile.follower_count} follower{profile.follower_count !== 1 ? 's' : ''}</span>
          <span className="ka-author-card-sep">{'\u00B7'}</span>
          <span>{profile.following_count} following</span>
        </div>
      </div>
      {!isOwnProfile && (
        <button
          className={`ka-author-card-follow ${isFollowing ? 'ka-author-card-follow--active' : ''}`}
          onClick={() => onToggleFollow(authorId)}
        >
          {isFollowing ? 'Following' : 'Follow'}
        </button>
      )}
    </div>
  )
}
