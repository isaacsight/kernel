import { useState } from 'react'
import { useAuthContext } from '../providers/AuthProvider'
import { useWorkspace } from '../hooks/useWorkspace'
import { IconTrash, IconPlus, IconCheck } from '../components/KernelIcons'

export function WorkspaceAdminPage() {
  const { user } = useAuthContext()
  const workspace = useWorkspace(user?.id ?? null)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('member')
  const [inviting, setInviting] = useState(false)
  const [inviteSuccess, setInviteSuccess] = useState(false)

  if (!workspace.activeWorkspace) {
    return (
      <div className="ka-workspace-admin">
        <h2>No workspace selected</h2>
        <p>Select a workspace from the switcher to manage it.</p>
      </div>
    )
  }

  const isOwner = workspace.activeWorkspace.owner_id === user?.id
  const isAdmin = workspace.members.some(m => m.user_id === user?.id && ['owner', 'admin'].includes(m.role))

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inviteEmail.trim() || inviting) return
    setInviting(true)
    const result = await workspace.inviteMember(inviteEmail.trim(), inviteRole)
    if (result) {
      setInviteEmail('')
      setInviteSuccess(true)
      setTimeout(() => setInviteSuccess(false), 3000)
    }
    setInviting(false)
  }

  return (
    <div className="ka-workspace-admin">
      <h2 className="ka-workspace-admin-title">{workspace.activeWorkspace.name}</h2>
      <p className="ka-workspace-admin-meta">
        {workspace.members.length} / {workspace.activeWorkspace.max_members} members
      </p>

      {/* Members list */}
      <section className="ka-workspace-section">
        <h3>Members</h3>
        <div className="ka-workspace-member-list">
          {workspace.members.map(m => (
            <div key={m.user_id} className="ka-workspace-member">
              <span className="ka-workspace-member-id">{m.user_id.slice(0, 8)}...</span>
              <span className="ka-workspace-member-role">{m.role}</span>
              {isAdmin && m.role !== 'owner' && (
                <button
                  className="ka-share-kick-btn"
                  onClick={() => workspace.removeMember(m.user_id)}
                  aria-label="Remove member"
                >
                  <IconTrash size={12} />
                </button>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Invite form */}
      {isAdmin && (
        <section className="ka-workspace-section">
          <h3>Invite Member</h3>
          <form className="ka-workspace-invite-form" onSubmit={handleInvite}>
            <input
              type="email"
              value={inviteEmail}
              onChange={e => setInviteEmail(e.target.value)}
              placeholder="email@example.com"
              className="ka-workspace-invite-input"
            />
            <select
              value={inviteRole}
              onChange={e => setInviteRole(e.target.value)}
              className="ka-workspace-invite-select"
            >
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
            <button type="submit" className="ka-share-create-btn" disabled={inviting || !inviteEmail.trim()}>
              {inviteSuccess ? <IconCheck size={14} /> : <IconPlus size={14} />}
              {inviting ? 'Sending...' : inviteSuccess ? 'Sent!' : 'Invite'}
            </button>
          </form>
        </section>
      )}

      {/* Pending invitations */}
      {isAdmin && workspace.invitations.length > 0 && (
        <section className="ka-workspace-section">
          <h3>Pending Invitations</h3>
          <div className="ka-workspace-member-list">
            {workspace.invitations.filter(i => !i.accepted_at).map(inv => (
              <div key={inv.id} className="ka-workspace-member">
                <span className="ka-workspace-member-id">{inv.email}</span>
                <span className="ka-workspace-member-role">{inv.role}</span>
                <span className="ka-workspace-member-expires">
                  Expires {new Date(inv.expires_at).toLocaleDateString()}
                </span>
                <button
                  className="ka-share-kick-btn"
                  onClick={() => workspace.revokeInvitation(inv.id)}
                  aria-label="Revoke invitation"
                >
                  <IconTrash size={12} />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Billing portal */}
      {isOwner && (
        <section className="ka-workspace-section">
          <h3>Billing</h3>
          <p className="ka-workspace-billing-desc">
            Manage your team subscription and payment method.
          </p>
          <button className="ka-share-create-btn" onClick={() => {
            // TODO: Link to Stripe portal for workspace billing
            window.open('https://billing.stripe.com', '_blank')
          }}>
            Manage Billing
          </button>
        </section>
      )}
    </div>
  )
}
