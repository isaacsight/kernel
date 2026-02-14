// Temporary edge function to run the migration SQL from inside Supabase's network.
// Delete after use.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Test if tables already exist by trying to select from them
    const { error: testError1 } = await supabase
      .from('evaluation_conversations')
      .select('id')
      .limit(1)

    const { error: testError2 } = await supabase
      .from('agent_insights')
      .select('id')
      .limit(1)

    if (!testError1 && !testError2) {
      return new Response(
        JSON.stringify({ ok: true, message: 'Tables already exist' }),
        { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
      )
    }

    // Tables don't exist yet — we need raw SQL.
    // Use the Supabase Management API from inside the function.
    // Alternative: use the postgres connection directly via Deno.
    const dbUrl = Deno.env.get('SUPABASE_DB_URL')

    if (!dbUrl) {
      return new Response(
        JSON.stringify({
          ok: false,
          message: 'SUPABASE_DB_URL not available. Tables need to be created manually.',
          tables_missing: {
            evaluation_conversations: !!testError1,
            agent_insights: !!testError2,
          },
          errors: {
            evaluation_conversations: testError1?.message,
            agent_insights: testError2?.message,
          }
        }),
        { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
      )
    }

    // Connect via Deno's built-in postgres
    const { Client } = await import('https://deno.land/x/postgres@v0.19.3/mod.ts')
    const client = new Client(dbUrl)
    await client.connect()

    await client.queryObject(`
      create table if not exists evaluation_conversations (
        id text primary key,
        email text,
        messages jsonb not null,
        evaluation_result jsonb,
        project_type text,
        tier text,
        score integer,
        converted boolean default false,
        created_at timestamptz default now()
      );

      alter table evaluation_conversations enable row level security;

      DO $$ BEGIN
        create policy "Allow anonymous inserts on eval_conversations" on evaluation_conversations for insert with check (true);
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;

      DO $$ BEGIN
        create policy "Allow anonymous reads on eval_conversations" on evaluation_conversations for select using (true);
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;

      create index if not exists idx_eval_conversations_email on evaluation_conversations (email);
      create index if not exists idx_eval_conversations_created on evaluation_conversations (created_at desc);

      create table if not exists agent_insights (
        id text primary key,
        insight text not null,
        category text,
        source_conversation_id text references evaluation_conversations(id),
        times_used integer default 0,
        created_at timestamptz default now()
      );

      alter table agent_insights enable row level security;

      DO $$ BEGIN
        create policy "Allow anonymous inserts on agent_insights" on agent_insights for insert with check (true);
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;

      DO $$ BEGIN
        create policy "Allow anonymous reads on agent_insights" on agent_insights for select using (true);
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;

      DO $$ BEGIN
        create policy "Allow anonymous updates on agent_insights" on agent_insights for update using (true);
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;

      create index if not exists idx_agent_insights_created on agent_insights (created_at desc);
      create index if not exists idx_agent_insights_category on agent_insights (category);
    `)

    await client.end()

    return new Response(
      JSON.stringify({ ok: true, message: 'Migration complete — both tables created' }),
      { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
    )
  } catch (error) {
    console.error('Migration error:', error)
    return new Response(
      JSON.stringify({ ok: false, error: String(error) }),
      { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
    )
  }
})
