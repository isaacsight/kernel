// K:BOT Composio Integration — 1000+ authenticated tool integrations
//
// Composio provides pre-built auth flows for Gmail, Slack, Notion, Jira,
// GitHub, Salesforce, HubSpot, and hundreds more. This module bridges
// Composio's action catalog into kbot's native tool system.
//
// Config stored in ~/.kbot/composio.json (separate from main kbot config).

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { homedir } from 'node:os'
import { registerTool, type ToolDefinition } from './index.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ComposioConfig {
  apiKey: string
  connections: Record<string, {
    appId: string
    connectedAt: string
  }>
}

interface ComposioApp {
  name: string
  key: string
  description: string
  categories: string[]
  enabled: boolean
}

interface ComposioAction {
  name: string
  display_name: string
  description: string
  appName: string
  parameters: {
    title?: string
    type: string
    properties: Record<string, {
      type: string
      description?: string
      title?: string
    }>
    required?: string[]
  }
}

interface ComposioConnection {
  id: string
  appUniqueId: string
  status: string
  createdAt: string
}

// ---------------------------------------------------------------------------
// Config management
// ---------------------------------------------------------------------------

const CONFIG_PATH = join(homedir(), '.kbot', 'composio.json')
const BASE_URL = 'https://backend.composio.dev/api/v2'
const REQUEST_TIMEOUT = 30_000

function loadConfig(): ComposioConfig | null {
  try {
    if (!existsSync(CONFIG_PATH)) return null
    const raw = readFileSync(CONFIG_PATH, 'utf-8')
    return JSON.parse(raw) as ComposioConfig
  } catch {
    return null
  }
}

function saveConfig(config: ComposioConfig): void {
  mkdirSync(dirname(CONFIG_PATH), { recursive: true })
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8')
}

function getApiKey(): string | null {
  // Environment variable takes precedence
  const envKey = process.env['COMPOSIO_API_KEY']
  if (envKey) return envKey
  const config = loadConfig()
  return config?.apiKey ?? null
}

const SETUP_MSG =
  'Composio is not configured. Set up with one of:\n' +
  '  1. Run: kbot composio setup\n' +
  '  2. Set env var: export COMPOSIO_API_KEY=your_key\n' +
  '  3. Add apiKey to ~/.kbot/composio.json\n\n' +
  'Get your API key at https://app.composio.dev/settings'

// ---------------------------------------------------------------------------
// Composio API client
// ---------------------------------------------------------------------------

async function composioFetch(
  path: string,
  options: { method?: string; body?: unknown } = {},
): Promise<{ ok: boolean; status: number; data: unknown }> {
  const apiKey = getApiKey()
  if (!apiKey) throw new Error(SETUP_MSG)

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT)

  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: options.method ?? 'GET',
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      ...(options.body ? { body: JSON.stringify(options.body) } : {}),
      signal: controller.signal,
    })

    const text = await res.text()
    let data: unknown
    try {
      data = JSON.parse(text)
    } catch {
      data = text
    }

    return { ok: res.ok, status: res.status, data }
  } finally {
    clearTimeout(timer)
  }
}

/** List all available Composio apps */
async function listApps(): Promise<ComposioApp[]> {
  const res = await composioFetch('/apps')
  if (!res.ok) throw new Error(`Composio API error ${res.status}: ${JSON.stringify(res.data)}`)
  const data = res.data as { items?: ComposioApp[] }
  return data.items ?? (Array.isArray(res.data) ? res.data as ComposioApp[] : [])
}

/** Get available actions for a specific app */
async function getActions(appName: string): Promise<ComposioAction[]> {
  const res = await composioFetch(`/actions?appNames=${encodeURIComponent(appName)}`)
  if (!res.ok) throw new Error(`Composio API error ${res.status}: ${JSON.stringify(res.data)}`)
  const data = res.data as { items?: ComposioAction[] }
  return data.items ?? (Array.isArray(res.data) ? res.data as ComposioAction[] : [])
}

/** Search actions across all apps by query */
async function searchActions(query: string): Promise<ComposioAction[]> {
  const res = await composioFetch(`/actions?useCase=${encodeURIComponent(query)}`)
  if (!res.ok) throw new Error(`Composio API error ${res.status}: ${JSON.stringify(res.data)}`)
  const data = res.data as { items?: ComposioAction[] }
  return data.items ?? (Array.isArray(res.data) ? res.data as ComposioAction[] : [])
}

/** Execute a Composio action */
async function executeAction(
  actionId: string,
  params: Record<string, unknown>,
  entityId = 'default',
): Promise<unknown> {
  const res = await composioFetch(`/actions/${encodeURIComponent(actionId)}/execute`, {
    method: 'POST',
    body: {
      entityId,
      input: params,
    },
  })
  if (!res.ok) throw new Error(`Composio execute error ${res.status}: ${JSON.stringify(res.data)}`)
  return res.data
}

/** Get current connections */
async function getConnections(): Promise<ComposioConnection[]> {
  const res = await composioFetch('/connectedAccounts')
  if (!res.ok) throw new Error(`Composio API error ${res.status}: ${JSON.stringify(res.data)}`)
  const data = res.data as { items?: ComposioConnection[] }
  return data.items ?? (Array.isArray(res.data) ? res.data as ComposioConnection[] : [])
}

/** Initiate a connection to an app (returns auth URL) */
async function initiateConnection(
  appName: string,
  entityId = 'default',
): Promise<{ redirectUrl: string; connectedAccountId: string }> {
  // First get the app's integration ID
  const res = await composioFetch('/connectedAccounts', {
    method: 'POST',
    body: {
      integrationId: appName.toLowerCase(),
      entityId,
    },
  })
  if (!res.ok) throw new Error(`Composio connect error ${res.status}: ${JSON.stringify(res.data)}`)
  return res.data as { redirectUrl: string; connectedAccountId: string }
}

// ---------------------------------------------------------------------------
// Tool registration
// ---------------------------------------------------------------------------

export function registerComposioTools(): void {

  // ---- composio_connect ----
  registerTool({
    name: 'composio_connect',
    description:
      'Connect to a Composio app (Gmail, Slack, Notion, Jira, GitHub, Salesforce, etc.). ' +
      'Initiates the OAuth/auth flow and returns the authorization URL. ' +
      'After the user completes auth, the connection is stored locally.',
    parameters: {
      app_name: {
        type: 'string',
        description: 'Name of the app to connect (e.g., "gmail", "slack", "notion", "github", "jira")',
        required: true,
      },
      entity_id: {
        type: 'string',
        description: 'Entity ID for multi-user setups (default: "default")',
      },
    },
    tier: 'free',
    timeout: 30_000,
    async execute(args) {
      const appName = String(args.app_name).toLowerCase().trim()
      if (!appName) return 'Error: app_name is required'
      const entityId = args.entity_id ? String(args.entity_id) : 'default'

      try {
        const result = await initiateConnection(appName, entityId)

        // Store connection locally
        const config = loadConfig() ?? { apiKey: getApiKey() ?? '', connections: {} }
        config.connections[appName] = {
          appId: result.connectedAccountId,
          connectedAt: new Date().toISOString(),
        }
        saveConfig(config)

        const lines = [
          `Composio connection initiated for: ${appName}`,
          '',
          `Authorization URL:`,
          result.redirectUrl,
          '',
          'Open this URL in a browser to complete authentication.',
          `Connection ID: ${result.connectedAccountId}`,
        ]
        return lines.join('\n')
      } catch (err) {
        if (err instanceof Error && err.message === SETUP_MSG) return SETUP_MSG
        return `Error connecting to ${appName}: ${err instanceof Error ? err.message : String(err)}`
      }
    },
  })

  // ---- composio_list_apps ----
  registerTool({
    name: 'composio_list_apps',
    description:
      'List available Composio apps and their connection status. ' +
      'Shows which apps are connected and available for use. ' +
      'Supports filtering by category.',
    parameters: {
      category: {
        type: 'string',
        description: 'Filter by category (e.g., "crm", "communication", "productivity")',
      },
      connected_only: {
        type: 'string',
        description: 'Set to "true" to show only connected apps',
      },
    },
    tier: 'free',
    timeout: 30_000,
    async execute(args) {
      const category = args.category ? String(args.category).toLowerCase() : ''
      const connectedOnly = args.connected_only === 'true' || args.connected_only === true

      try {
        const [apps, connections] = await Promise.all([
          listApps(),
          getConnections().catch(() => [] as ComposioConnection[]),
        ])

        const connectedIds = new Set(connections.map(c => c.appUniqueId?.toLowerCase()))
        const config = loadConfig()
        const localConnections = config?.connections ?? {}

        let filtered = apps
        if (category) {
          filtered = filtered.filter(app =>
            app.categories?.some(c => c.toLowerCase().includes(category))
          )
        }

        if (connectedOnly) {
          filtered = filtered.filter(app =>
            connectedIds.has(app.key?.toLowerCase()) ||
            localConnections[app.key?.toLowerCase()] != null
          )
        }

        if (filtered.length === 0) {
          return connectedOnly
            ? 'No connected apps found. Use composio_connect to connect an app.'
            : `No apps found${category ? ` for category "${category}"` : ''}. Try without a category filter.`
        }

        const lines = [`Composio Apps (${filtered.length} results):\n`]
        for (const app of filtered.slice(0, 50)) {
          const key = app.key?.toLowerCase() ?? app.name?.toLowerCase() ?? ''
          const isConnected = connectedIds.has(key) || localConnections[key] != null
          const status = isConnected ? '[connected]' : '[available]'
          const desc = app.description
            ? ` — ${app.description.slice(0, 80)}`
            : ''
          lines.push(`  ${status} ${app.name || app.key}${desc}`)
        }

        if (filtered.length > 50) {
          lines.push(`\n  ... and ${filtered.length - 50} more. Use a category filter to narrow results.`)
        }

        return lines.join('\n')
      } catch (err) {
        if (err instanceof Error && err.message === SETUP_MSG) return SETUP_MSG
        return `Error listing apps: ${err instanceof Error ? err.message : String(err)}`
      }
    },
  })

  // ---- composio_execute ----
  registerTool({
    name: 'composio_execute',
    description:
      'Execute a Composio action on a connected app. ' +
      'For example: send a Slack message, create a Jira issue, read Gmail, update a Notion page. ' +
      'Use composio_search to discover available actions first.',
    parameters: {
      app: {
        type: 'string',
        description: 'App name (e.g., "gmail", "slack", "notion")',
        required: true,
      },
      action: {
        type: 'string',
        description: 'Action ID to execute (e.g., "GMAIL_SEND_EMAIL", "SLACK_SEND_MESSAGE")',
        required: true,
      },
      params: {
        type: 'object',
        description: 'Action parameters (varies per action — use composio_search to see required params)',
        required: true,
        properties: {},
      },
      entity_id: {
        type: 'string',
        description: 'Entity ID for multi-user setups (default: "default")',
      },
    },
    tier: 'free',
    timeout: 30_000,
    async execute(args) {
      const app = String(args.app).toLowerCase().trim()
      const action = String(args.action).trim()
      const params = (args.params && typeof args.params === 'object' ? args.params : {}) as Record<string, unknown>
      const entityId = args.entity_id ? String(args.entity_id) : 'default'

      if (!app) return 'Error: app is required'
      if (!action) return 'Error: action is required'

      try {
        const result = await executeAction(action, params, entityId)

        // Format the result
        const output = typeof result === 'string'
          ? result
          : JSON.stringify(result, null, 2)

        return [
          `Composio action executed: ${action} (${app})`,
          '',
          'Result:',
          output.length > 10_000
            ? output.slice(0, 10_000) + `\n\n... (truncated, ${output.length} total chars)`
            : output,
        ].join('\n')
      } catch (err) {
        if (err instanceof Error && err.message === SETUP_MSG) return SETUP_MSG
        return `Error executing ${action}: ${err instanceof Error ? err.message : String(err)}`
      }
    },
  })

  // ---- composio_search ----
  registerTool({
    name: 'composio_search',
    description:
      'Search available Composio actions across all connected apps. ' +
      'Find actions by describing what you want to do, e.g., "send an email", "create a task", "post a message". ' +
      'Returns action IDs, descriptions, and required parameters.',
    parameters: {
      query: {
        type: 'string',
        description: 'Natural language search query (e.g., "send email", "create issue", "list files")',
        required: true,
      },
      app: {
        type: 'string',
        description: 'Optionally filter to a specific app (e.g., "gmail", "jira")',
      },
      limit: {
        type: 'number',
        description: 'Maximum results to return (default: 10)',
      },
    },
    tier: 'free',
    timeout: 30_000,
    async execute(args) {
      const query = String(args.query).trim()
      if (!query) return 'Error: query is required'

      const appFilter = args.app ? String(args.app).toLowerCase().trim() : ''
      const limit = typeof args.limit === 'number' ? Math.min(args.limit, 50) : 10

      try {
        let actions: ComposioAction[]

        if (appFilter) {
          // Get actions for a specific app
          actions = await getActions(appFilter)
          // Client-side filter by query
          const q = query.toLowerCase()
          actions = actions.filter(a =>
            (a.display_name?.toLowerCase().includes(q)) ||
            (a.description?.toLowerCase().includes(q)) ||
            (a.name?.toLowerCase().includes(q))
          )
        } else {
          // Use Composio's semantic search
          actions = await searchActions(query)
        }

        if (actions.length === 0) {
          return `No actions found for "${query}"${appFilter ? ` in ${appFilter}` : ''}. Try a broader query.`
        }

        const lines = [`Composio Actions (${Math.min(actions.length, limit)} of ${actions.length} results):\n`]

        for (const action of actions.slice(0, limit)) {
          const name = action.name || action.display_name
          const desc = action.description
            ? action.description.slice(0, 100)
            : '(no description)'
          const app = action.appName || '?'

          lines.push(`  ${name}`)
          lines.push(`    App: ${app}`)
          lines.push(`    ${desc}`)

          // Show required parameters
          if (action.parameters?.required && action.parameters.required.length > 0) {
            const reqParams = action.parameters.required.map(p => {
              const propDef = action.parameters.properties?.[p]
              const paramDesc = propDef?.description || propDef?.title || propDef?.type || ''
              return `${p}${paramDesc ? ` (${paramDesc})` : ''}`
            })
            lines.push(`    Required: ${reqParams.join(', ')}`)
          }

          // Show optional parameters (up to 5)
          if (action.parameters?.properties) {
            const requiredSet = new Set(action.parameters.required ?? [])
            const optional = Object.keys(action.parameters.properties)
              .filter(k => !requiredSet.has(k))
              .slice(0, 5)
            if (optional.length > 0) {
              lines.push(`    Optional: ${optional.join(', ')}`)
            }
          }

          lines.push('')
        }

        if (actions.length > limit) {
          lines.push(`  ... ${actions.length - limit} more results. Increase limit or narrow your query.`)
        }

        return lines.join('\n')
      } catch (err) {
        if (err instanceof Error && err.message === SETUP_MSG) return SETUP_MSG
        return `Error searching actions: ${err instanceof Error ? err.message : String(err)}`
      }
    },
  })
}

// ---------------------------------------------------------------------------
// Dynamic tool discovery — exposes connected app actions as native kbot tools
// ---------------------------------------------------------------------------

/**
 * Fetch available actions for all connected Composio apps and return them
 * as kbot-compatible ToolDefinition objects. This allows the agent to see
 * Composio actions alongside built-in tools.
 *
 * Call this after registerComposioTools() to dynamically expand the toolset.
 */
export async function getComposioTools(): Promise<ToolDefinition[]> {
  const apiKey = getApiKey()
  if (!apiKey) return [] // Composio not configured — skip silently

  const tools: ToolDefinition[] = []

  try {
    const connections = await getConnections()
    if (connections.length === 0) return []

    // Deduplicate connected app names
    const connectedApps = [...new Set(
      connections
        .filter(c => c.status === 'ACTIVE')
        .map(c => c.appUniqueId?.toLowerCase())
        .filter((v): v is string => !!v)
    )]

    // Fetch actions for each connected app in parallel (cap at 5 concurrent)
    const chunks: string[][] = []
    for (let i = 0; i < connectedApps.length; i += 5) {
      chunks.push(connectedApps.slice(i, i + 5))
    }

    for (const chunk of chunks) {
      const results = await Promise.allSettled(
        chunk.map(appName => getActions(appName))
      )

      for (const result of results) {
        if (result.status !== 'fulfilled') continue
        const actions = result.value

        for (const action of actions.slice(0, 20)) {
          // Convert Composio action schema to kbot ToolDefinition
          const parameters: ToolDefinition['parameters'] = {}

          if (action.parameters?.properties) {
            const requiredSet = new Set(action.parameters.required ?? [])
            for (const [key, prop] of Object.entries(action.parameters.properties)) {
              parameters[key] = {
                type: prop.type || 'string',
                description: prop.description || prop.title || key,
                required: requiredSet.has(key),
              }
            }
          }

          const toolName = `composio_${(action.name || '').toLowerCase().replace(/[^a-z0-9_]/g, '_')}`
          const appName = action.appName || 'unknown'

          tools.push({
            name: toolName,
            description:
              `[Composio/${appName}] ${action.display_name || action.name}: ` +
              `${action.description || 'No description'}`.slice(0, 200),
            parameters,
            tier: 'free',
            timeout: 30_000,
            async execute(args) {
              try {
                const result = await executeAction(
                  action.name,
                  args as Record<string, unknown>,
                )
                return typeof result === 'string'
                  ? result
                  : JSON.stringify(result, null, 2)
              } catch (err) {
                return `Composio error: ${err instanceof Error ? err.message : String(err)}`
              }
            },
          })
        }
      }
    }
  } catch {
    // Composio API unavailable — return empty, don't block kbot startup
  }

  return tools
}
