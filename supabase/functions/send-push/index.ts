// Push für neue Benachrichtigungen über den Expo Push Service (APNs/FCM).
// Aufruf: Database Webhook auf INSERT in public.notifications (siehe replica/backend.md),
// zusätzlich jede Minute per pg_cron für Liegengebliebene ({"sweep": true}).
// Geschützt über ein eigenes Geheimnis im Header x-webhook-secret (PUSH_WEBHOOK_SECRET).
import { admin, json } from '../_shared/auth.ts';

const EXPO_PUSH = 'https://exp.host/--/api/v2/push/send';

type Notification = { id: string; member_id: string; title: string; body: string | null; data: Record<string, unknown> };

Deno.serve(async (req) => {
  const secret = Deno.env.get('PUSH_WEBHOOK_SECRET');
  if (!secret || req.headers.get('x-webhook-secret') !== secret) return json({ error: 'forbidden' }, 403);
  const payload = await req.json().catch(() => ({}));
  const db = admin();

  let rows: Notification[] = [];
  if (payload?.record?.id) {
    rows = [payload.record as Notification];
  } else if (payload?.sweep) {
    const { data } = await db.from('notifications').select('id, member_id, title, body, data')
      .is('pushed_at', null).gt('created_at', new Date(Date.now() - 3_600_000).toISOString()).limit(200);
    rows = (data ?? []) as Notification[];
  }
  if (!rows.length) return json({ sent: 0 });

  // Einstellungen + Geräte der Empfänger
  const memberIds = [...new Set(rows.map((r) => r.member_id))];
  const { data: members } = await db.from('members').select('id, user_id').in('id', memberIds);
  const userIds = (members ?? []).map((m) => m.user_id).filter(Boolean);
  const { data: tokens } = userIds.length
    ? await db.from('device_tokens').select('user_id, expo_push_token').in('user_id', userIds)
    : { data: [] };
  const { data: prefs } = await db.from('notification_preferences').select('member_id, type, push').in('member_id', memberIds);

  const messages: { to: string; title: string; body?: string; data: Record<string, unknown>; sound: 'default' }[] = [];
  const sentIds: string[] = [];
  for (const n of rows) {
    // Atomar beanspruchen: nur wer pushed_at von null auf jetzt setzt, verschickt (Webhook + Sweep doppelt).
    const { data: claimed } = await db.from('notifications').update({ pushed_at: new Date().toISOString() })
      .eq('id', n.id).is('pushed_at', null).select('id, type');
    if (!claimed?.length) continue;
    const type = claimed[0].type as string;
    if ((prefs ?? []).some((p) => p.member_id === n.member_id && p.type === type && p.push === false)) continue;
    const userId = (members ?? []).find((m) => m.id === n.member_id)?.user_id;
    for (const t of (tokens ?? []).filter((t) => t.user_id === userId)) {
      messages.push({ to: t.expo_push_token, title: n.title, body: n.body ?? undefined, data: { ...n.data, notification_id: n.id }, sound: 'default' });
    }
    sentIds.push(n.id);
  }

  let invalid = 0;
  for (let i = 0; i < messages.length; i += 100) {
    const chunk = messages.slice(i, i + 100);
    const res = await fetch(EXPO_PUSH, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(chunk),
    });
    const out = await res.json().catch(() => ({ data: [] }));
    // Abgemeldete Geräte entfernen
    for (const [j, ticket] of ((out.data ?? []) as { status: string; details?: { error?: string } }[]).entries()) {
      if (ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered') {
        await db.from('device_tokens').delete().eq('expo_push_token', chunk[j]!.to);
        invalid++;
      }
    }
  }
  return json({ notifications: sentIds.length, messages: messages.length, removed_tokens: invalid });
});
