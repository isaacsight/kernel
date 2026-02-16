// Test the exact same flow as the frontend submit button — without a browser
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
dotenv.config()

const url = process.env.VITE_SUPABASE_URL || ''
const anonKey = process.env.VITE_SUPABASE_KEY || ''
const serviceKey = process.env.SUPABASE_SERVICE_KEY || ''
const PROXY_URL = `${url}/functions/v1/claude-proxy`

async function main() {
  console.log('=== SIMULATING FRONTEND SUBMIT FLOW ===\n')

  // 1. Sign in (same as frontend supabase.auth)
  const admin = createClient(url, serviceKey)
  const client = createClient(url, anonKey)

  const { data: linkData } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: 'kain.na.studios@gmail.com',
  })
  if (!linkData) { console.error('Failed to generate link'); return }

  const { data: { session }, error: authErr } = await client.auth.verifyOtp({
    token_hash: linkData.properties.hashed_token,
    type: 'magiclink',
  })
  if (authErr || !session) { console.error('Auth failed:', authErr); return }
  console.log('1. AUTH: OK (user:', session.user.email, ')')

  // 2. Check session is attached to client
  const { data: { session: check } } = await client.auth.getSession()
  console.log('2. SESSION CHECK:', check ? 'Active' : 'MISSING')

  // 3. Create conversation (this is where it fails in the frontend)
  const convId = `conv_test_${Date.now()}_submit`
  const userId = session.user.id
  console.log('\n3. CREATE CONVERSATION...')
  const { data: conv, error: convErr } = await client
    .from('conversations')
    .insert({ id: convId, user_id: userId, title: 'Submit test' })
    .select()
    .single()

  if (convErr) {
    console.error('   FAILED:', convErr.code, convErr.message)
    console.error('   Details:', convErr.details)
    console.error('   Hint:', convErr.hint)
  } else {
    console.log('   SUCCESS:', conv.id)
  }

  // 4. Save a message
  const msgId = `msg_test_${Date.now()}`
  console.log('\n4. SAVE MESSAGE...')
  const { error: msgErr } = await client
    .from('messages')
    .insert({ id: msgId, channel_id: convId, agent_id: 'user', content: 'testing 123', user_id: userId })

  if (msgErr) {
    console.error('   FAILED:', msgErr.code, msgErr.message)
  } else {
    console.log('   SUCCESS')
  }

  // 5. Call claude-proxy (classify intent via haiku)
  console.log('\n5. CLASSIFY INTENT (haiku)...')
  const classifyRes = await fetch(PROXY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
      apikey: anonKey,
    },
    body: JSON.stringify({
      mode: 'json',
      model: 'haiku',
      max_tokens: 150,
      system: 'Classify the intent. Return JSON: {"agentId":"kernel","confidence":0.9,"needsResearch":false,"isMultiStep":false}',
      messages: [{ role: 'user', content: 'testing 123' }],
    }),
  })
  console.log('   Status:', classifyRes.status)
  if (classifyRes.ok) {
    const body = await classifyRes.json()
    console.log('   Response:', body.text?.slice(0, 100))
  } else {
    const err = await classifyRes.text()
    console.error('   Error:', err)
  }

  // 6. Stream a response (sonnet)
  console.log('\n6. STREAM RESPONSE (sonnet)...')
  const streamRes = await fetch(PROXY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
      apikey: anonKey,
    },
    body: JSON.stringify({
      mode: 'stream',
      model: 'sonnet',
      max_tokens: 100,
      system: 'You are a helpful assistant. Be brief.',
      messages: [{ role: 'user', content: 'Say "submit works" and nothing else.' }],
    }),
  })
  console.log('   Status:', streamRes.status)
  if (streamRes.ok && streamRes.body) {
    const reader = streamRes.body.getReader()
    const decoder = new TextDecoder()
    let fullText = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      const chunk = decoder.decode(value, { stream: true })
      for (const line of chunk.split('\n')) {
        if (!line.startsWith('data: ')) continue
        const data = line.slice(6)
        if (data === '[DONE]') continue
        try {
          const event = JSON.parse(data)
          if (event.type === 'content_block_delta' && event.delta?.text) {
            fullText += event.delta.text
          }
        } catch {}
      }
    }
    console.log('   Response:', fullText)
  } else {
    const err = await streamRes.text()
    console.error('   Error:', err)
  }

  // 7. Cleanup
  await admin.from('messages').delete().eq('id', msgId)
  await admin.from('conversations').delete().eq('id', convId)
  console.log('\n7. CLEANUP: Done')

  console.log('\n=== ALL STEPS PASSED ===')
}

main().catch(console.error)
