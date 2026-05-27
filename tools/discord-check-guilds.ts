#!/usr/bin/env npx tsx
import * as dotenv from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { discordApi, appendEnvIfMissing } from './discord-rest.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const envPath = resolve(__dirname, '..', '.env')
dotenv.config({ path: envPath })

const TOKEN = process.env.DISCORD_BOT_TOKEN
if (!TOKEN) { console.error('No DISCORD_BOT_TOKEN'); process.exit(1) }

const api = (path: string, method = 'GET', body?: unknown): Promise<any> =>
  discordApi(path, { token: TOKEN }, method, body)

async function main() {
  const guilds: any[] = await api('/users/@me/guilds')

  console.log(`Bot is in ${guilds.length} server(s):\n`)
  for (const g of guilds) {
    console.log(`  ${g.name}`)
    console.log(`    ID: ${g.id}`)
    console.log(`    Owner: ${g.owner}`)
    console.log(`    Permissions: ${g.permissions}`)

    const channels: any[] = await api(`/guilds/${g.id}/channels`).catch(() => [])
    if (channels.length) {
      console.log(`    Channels: ${channels.length}`)
      for (const ch of channels.sort((a: any, b: any) => a.position - b.position)) {
        const type = ch.type === 4 ? 'CATEGORY' : ch.type === 0 ? 'text' : ch.type === 15 ? 'forum' : `type-${ch.type}`
        const prefix = ch.type === 4 ? '\n    📁' : '      #'
        console.log(`${prefix} ${ch.name} (${type})`)
      }
    }

    if (guilds.length === 1) {
      if (appendEnvIfMissing(envPath, 'DISCORD_GUILD_ID', g.id)) {
        console.log(`\n✅ Saved DISCORD_GUILD_ID=${g.id} to .env`)
      } else {
        console.log(`\n✓ DISCORD_GUILD_ID already in .env`)
      }
    }

    const textChannels = channels.filter((c: any) => c.type === 0)
    if (textChannels.length > 0) {
      try {
        const invite = await api(`/channels/${textChannels[0].id}/invites`, 'POST', {
          max_age: 0, max_uses: 0, unique: false,
        })
        console.log(`\n🔗 Invite: https://discord.gg/${invite.code}`)
      } catch {}
    }
  }
}

main().catch(e => { console.error(e.message); process.exit(1) })
