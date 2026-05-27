#!/usr/bin/env npx tsx
// ─────────────────────────────────────────────────────────────
//  Discord Server Creator — Creates the K:BOT Community server
//  Run: npx tsx tools/discord-create-server.ts
//
//  Creates the server, saves GUILD_ID to .env, then runs setup
// ─────────────────────────────────────────────────────────────

import * as dotenv from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { discordApi, appendEnvIfMissing } from './discord-rest.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const envPath = resolve(__dirname, '..', '.env')
dotenv.config({ path: envPath })

const TOKEN = process.env.DISCORD_BOT_TOKEN

if (!TOKEN) {
  console.error('Missing DISCORD_BOT_TOKEN in .env')
  process.exit(1)
}

const api = (path: string, method = 'GET', body?: unknown) =>
  discordApi(path, { token: TOKEN }, method, body)

async function createServer() {
  console.log('🤖 K:BOT Discord Server Creator')
  console.log('═'.repeat(50))

  // Check if guild already exists
  if (process.env.DISCORD_GUILD_ID) {
    console.log(`\n✓ Server already exists: ${process.env.DISCORD_GUILD_ID}`)
    console.log('  Run tools/discord-setup.ts to scaffold channels.')
    return
  }

  // Check how many guilds the bot is in
  const guilds: any[] = await api('/users/@me/guilds')
  console.log(`\nBot is currently in ${guilds.length} server(s)`)

  if (guilds.length >= 10) {
    console.error('Bot is in 10+ guilds — cannot create new servers via API.')
    console.error('Create the server manually in Discord, then add DISCORD_GUILD_ID to .env')
    process.exit(1)
  }

  // Create the server
  console.log('\n📦 Creating K:BOT Community server...')

  const server = await api('/guilds', 'POST', {
    name: 'K:BOT Community',
    icon: null,
    channels: [
      // Default channels created with the server
      { name: 'welcome', type: 0 },
      { name: 'general', type: 0 },
    ],
  })

  const guildId = server.id
  console.log(`\n✅ Server created!`)
  console.log(`  Name: ${server.name}`)
  console.log(`  ID: ${guildId}`)

  if (appendEnvIfMissing(envPath, 'DISCORD_GUILD_ID', guildId)) {
    console.log(`  Saved DISCORD_GUILD_ID to .env`)
  }

  // Create invite
  try {
    const channels: any[] = await api(`/guilds/${guildId}/channels`)
    const textChannel = channels.find((c: any) => c.type === 0)
    if (textChannel) {
      const invite = await api(`/channels/${textChannel.id}/invites`, 'POST', {
        max_age: 0, // Never expires
        max_uses: 0, // Unlimited
        unique: true,
      })
      console.log(`\n🔗 Invite link: https://discord.gg/${invite.code}`)
      console.log(`   (Never expires, unlimited uses)`)

      appendEnvIfMissing(envPath, 'DISCORD_INVITE_URL', `https://discord.gg/${invite.code}`)
    }
  } catch (e: any) {
    console.log(`\n⚠ Could not create invite: ${e.message}`)
  }

  // Enable community features
  try {
    // We need to set up rules and public updates channels first
    const channels: any[] = await api(`/guilds/${guildId}/channels`)
    const welcome = channels.find((c: any) => c.name === 'welcome')
    const general = channels.find((c: any) => c.name === 'general')

    if (welcome && general) {
      await api(`/guilds/${guildId}`, 'PATCH', {
        features: ['COMMUNITY'],
        rules_channel_id: welcome.id,
        public_updates_channel_id: general.id,
        description: 'Official community for K:BOT — the universal AI terminal agent. 39 specialists, 228 tools, 20 providers.',
      })
      console.log(`\n🏛️ Community features enabled`)
    }
  } catch (e: any) {
    console.log(`\n⚠ Could not enable community features: ${e.message}`)
    console.log(`   Enable manually: Server Settings → Community`)
  }

  console.log('\n' + '═'.repeat(50))
  console.log('📌 Next step: npx tsx tools/discord-setup.ts')
  console.log('   This will create all channels, roles, and webhooks.')
}

createServer().catch(err => {
  console.error('\nFailed:', err.message)
  if (err.message.includes('401')) {
    console.error('Bot token is invalid or expired. Check DISCORD_BOT_TOKEN in .env')
  } else if (err.message.includes('400')) {
    console.error('Bad request — the bot may not have the required permissions.')
  }
  process.exit(1)
})
