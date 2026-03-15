#!/usr/bin/env npx tsx
// ─────────────────────────────────────────────────────────────
//  Discord Server Setup — Automated channel & role creation
//  Run: npx tsx tools/discord-setup.ts
//
//  Prerequisites:
//  1. Create Discord server manually (API can't do this for bots)
//  2. Create bot at https://discord.com/developers/applications
//  3. Set DISCORD_BOT_TOKEN and DISCORD_GUILD_ID in .env
//  4. Invite bot with admin permissions
//
//  This script creates:
//  - 6 channel categories with 18 channels
//  - 6 roles with colors
//  - Webhook for GitHub notifications
// ─────────────────────────────────────────────────────────────

import * as dotenv from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: resolve(__dirname, '..', '.env') })

const TOKEN = process.env.DISCORD_BOT_TOKEN
const GUILD_ID = process.env.DISCORD_GUILD_ID

if (!TOKEN || !GUILD_ID) {
  console.error('Missing DISCORD_BOT_TOKEN or DISCORD_GUILD_ID in .env')
  process.exit(1)
}

const API = 'https://discord.com/api/v10'
const headers = {
  Authorization: `Bot ${TOKEN}`,
  'Content-Type': 'application/json',
}

async function api(path: string, method = 'GET', body?: unknown) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Discord API ${method} ${path}: ${res.status} ${text}`)
  }
  return res.json()
}

// ─── Roles ───────────────────────────────────────────────────

const ROLES = [
  { name: 'Creator', color: 0xFFD700, hoist: true, position: 6 },
  { name: 'Maintainer', color: 0x6B5B95, hoist: true, position: 5 },
  { name: 'Contributor', color: 0x2ECC71, hoist: true, position: 4 },
  { name: 'Pro User', color: 0x3498DB, hoist: true, position: 3 },
  { name: 'Community', color: 0x95A5A6, hoist: false, position: 2 },
  { name: 'Bot', color: 0x5865F2, hoist: false, position: 1 },
]

// ─── Channels ────────────────────────────────────────────────

interface ChannelDef {
  name: string
  type: 0 | 4 | 15  // 0=text, 4=category, 15=forum
  topic?: string
  parent?: string  // category name
}

const CHANNELS: ChannelDef[] = [
  // Categories
  { name: '📢 ANNOUNCEMENTS', type: 4 },
  { name: '💬 COMMUNITY', type: 4 },
  { name: '🛠️ DEVELOPMENT', type: 4 },
  { name: '🤖 AI & MODELS', type: 4 },
  { name: '📚 RESOURCES', type: 4 },
  { name: '🔇 META', type: 4 },

  // Announcements
  { name: 'announcements', type: 0, topic: 'Release notes and breaking changes', parent: '📢 ANNOUNCEMENTS' },
  { name: 'releases', type: 0, topic: 'Automated npm and Docker publish notifications', parent: '📢 ANNOUNCEMENTS' },
  { name: 'roadmap', type: 0, topic: 'Roadmap updates and community polls', parent: '📢 ANNOUNCEMENTS' },

  // Community
  { name: 'general', type: 0, topic: 'General discussion about K:BOT and AI', parent: '💬 COMMUNITY' },
  { name: 'introductions', type: 0, topic: 'Introduce yourself to the community', parent: '💬 COMMUNITY' },
  { name: 'showcase', type: 0, topic: 'Share what you built with kbot', parent: '💬 COMMUNITY' },
  { name: 'help', type: 0, topic: 'Get help using K:BOT — install, config, usage', parent: '💬 COMMUNITY' },

  // Development
  { name: 'contributors', type: 0, topic: 'For active contributors — discuss PRs, architecture', parent: '🛠️ DEVELOPMENT' },
  { name: 'feature-requests', type: 15, topic: 'Discuss new features before opening GitHub issues', parent: '🛠️ DEVELOPMENT' },
  { name: 'bug-reports', type: 0, topic: 'Quick bug discussion before filing on GitHub', parent: '🛠️ DEVELOPMENT' },
  { name: 'github-feed', type: 0, topic: 'Automated GitHub notifications — commits, PRs, issues', parent: '🛠️ DEVELOPMENT' },

  // AI & Models
  { name: 'providers', type: 0, topic: 'Discuss AI providers — Anthropic, OpenAI, Ollama, etc.', parent: '🤖 AI & MODELS' },
  { name: 'local-models', type: 0, topic: 'Embedded inference, GGUF models, performance tuning', parent: '🤖 AI & MODELS' },
  { name: 'agents', type: 0, topic: '39 specialist agents, custom agents, workflows', parent: '🤖 AI & MODELS' },
  { name: 'tools', type: 0, topic: '228 tools — development, ideas, requests', parent: '🤖 AI & MODELS' },

  // Resources
  { name: 'tutorials', type: 0, topic: 'Guides and walkthroughs', parent: '📚 RESOURCES' },
  { name: 'tips-and-tricks', type: 0, topic: 'Quick tips for K:BOT power users', parent: '📚 RESOURCES' },
  { name: 'links', type: 0, topic: 'Useful external resources, articles, tools', parent: '📚 RESOURCES' },

  // Meta
  { name: 'bot-commands', type: 0, topic: 'Interact with the K:BOT Discord bot', parent: '🔇 META' },
  { name: 'feedback', type: 0, topic: 'Server feedback and suggestions', parent: '🔇 META' },
]

// ─── Main ────────────────────────────────────────────────────

async function setup() {
  console.log('🤖 K:BOT Discord Server Setup')
  console.log('═'.repeat(50))

  // 1. Create roles (skip if no permission)
  console.log('\n📋 Creating roles...')
  const roleMap: Record<string, string> = {}
  try {
    const existingRoles: any[] = await api(`/guilds/${GUILD_ID}/roles`)
    for (const role of ROLES) {
      const existing = existingRoles.find((r: any) => r.name === role.name)
      if (existing) {
        console.log(`  ✓ ${role.name} (exists)`)
        roleMap[role.name] = existing.id
      } else {
        try {
          const created = await api(`/guilds/${GUILD_ID}/roles`, 'POST', {
            name: role.name,
            color: role.color,
            hoist: role.hoist,
            mentionable: true,
          })
          console.log(`  + ${role.name} (created)`)
          roleMap[role.name] = created.id
        } catch (e: any) {
          console.log(`  ⚠ ${role.name} — missing permission, skipping`)
        }
      }
    }
  } catch (e: any) {
    console.log(`  ⚠ Cannot manage roles (missing permission) — skipping all roles`)
  }

  // 2. Create channels
  console.log('\n📺 Creating channels...')
  const existingChannels: any[] = await api(`/guilds/${GUILD_ID}/channels`)
  const categoryMap: Record<string, string> = {}

  // Create categories first
  for (const ch of CHANNELS.filter(c => c.type === 4)) {
    const existing = existingChannels.find((c: any) => c.name === ch.name && c.type === 4)
    if (existing) {
      console.log(`  ✓ ${ch.name} (exists)`)
      categoryMap[ch.name] = existing.id
    } else {
      const created = await api(`/guilds/${GUILD_ID}/channels`, 'POST', {
        name: ch.name,
        type: 4,
      })
      console.log(`  + ${ch.name} (created)`)
      categoryMap[ch.name] = created.id
    }
  }

  // Create text/forum channels
  for (const ch of CHANNELS.filter(c => c.type !== 4)) {
    const parentId = ch.parent ? categoryMap[ch.parent] : undefined
    const existing = existingChannels.find((c: any) => c.name === ch.name && c.type !== 4)
    if (existing) {
      console.log(`  ✓ #${ch.name} (exists)`)
    } else {
      await api(`/guilds/${GUILD_ID}/channels`, 'POST', {
        name: ch.name,
        type: ch.type,
        topic: ch.topic,
        parent_id: parentId,
      })
      console.log(`  + #${ch.name} (created)`)
    }
  }

  // 3. Create webhook for GitHub notifications
  console.log('\n🔗 Creating webhooks...')
  const githubFeed = existingChannels.find((c: any) => c.name === 'github-feed') ||
    (await api(`/guilds/${GUILD_ID}/channels`)).find((c: any) => c.name === 'github-feed')

  if (githubFeed) {
    try {
      const webhook = await api(`/channels/${githubFeed.id}/webhooks`, 'POST', {
        name: 'GitHub',
      })
      console.log(`  + GitHub webhook created for #github-feed`)
      console.log(`  📋 Webhook URL: ${webhook.url}`)
      console.log(`  → Add this to GitHub repo Settings → Webhooks`)
    } catch (e: any) {
      if (e.message.includes('30007')) {
        console.log(`  ✓ #github-feed already has max webhooks`)
      } else {
        console.log(`  ⚠ Could not create webhook: ${e.message}`)
      }
    }
  }

  const releases = existingChannels.find((c: any) => c.name === 'releases') ||
    (await api(`/guilds/${GUILD_ID}/channels`)).find((c: any) => c.name === 'releases')

  if (releases) {
    try {
      const webhook = await api(`/channels/${releases.id}/webhooks`, 'POST', {
        name: 'npm Releases',
      })
      console.log(`  + npm Releases webhook created for #releases`)
      console.log(`  📋 Webhook URL: ${webhook.url}`)
    } catch (e: any) {
      if (e.message.includes('30007')) {
        console.log(`  ✓ #releases already has max webhooks`)
      } else {
        console.log(`  ⚠ Could not create webhook: ${e.message}`)
      }
    }
  }

  // 4. Summary
  console.log('\n' + '═'.repeat(50))
  console.log('✅ Discord server setup complete!')
  console.log(`\n  Roles: ${ROLES.length}`)
  console.log(`  Categories: ${CHANNELS.filter(c => c.type === 4).length}`)
  console.log(`  Channels: ${CHANNELS.filter(c => c.type !== 4).length}`)
  console.log('\n📌 Next steps:')
  console.log('  1. Add GitHub webhook URL to repo Settings → Webhooks')
  console.log('  2. Set DISCORD_WEBHOOK_URL, DISCORD_RELEASES_WEBHOOK, DISCORD_GITHUB_WEBHOOK in .env')
  console.log('  3. Run the bot: npx tsx tools/discord-bot.ts')
  console.log('  4. Create a vanity invite link: https://discord.gg/kernel-chat')
}

setup().catch(err => {
  console.error('Setup failed:', err.message)
  process.exit(1)
})
