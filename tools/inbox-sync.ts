#!/usr/bin/env npx tsx
// inbox-sync — Poll contact_messages and save unread emails as .txt files
// Usage: npm run inbox
// Files saved to: ~/Desktop/Kernel Inbox/

import { createClient } from '@supabase/supabase-js'
import { mkdirSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'

const INBOX_DIR = join(homedir(), 'Desktop', 'Kernel Inbox')

// Ensure inbox directory exists
if (!existsSync(INBOX_DIR)) {
  mkdirSync(INBOX_DIR, { recursive: true })
  console.log(`  Created ${INBOX_DIR}`)
}

// Load env
const dotenvPath = join(import.meta.dirname, '..', '.env')
if (existsSync(dotenvPath)) {
  const { config } = await import('dotenv')
  config({ path: dotenvPath })
}

const url = process.env.VITE_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_KEY
if (!url || !key) {
  console.error('  Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_KEY in .env')
  process.exit(1)
}

const svc = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
})

console.log('\n  Kernel Inbox Sync\n')

// Fetch unread, non-archived messages
const { data: messages, error } = await svc
  .from('contact_messages')
  .select('*')
  .eq('read', false)
  .eq('archived', false)
  .order('received_at', { ascending: false })

if (error) {
  console.error('  DB error:', error.message)
  process.exit(1)
}

if (!messages || messages.length === 0) {
  console.log('  No unread messages.\n')
  process.exit(0)
}

console.log(`  ${messages.length} unread message(s)\n`)

const ids: string[] = []

for (const msg of messages) {
  const date = new Date(msg.received_at)
  const dateStr = date.toISOString().slice(0, 10)
  const timeStr = date.toTimeString().slice(0, 5)
  const safeName = (msg.from_name || msg.from_email)
    .replace(/[^a-zA-Z0-9@._-]/g, '_')
    .slice(0, 40)
  const safeSubject = (msg.subject || 'no-subject')
    .replace(/[^a-zA-Z0-9 _-]/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .slice(0, 50)

  const filename = `${dateStr}_${safeName}_${safeSubject}.txt`
  const filepath = join(INBOX_DIR, filename)

  const content = [
    `From: ${msg.from_name ? `${msg.from_name} <${msg.from_email}>` : msg.from_email}`,
    `Subject: ${msg.subject}`,
    `Date: ${date.toLocaleString()}`,
    ``,
    `---`,
    ``,
    msg.body_text || '(no text body)',
  ].join('\n')

  writeFileSync(filepath, content, 'utf-8')
  console.log(`  ${filename}`)
  ids.push(msg.id)
}

// Mark as read
if (ids.length > 0) {
  const { error: updateErr } = await svc
    .from('contact_messages')
    .update({ read: true })
    .in('id', ids)

  if (updateErr) {
    console.error('\n  Failed to mark as read:', updateErr.message)
  } else {
    console.log(`\n  Marked ${ids.length} message(s) as read.`)
  }
}

console.log(`  Files saved to: ${INBOX_DIR}\n`)
