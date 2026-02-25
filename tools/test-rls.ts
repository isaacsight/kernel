// Test RLS: sign in as a user and try to create a conversation
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const url = process.env.VITE_SUPABASE_URL || '';
const anonKey = process.env.VITE_SUPABASE_KEY || '';
const serviceKey = process.env.SUPABASE_SERVICE_KEY || '';

async function main() {
  // 1. Get a real user from the DB
  const admin = createClient(url, serviceKey);
  const { data: users } = await admin.auth.admin.listUsers();
  const user = users?.users?.[0];
  if (!user) { console.error('No users found'); return; }
  console.log('Test user:', user.email, user.id);

  // 2. Generate a magic link / session for this user
  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: user.email!,
  });
  if (linkErr) { console.error('Link error:', linkErr); return; }

  // 3. Verify the OTP to get a session
  const token = new URL(linkData.properties.action_link).searchParams.get('token') || '';
  const hash = new URL(linkData.properties.action_link).hash;

  // Use anon client to verify
  const client = createClient(url, anonKey);
  const { data: verifyData, error: verifyErr } = await client.auth.verifyOtp({
    token_hash: linkData.properties.hashed_token,
    type: 'magiclink',
  });
  if (verifyErr) { console.error('Verify error:', verifyErr); return; }
  console.log('Session:', verifyData.session ? 'OK' : 'MISSING');
  console.log('User ID from session:', verifyData.session?.user?.id);

  // 4. Now try to create a conversation (this is what the frontend does)
  const convId = `test_rls_${Date.now()}`;
  const { data: conv, error: convErr } = await client
    .from('conversations')
    .insert({ id: convId, user_id: user.id, title: 'RLS test conversation' })
    .select()
    .single();

  if (convErr) {
    console.error('CREATE CONVERSATION FAILED:', convErr.code, convErr.message, convErr.details);
  } else {
    console.log('CREATE CONVERSATION SUCCESS:', conv.id, conv.title);
    // Clean up
    await admin.from('conversations').delete().eq('id', convId);
    console.log('Cleaned up test conversation');
  }

  // 5. Also test message insert
  if (conv) {
    const msgId = `msg_test_${Date.now()}`;
    const { error: msgErr } = await client
      .from('messages')
      .insert({ id: msgId, channel_id: convId, agent_id: 'user', content: 'test', user_id: user.id });
    if (msgErr) {
      console.error('MESSAGE INSERT FAILED:', msgErr.code, msgErr.message);
    } else {
      console.log('MESSAGE INSERT SUCCESS');
      await admin.from('messages').delete().eq('id', msgId);
    }
  }
}

main().catch(console.error);
