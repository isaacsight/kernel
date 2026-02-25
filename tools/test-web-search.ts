// Quick test for the web-search edge function (now using Claude API)
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
dotenv.config()

const url = process.env.VITE_SUPABASE_URL || ''
const anonKey = process.env.VITE_SUPABASE_KEY || ''
const serviceKey = process.env.SUPABASE_SERVICE_KEY || ''

async function main() {
  const admin = createClient(url, serviceKey)
  const client = createClient(url, anonKey)

  const { data: linkData } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: 'kain.na.studios@gmail.com',
  })
  if (!linkData) { console.error('Failed to generate link'); return }

  const { data: { session }, error } = await client.auth.verifyOtp({
    token_hash: linkData.properties.hashed_token,
    type: 'magiclink',
  })
  if (error || !session) { console.error('Auth failed:', error); return }
  console.log('Auth: OK')

  // Test web-search endpoint
  console.log('\n=== Testing web-search (Claude API) ===')
  const res = await fetch(`${url}/functions/v1/web-search`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
      apikey: anonKey,
    },
    body: JSON.stringify({ query: 'What is the latest Claude AI model in 2025?', max_tokens: 400 }),
  })

  console.log('Status:', res.status)
  const body = await res.json()

  if (res.ok) {
    console.log('Text:', body.text?.slice(0, 500))
    console.log('Citations:', body.citations)
  } else {
    console.error('Error:', body)
  }

  // Also test claude-proxy with web_search flag
  console.log('\n=== Testing claude-proxy with web_search=true ===')
  const proxyRes = await fetch(`${url}/functions/v1/claude-proxy`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
      apikey: anonKey,
    },
    body: JSON.stringify({
      mode: 'text',
      model: 'haiku',
      max_tokens: 400,
      web_search: true,
      messages: [{ role: 'user', content: 'What are the top 3 AI news stories today?' }],
    }),
  })

  console.log('Status:', proxyRes.status)
  const proxyBody = await proxyRes.json()

  if (proxyRes.ok) {
    console.log('Text:', proxyBody.text?.slice(0, 500))
  } else {
    console.error('Error:', proxyBody)
  }
}

main().catch(console.error)
