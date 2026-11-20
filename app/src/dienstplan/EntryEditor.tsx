// Tag einer Person: ansehen, kommentieren/markieren, tauschen; FK4/SL ändert den Dienst.
import { router } from 'expo-router';
import { Pencil, Trash2 } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { errorText } from '../features/errors';
import { useTheme } from '../theme';
import { Banner, Button, Checkbox, IconButton, Text, TextField } from '../ui';
import { dp as dpApi, useActor, useCommentAction, useSetEntry } from './hooks';
import {
  GROUP_NAMES, MARK_COLORS, MONTHS, WEEKDAYS, displayName, groupOf, holidayOf, isWork, parseCode, parseIso, shiftTime,
  type Cell, type DpComment, type DpSettings, type ShiftGroup, type Staff,
} from './model';
import { canEditComment } from './store';
import { CodeBadge, PickChips, Sheet } from './ui';

const GROUPS: ShiftGroup[] = ['F', 'M', 'S', 'N'];

export function EntryEditor({ open, staff, date, cell, settings, canEdit, isMe, comments, onClose, onSwap }: {
  open: boolean; staff: Staff | null; date: string | null; cell: Cell | null; settings: DpSettings;
  canEdit: boolean; isMe: boolean; comments: DpComment[]; onClose: () => void;
  /** Tauschvorschlag mit diesem Tag öffnen */
  onSwap?: () => void;
}) {
  const { c } = useTheme();
  const save = useSetEntry();
  const [code, setCode] = useState('');
  const [flex, setFlex] = useState(false);

  useEffect(() => {
    if (!cell) return;
    setCode(cell.source === 'entry' ? cell.code : '');
    setFlex(cell.flex);
    save.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cell, staff?.id, date]);

  if (!staff || !date || !cell) return null;
  const d = parseIso(date);
  const title = `${staff.short} · ${WEEKDAYS[d.getDay()]}, ${d.getDate()}. ${MONTHS[d.getMonth()]}`;
  const time = shiftTime(code, settings);
  const submit = (next: { code: string; flex: boolean }) => save.mutate({ staffId: staff.id, date, ...next }, { onSuccess: onClose });
  const parsed = parseCode(code, settings);
  const detail = settings.detailShifts ? settings.shifts.filter((s) => !parsed.workplace || s.times[parsed.workplace]) : [];

  return (
    <Sheet visible={open} title={title} onClose={onClose}>
      <View style={styles.now}>
        <CodeBadge code={cell.code} settings={settings} />
        <View style={{ flex: 1 }}>
          <Text variant="sm">{describe(cell, settings)}</Text>
          <Text variant="xs" color="textMuted">
            {cell.temp ? `Vorübergehender Turnus bis ${cell.temp.to.slice(8)}.${cell.temp.to.slice(5, 7)}.${cell.temp.note ? ` (${cell.temp.note})` : ''}` : `Grundturnus: ${cell.base || 'frei'}`}
          </Text>
          {holidayOf(date) ? <Text variant="xs" color="textMuted">Feiertag: {holidayOf(date)}</Text> : null}
        </View>
      </View>

      {canEdit ? (
        <View style={styles.block}>
          <Text variant="label" color="textMuted">Dienst ändern</Text>
          {settings.workplaces.map((w) => (
            <View key={w.code} style={styles.presetRow}>
              <Text variant="sm" style={[styles.wp, styles.bold]}>{w.code}</Text>
              <View style={styles.chips}>
                {(settings.presets[w.code] ?? []).map((g) => (
                  <Chip key={g} label={`${w.code}/${g}`} on={code === `${w.code}/${g}`} onPress={() => setCode(`${w.code}/${g}`)} />
                ))}
              </View>
            </View>
          ))}
          <View style={styles.presetRow}>
            <Text variant="sm" style={[styles.wp, styles.bold]}>ohne</Text>
            <View style={styles.chips}>
              {GROUPS.map((g) => <Chip key={g} label={g} hint={GROUP_NAMES[g]} on={code === g} onPress={() => setCode(g)} />)}
            </View>
          </View>
          {detail.length ? (
            <PickChips label="Feinschicht" value={parsed.shift} onChange={(v) => setCode(parsed.workplace ? `${parsed.workplace}/${v}` : v)}
              options={detail.map((s) => ({ value: s.code, label: s.code }))} />
          ) : null}
          <PickChips label="Abwesenheit und Sonstiges" value={parsed.status?.code ?? null} onChange={(v) => setCode(v)}
            options={settings.codes.map((s) => ({ value: s.code, label: s.label, bg: s.bg, fg: s.fg }))} />
          <Checkbox label="FLEX" checked={flex} onChange={setFlex} />
          <View style={styles.preview}>
            <Text variant="sm" color="textMuted">Neu:</Text>
            <CodeBadge code={code} settings={settings} />
            {time ? <Text variant="sm" color="textMuted">{time}</Text> : null}
          </View>
          {save.isError ? <Banner tone="danger" title={errorText(save.error)} /> : null}
          <View style={styles.actions}>
            <Button label="Speichern" onPress={() => submit({ code, flex })} loading={save.isPending} disabled={!code && !flex} />
            <Button label="Auf Turnus zurücksetzen" variant="secondary" onPress={() => submit({ code: '', flex: false })} disabled={!cell.entry} />
            <Button label="Frei (DT)" variant="ghost" onPress={() => submit({ code: 'DT', flex: false })} />
          </View>
        </View>
      ) : null}

      <View style={styles.actions}>
        {isMe && isWork(cell.code, settings) ? (
          <Button label="In Tauschbörse anbieten" variant="secondary"
            onPress={() => { onClose(); router.push({ pathname: '/tausch', params: { offer: date } }); }} />
        ) : null}
        {canEdit && !isMe && isWork(cell.code, settings) ? (
          <Button label={`Für ${staff.short} anbieten`} variant="secondary"
            onPress={() => { onClose(); router.push({ pathname: '/tausch', params: { offer: date, for: staff.id } }); }} />
        ) : null}
        {onSwap ? <Button label={isMe ? 'Tausch vorschlagen' : canEdit ? 'Tausch anlegen' : `Mit ${staff.short} tauschen`} variant="secondary" onPress={onSwap} /> : null}
      </View>

      <Comments staffId={staff.id} date={date} comments={comments} />
      {!canEdit && !isMe ? <Text variant="xs" color="textMuted">{displayName(staff)}</Text> : null}
    </Sheet>
  );
}

function Chip({ label, hint, on, onPress }: { label: string; hint?: string; on: boolean; onPress: () => void }) {
  const { c } = useTheme();
  return (
    <Pressable accessibilityRole="radio" aria-checked={on} accessibilityLabel={hint ? `${label} ${hint}` : label} onPress={onPress}
      style={[styles.chip, { backgroundColor: on ? c.accent : c.surface, borderColor: on ? c.highlight : c.border, borderWidth: on ? 2 : 1 }]}>
      <Text variant="sm" color={on ? 'onAccent' : 'text'} style={styles.bold}>{label}</Text>
    </Pressable>
  );
}

/** Kommentare und Markierungen für alle; ändern/löschen nur Verfasser:in, bei FK4/SL-Einträgen alle FK4/SL. */
function Comments({ staffId, date, comments }: { staffId: string; date: string; comments: DpComment[] }) {
  const { c } = useTheme();
  const actor = useActor();
  const [text, setText] = useState('');
  const [mark, setMark] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const add = useCommentAction((t, v: { staffId: string; date: string; text: string; mark: string }, a) => dpApi.addComment(t, v, a));
  const upd = useCommentAction((t, v: { id: string; text: string; mark: string }, a) => dpApi.updateComment(t, v.id, v, a));
  const del = useCommentAction((t, id: string, a) => dpApi.deleteComment(t, id, a));
  const err = add.error ?? upd.error ?? del.error;
  const reset = () => { setText(''); setMark(''); setEditing(null); };
  const submit = () => {
    if (editing) upd.mutate({ id: editing, text, mark }, { onSuccess: reset });
    else add.mutate({ staffId, date, text, mark }, { onSuccess: reset });
  };
  return (
    <View style={styles.block}>
      <Text variant="label" color="textMuted">Kommentare und Markierung</Text>
      {comments.length === 0 ? <Text variant="sm" color="textMuted">Noch nichts vermerkt.</Text> : null}
      {comments.map((cm) => (
        <View key={cm.id} style={[styles.comment, { borderLeftColor: cm.mark || c.border, backgroundColor: c.surface }]}>
          <View style={{ flex: 1 }}>
            {cm.text ? <Text variant="sm">{cm.text}</Text> : <Text variant="sm" color="textMuted">Markiert</Text>}
            <Text variant="xs" color="textMuted">{cm.authorName}{cm.authorIsLead ? ' (FK4 / SL)' : ''} · {new Date(cm.updatedAt ?? cm.createdAt).toLocaleDateString('de-DE')}{cm.updatedAt ? ' · bearbeitet' : ''}</Text>
          </View>
          {canEditComment(cm, actor) ? (
            <>
              <IconButton icon={Pencil} label="Kommentar bearbeiten" onPress={() => { setEditing(cm.id); setText(cm.text); setMark(cm.mark); }} />
              <IconButton icon={Trash2} label="Kommentar löschen" onPress={() => del.mutate(cm.id)} />
            </>
          ) : null}
        </View>
      ))}
      <TextField label={editing ? 'Kommentar bearbeiten' : 'Neuer Kommentar'} value={text} onChangeText={setText} maxLength={1000} multiline />
      <View style={styles.marks} accessibilityRole="radiogroup" accessibilityLabel="Markierung">
        <Text variant="sm" color="textMuted">Markierung:</Text>
        {['', ...MARK_COLORS].map((m) => (
          <Pressable key={m || 'none'} accessibilityRole="radio" aria-checked={mark === m} accessibilityLabel={m ? `Markierung ${m}` : 'Keine Markierung'}
            onPress={() => setMark(m)}
            style={[styles.swatch, { backgroundColor: m || c.bg, borderColor: mark === m ? c.highlight : c.border, borderWidth: mark === m ? 3 : 1 }]} />
        ))}
      </View>
      {err ? <Banner tone="danger" title={errorText(err)} /> : null}
      <View style={styles.actions}>
        <Button label={editing ? 'Änderung speichern' : 'Hinzufügen'} size="sm" disabled={!text.trim() && !mark} loading={add.isPending || upd.isPending} onPress={submit} />
        {editing ? <Button label="Abbrechen" size="sm" variant="ghost" onPress={reset} /> : null}
      </View>
    </View>
  );
}

export function describe(cell: Cell, s: DpSettings): string {
  if (!cell.code) return 'Frei';
  const p = parseCode(cell.code, s);
  if (p.status) return p.status.label;
  const time = shiftTime(cell.code, s);
  const g = groupOf(p.shift, s);
  const where = p.workplace ? ` am Arbeitsplatz ${p.workplace}` : cell.source === 'rhythm' ? ', laut Turnus, noch ohne Arbeitsplatz' : ', ohne Arbeitsplatz';
  return `${g ? GROUP_NAMES[g] : cell.code}${where}${time ? ` · ${time}` : ''}`;
}

const styles = StyleSheet.create({
  now: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  block: { gap: 10 },
  presetRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  wp: { width: 44 },
  chips: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { minWidth: 52, minHeight: 40, paddingHorizontal: 8, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  preview: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  bold: { fontFamily: 'Inter_600SemiBold' },
  comment: { flexDirection: 'row', alignItems: 'center', gap: 4, borderLeftWidth: 4, borderRadius: 6, paddingLeft: 10, paddingVertical: 6 },
  marks: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  swatch: { width: 30, height: 30, borderRadius: 15 },
});
