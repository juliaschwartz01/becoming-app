// Shared helpers for Becoming's Edge Functions (Deno runtime on Supabase).
import { createClient } from 'npm:@supabase/supabase-js@2'

export const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

/** Rejects requests that don't come from the signed-in owner of this project. */
export async function requireUser(req: Request) {
  const auth = req.headers.get('Authorization')
  if (!auth) throw new Response('Unauthorized', { status: 401, headers: cors })
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } })
  const { data, error } = await sb.auth.getUser()
  if (error || !data.user) throw new Response('Unauthorized', { status: 401, headers: cors })
  return data.user
}

export const notConfigured = (what: string) =>
  json({ error: 'not_configured', message: `${what} has not been connected. No provider is configured, so nothing was generated.` }, 503)
