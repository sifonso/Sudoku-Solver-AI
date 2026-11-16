// Gemeinsame Helfer für Edge Functions: Aufrufer prüfen, Service-Client, JSON-Antworten.
import { createClient, type SupabaseClient, type User } from 'jsr:@supabase/supabase-js@2';

export const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
}

/** Client mit Service-Rolle. Umgeht RLS: jede Abfrage muss selbst auf den Aufrufer eingeschränkt sein. */
export function admin(): SupabaseClient {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Client im Namen des Aufrufers (RLS greift) und der geprüfte Nutzer. */
export async function caller(req: Request): Promise<{ user: User; db: SupabaseClient } | Response> {
  const header = req.headers.get('Authorization') ?? '';
  if (!header.startsWith('Bearer ')) return json({ error: 'not_authenticated' }, 401);
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: header } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await db.auth.getUser(header.slice(7));
  if (error || !data.user) return json({ error: 'not_authenticated' }, 401);
  return { user: data.user, db };
}
