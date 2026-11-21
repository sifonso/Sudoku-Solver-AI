// Dienstplan gegen Supabase (Tabellen dp_* und RPCs aus Migration 20261120120000_dienstplan).
import { ApiError } from '../data/api';
import { q, sharedClient } from '../data/supabase';
import type { DpComment, DpSettings, Staff, SwapOffer } from './model';
import { mergeSettings, type DpApi } from './store';

type Row = Record<string, any>;

function client() {
  const sb = sharedClient();
  if (!sb) throw new ApiError('network', 'Supabase nicht initialisiert');
  return sb;
}

const toStaff = (r: Row, priv: Map<string, Row>): Staff => ({
  short: '', firstName: '', lastName: '', nr: '', inPlan: false, isLead: false, teamLeadId: null,
  rhythm: [], quals: {}, phonePrivate: '', phoneMobile: '', whatsapp: '',
  ...r.data,
  id: r.id, sort: r.sort, memberId: r.member_id, persNr: priv.get(r.id)?.pers_nr ?? '', rules: priv.get(r.id)?.rules ?? undefined,
});

export function dpSupabase(): DpApi {
  return {
    async load(tenantId) {
      const sb = client();
      const [settings, staff, priv, carpools] = await Promise.all([
        q(sb.from('dp_settings').select('data').eq('tenant_id', tenantId).maybeSingle()),
        q(sb.from('dp_staff').select('id, member_id, sort, data').eq('tenant_id', tenantId).order('sort')),
        // Für Mitarbeitende liefert RLS hier keine Zeilen.
        q(sb.from('dp_staff_private').select('staff_id, pers_nr, rules').eq('tenant_id', tenantId)),
        q(sb.from('dp_carpools').select('name, members').eq('tenant_id', tenantId).order('name')),
      ]);
      const pn = new Map<string, Row>((priv as Row[]).map((p) => [p.staff_id, p]));
      return {
        settings: mergeSettings(settings?.data),
        staff: (staff as Row[]).map((r) => toStaff(r, pn)),
        carpools: (carpools as Row[]).map((c) => ({ name: c.name, members: c.members })),
      };
    },
    async entries(tenantId, from, to) {
      const rows: Row[] = [];
      // PostgREST liefert höchstens 1000 Zeilen je Abfrage; ein Monat mit 40 Personen liegt knapp darüber.
      for (let page = 0; ; page++) {
        const chunk = await q(client().from('dp_entries').select('staff_id, date, code, flex')
          .eq('tenant_id', tenantId).gte('date', from).lte('date', to)
          .order('date').order('staff_id').range(page * 1000, page * 1000 + 999));
        rows.push(...chunk);
        if (chunk.length < 1000) break;
      }
      return rows.map((r) => ({ staffId: r.staff_id, date: r.date, code: r.code, flex: r.flex }));
    },
    async setEntry(tenantId, e) {
      const t = client().from('dp_entries');
      if (!e.code && !e.flex) {
        await q(t.delete().eq('tenant_id', tenantId).eq('staff_id', e.staffId).eq('date', e.date));
      } else {
        await q(t.upsert({ tenant_id: tenantId, staff_id: e.staffId, date: e.date, code: e.code, flex: e.flex, updated_at: new Date().toISOString() }));
      }
    },
    async setEntries(tenantId, list) {
      const rows = list.map((e) => ({ tenant_id: tenantId, staff_id: e.staffId, date: e.date, code: e.code, flex: e.flex, updated_at: new Date().toISOString() }));
      for (let i = 0; i < rows.length; i += 500) await q(client().from('dp_entries').upsert(rows.slice(i, i + 500)));
    },
    async saveSettings(tenantId, s: DpSettings) {
      await q(client().from('dp_settings').upsert({ tenant_id: tenantId, data: s, updated_at: new Date().toISOString() }));
    },
    async saveStaff(tenantId, s) {
      const { id, sort, memberId, persNr, rules, ...data } = s;
      await q(client().from('dp_staff').upsert({ tenant_id: tenantId, id, sort, member_id: memberId ?? null, data, updated_at: new Date().toISOString() }));
      await q(client().from('dp_staff_private').upsert({ tenant_id: tenantId, staff_id: id, pers_nr: persNr ?? '', rules: rules ?? {} }));
    },
    async swaps(tenantId) {
      const rows: Row[] = await q(client().from('dp_swaps')
        .select('id, staff_id, date, code, note, status, accepted_request, decided_by, created_at, kind, legs, accepted, created_by_lead, created_by_name, dp_swap_requests(id, staff_id, return_date, at)')
        .eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(200));
      return rows.map((r): SwapOffer => ({
        id: r.id, staffId: r.staff_id, date: r.date ?? '', code: r.code, note: r.note, status: r.status,
        acceptedRequestId: r.accepted_request, decidedBy: r.decided_by, createdAt: r.created_at,
        kind: r.kind, legs: r.legs ?? [], accepted: r.accepted ?? [], createdByLead: r.created_by_lead, createdByName: r.created_by_name,
        requests: (r.dp_swap_requests ?? []).map((x: Row) => ({ id: x.id, staffId: x.staff_id, returnDate: x.return_date, at: x.at })),
      }));
    },
    async offerSwap(tenantId, { staffId, date, note }, actor) {
      await q(client().rpc('dp_offer_swap', { p_tenant: tenantId, p_date: date, p_note: note, p_staff: staffId === actor.staffId ? null : staffId }));
    },
    async proposeSwap(tenantId, { legs, note }) {
      await q(client().rpc('dp_propose_swap', { p_tenant: tenantId, p_legs: legs.map((l) => ({ staffId: l.staffId, date: l.date })), p_note: note }));
    },
    async respondProposal(_t, id, _staffId, agree) {
      await q(client().rpc('dp_respond_proposal', { p_swap: id, p_agree: agree }));
    },
    async requestSwap(_t, id, { returnDate }) {
      await q(client().rpc('dp_request_swap', { p_swap: id, p_return_date: returnDate }));
    },
    async withdrawRequest(_t, id) {
      await q(client().rpc('dp_withdraw_request', { p_swap: id }));
    },
    async acceptRequest(_t, id, requestId) {
      await q(client().rpc('dp_accept_request', { p_swap: id, p_request: requestId }));
    },
    async decideSwap(_t, id, approve) {
      await q(client().rpc('dp_decide_swap', { p_swap: id, p_approve: approve }));
    },
    async cancelSwap(_t, id) {
      await q(client().rpc('dp_cancel_swap', { p_swap: id }));
    },
    async comments(tenantId, from, to) {
      const rows: Row[] = await q(client().from('dp_comments').select('*').eq('tenant_id', tenantId).gte('date', from).lte('date', to).order('created_at'));
      return rows.map((r): DpComment => ({
        id: r.id, staffId: r.staff_id, date: r.date, text: r.text, mark: r.mark, authorMemberId: r.author_member_id,
        authorName: r.author_name, authorIsLead: r.author_is_lead, createdAt: r.created_at, updatedAt: r.updated_at,
      }));
    },
    async addComment(tenantId, { staffId, date, text, mark }, actor) {
      await q(client().from('dp_comments').insert({ tenant_id: tenantId, staff_id: staffId, date, text, mark,
        author_member_id: actor.memberId, author_name: actor.name, author_is_lead: actor.isLead }));
    },
    async updateComment(_t, id, { text, mark }) {
      const rows = await q(client().from('dp_comments').update({ text, mark }).eq('id', id).select('id'));
      if (!rows?.length) throw new ApiError('forbidden');
    },
    async deleteComment(_t, id) {
      const rows = await q(client().from('dp_comments').delete().eq('id', id).select('id'));
      if (!rows?.length) throw new ApiError('forbidden');
    },
  };
}
