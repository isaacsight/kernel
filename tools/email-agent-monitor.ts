#!/usr/bin/env npx tsx
// Email Agent Monitor — watches for new messages from Jae and ensures responses
// Run: npx tsx tools/email-agent-monitor.ts

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://eoxxpyixdieprsxlpwcs.supabase.co'
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

if (!SUPABASE_KEY) {
  // Try reading from .env
  const fs = await import('fs')
  const env = fs.readFileSync('.env', 'utf8')
  const match = env.match(/SUPABASE_SERVICE_KEY=(.+)/)
  if (match) {
    process.env.SUPABASE_SERVICE_ROLE_KEY = match[1].trim()
  }
}

const svc = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || SUPABASE_KEY)

console.log('Email Agent Monitor — watching for Jae\'s messages...')

let lastChecked = new Date().toISOString()

setInterval(async () => {
  try {
    // Check for new contact_messages from Jae that haven't been responded to
    const { data: newMessages } = await svc
      .from('contact_messages')
      .select('*')
      .eq('from_email', 'jhwang0321@gmail.com')
      .gt('created_at', lastChecked)
      .order('created_at', { ascending: true })

    if (newMessages && newMessages.length > 0) {
      for (const msg of newMessages) {
        console.log(`[${new Date().toISOString()}] New message from Jae: "${msg.subject}" - "${msg.body_text?.slice(0, 80)}"`)
        
        // Check if we already responded (look in agent_conversations)
        const { data: existing } = await svc
          .from('agent_conversations')
          .select('id')
          .eq('email', 'jhwang0321@gmail.com')
          .eq('role', 'user')
          .eq('content', msg.body_text)
          .limit(1)

        if (existing && existing.length > 0) {
          console.log('  Already processed, skipping')
          continue
        }

        // Trigger agent-reply
        console.log('  Triggering agent-reply...')
        const res = await fetch(`${SUPABASE_URL}/functions/v1/agent-reply`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({
            from_email: msg.from_email,
            from_name: msg.from_name,
            subject: msg.subject,
            body_text: msg.body_text,
          }),
        })

        if (res.ok) {
          const result = await res.json()
          console.log(`  Agent replied: "${result.reply?.slice(0, 100)}..."`)
        } else {
          console.error(`  Agent-reply failed: ${res.status} ${await res.text()}`)
        }
      }
      lastChecked = new Date().toISOString()
    }
  } catch (err) {
    console.error('Monitor error:', err)
  }
}, 15000) // Check every 15 seconds
