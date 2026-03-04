// ═══════════════════════════════════════════════════════════════
//  Cloud Sync Badge — Shows cloud sync status on artifact cards
// ═══════════════════════════════════════════════════════════════
//
//  Renders as a small pill badge (like GuardianBadge). Shows
//  syncing/synced/error states for Pro user project file persistence.

import { useProjectStore } from '../stores/projectStore'
import { IconCloud, IconCloudCheck, IconCloudAlert } from './KernelIcons'

export function CloudSyncBadge({ conversationId, filename }: {
  conversationId: string
  filename: string
}) {
  const status = useProjectStore(s => s.syncStatus[conversationId]?.[filename])
  const syncToCloud = useProjectStore(s => s.syncToCloud)

  if (!status) return null

  return (
    <div className={`ka-cloud-badge ka-cloud-badge--${status}`}>
      {status === 'syncing' && <IconCloud size={12} />}
      {status === 'synced' && <IconCloudCheck size={12} />}
      {status === 'error' && (
        <button
          className="ka-cloud-badge-retry"
          onClick={() => syncToCloud(conversationId, filename)}
          aria-label="Retry cloud sync"
        >
          <IconCloudAlert size={12} />
          <span>Failed</span>
        </button>
      )}
      {status === 'syncing' && <span>Syncing...</span>}
      {status === 'synced' && <span>Synced</span>}
    </div>
  )
}
