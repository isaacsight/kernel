#!/usr/bin/env npx tsx
import * as dotenv from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import * as fs from 'fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const envPath = resolve(__dirname, '..', '.env')
dotenv.config({ path: envPath })

const TOKEN = process.env.DISCORD_BOT_TOKEN
if (!TOKEN) { console.error('No DISCORD_BOT_TOKEN'); process.exit(1) }

async function main() {
  // List guilds
  const res = await fetch('https://discord.com/api/v10/users/@me/guilds', {
    headers: { Authorization: `Bot ${TOKEN}` }
  })
  const guilds: any[] = await res.json()

  console.log(`Bot is in ${guilds.length} server(s):\n`)
  for (const g of guilds) {
    console.log(`  ${g.name}`)
    console.log(`    ID: ${g.id}`)
    console.log(`    Owner: ${g.owner}`)
    console.log(`    Permissions: ${g.permissions}`)

    // Get channels
    const chRes = await fetch(`https://discord.com/api/v10/guilds/${g.id}/channels`, {
      headers: { Authorization: `Bot ${TOKEN}` }
    })
    if (chRes.ok) {
      const channels: any[] = await chRes.json()
      console.log(`    Channels: ${channels.length}`)
      for (const ch of channels.sort((a: any, b: any) => a.position - b.position)) {
        const type = ch.type === 4 ? 'CATEGORY' : ch.type === 0 ? 'text' : ch.type === 15 ? 'forum' : `type-${ch.type}`
        const prefix = ch.type === 4 ? '\n    📁' : '      #'
        console.log(`${prefix} ${ch.name} (${type})`)
      }
    }

    // Save guild ID to .env if only one guild
    if (guilds.length === 1) {
      const envContent = fs.readFileSync(envPath, 'utf-8')
      if (!envContent.includes('DISCORD_GUILD_ID')) {
        fs.appendFileSync(envPath, `\nDISCORD_GUILD_ID=${g.id}\n`)
        console.log(`\n✅ Saved DISCORD_GUILD_ID=${g.id} to .env`)
      } else {
        console.log(`\n✓ DISCORD_GUILD_ID already in .env`)
      }
    }

    // Create invite
    const textChannels = await (async () => {
      const r = await fetch(`https://discord.com/api/v10/guilds/${g.id}/channels`, {
        headers: { Authorization: `Bot ${TOKEN}` }
      })
      return r.ok ? (await r.json() as any[]).filter((c: any) => c.type === 0) : []
    })()

    if (textChannels.length > 0) {
      try {
        const invRes = await fetch(`https://discord.com/api/v10/channels/${textChannels[0].id}/invites`, {
          method: 'POST',
          headers: { Authorization: `Bot ${TOKEN}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ max_age: 0, max_uses: 0, unique: false })
        })
        if (invRes.ok) {
          const invite = await invRes.json() as any
          console.log(`\n🔗 Invite: https://discord.gg/${invite.code}`)
        }
      } catch {}
    }
  }
}

main().catch(e => { console.error(e.message); process.exit(1) })
