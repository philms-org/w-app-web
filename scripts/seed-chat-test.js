/* Seed two QA test users + a conversation for ChatView smoke test. */
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const PASS = 'WappChat!test42';
const A = 'chat.test.a@wapp-qa.dev';
const B = 'chat.test.b@wapp-qa.dev';

async function ensureUser(email, name) {
  const c = createClient(url, anon);
  let { data, error } = await c.auth.signInWithPassword({ email, password: PASS });
  if (error) {
    ({ data, error } = await c.auth.signUp({ email, password: PASS }));
    if (error) throw new Error(`signup ${email}: ${error.message}`);
    if (!data.session) throw new Error(`no session for ${email} (email confirm required?)`);
  }
  const uid = data.user.id;
  const { error: pErr } = await c.from('profiles').upsert({ id: uid, display_name: name });
  if (pErr) console.log(`profile upsert ${email}: ${pErr.message}`);
  return { client: c, uid };
}

(async () => {
  const a = await ensureUser(A, 'Chat Tester A');
  const b = await ensureUser(B, 'Chat Tester B');
  console.log('A uid:', a.uid, '\nB uid:', b.uid);

  // A starts a conversation with B (mirrors lib/data.ts startConversation)
  const { data: conv, error: cErr } = await a.client
    .from('conversations')
    .insert({ is_group: false, name: null, created_by: a.uid })
    .select()
    .single();
  if (cErr) throw new Error(`conversation insert (migration 0004 check!): ${cErr.message} [${cErr.code}]`);
  console.log('conversation:', conv.id);

  const { error: partErr } = await a.client.from('conversation_participants').insert([
    { conversation_id: conv.id, user_id: a.uid, status: 'accepted' },
    { conversation_id: conv.id, user_id: b.uid, status: 'accepted' },
  ]);
  if (partErr) throw new Error(`participants: ${partErr.message}`);

  const { error: mErr } = await a.client
    .from('messages')
    .insert({ conversation_id: conv.id, sender_id: a.uid, content: 'Hey! First message from A 👋' });
  if (mErr) throw new Error(`message: ${mErr.message}`);
  console.log('Seeded OK. Log in as', B, 'to see the conversation.');
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
