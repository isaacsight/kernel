#!/usr/bin/env npx tsx
// contact-notifier.ts — Polls Supabase for new contact messages
// and sends macOS notifications + plays a sound.
//
// Usage:
//   npx tsx tools/contact-notifier.ts
//   # or run as a launch agent (see below)
//
// Requires: SUPABASE_URL and SUPABASE_SERVICE_KEY env vars (from .env)

import { execSync } from 'child_process'
import { readFileSync, existsSync, writeFileSync } from 'fs'
import { join } from 'path'

const POLL_INTERVAL = 30_000 // 30 seconds
const STATE_FILE = join(process.env.HOME || '~', '.kbot', 'contact-notifier-state.json')

function loadEnv() {
  const envFile = join(import.meta.dirname || '.', '..', '.env')
  if (!existsSync(envFile)) {
    console.error('No .env file found. Set SUPABASE_URL and SUPABASE_SERVICE_KEY.')
    process.exit(1)
  }
  const lines = readFileSync(envFile, 'utf-8').split('\n')
  for (const line of lines) {
    const match = line.match(/^([A-Z_]+)=(.*)$/)
    if (match) process.env[match[1]] = match[2].replace(/^["']|["']$/g, '')
  }
}

function macNotify(title: string, message: string) {
  const escaped = message.replace(/"/g, '\\"').replace(/\\/g, '\\\\')
  const titleEscaped = title.replace(/"/g, '\\"')
  try {
    execSync(`osascript -e 'display notification "${escaped}" with title "${titleEscaped}" sound name "Glass"'`)
  } catch {
    console.error('macOS notification failed')
  }
}

function loadState(): { lastChecked: string } {
  try {
    if (existsSync(STATE_FILE)) {
      return JSON.parse(readFileSync(STATE_FILE, 'utf-8'))
    }
  } catch {}
  return { lastChecked: new Date().toISOString() }
}

function saveState(state: { lastChecked: string }) {
  const dir = join(process.env.HOME || '~', '.kbot')
  if (!existsSync(dir)) {
    execSync(`mkdir -p "${dir}"`)
  }
  writeFileSync(STATE_FILE, JSON.stringify(state), 'utf-8')
}

async function checkMessages() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_KEY
  if (!url || !key) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY')
    return
  }

  const state = loadState()
  const since = state.lastChecked

  try {
    const res = await fetch(
      `${url}/rest/v1/contact_messages?created_at=gt.${since}&order=created_at.asc`,
      {
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
        },
      }
    )

    if (!res.ok) {
      console.error(`Supabase error: ${res.status}`)
      return
    }

    const messages = await res.json()

    for (const msg of messages) {
      const from = msg.from_name ? `${msg.from_name} (${msg.from_email})` : msg.from_email
      const subject = msg.subject || '(no subject)'
      console.log(`[${new Date().toISOString()}] New email from ${from}: ${subject}`)
      macNotify(`New email — ${subject}`, `From: ${from}`)
    }

    if (messages.length > 0) {
      state.lastChecked = messages[messages.length - 1].created_at
    } else {
      state.lastChecked = new Date().toISOString()
    }
    saveState(state)
  } catch (err) {
    console.error('Poll error:', err)
  }
}

// --- Main loop ---
loadEnv()
console.log('Contact notifier started. Polling every 30s...')
console.log('Emails to support@kernel.chat → macOS notification + Discord')
checkMessages()
setInterval(checkMessages, POLL_INTERVAL)
