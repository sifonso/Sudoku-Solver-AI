// Eintrag eines Tages bearbeiten (FK4/SL) oder ansehen und zum Tausch anbieten (alle).
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { errorText } from '../features/errors';
import { Banner, Button, Checkbox, Text } from '../ui';
import { useSetEntry } from './hooks';
import { MONTHS, WEEKDAYS, displayName, groupOf, holidayOf, isWork, parseCode, parseIso, shiftTime, type Cell, type DpSettings, type Staff } from './model';
import { CodeBadge, PickChips, Sheet } from './ui';

export function EntryEditor({ open, staff, date, cell, settings, canEdit, isMe, onClose }: {
  open: boolean; staff: Staff | null; date: string | null; cell: Cell | null; settings: DpSettings;
  canEdit: boolean; isMe: boolean; onClose: () => void;
}) {
  const save = useSetEntry();
  const [wp, setWp] = useState<string | null>(null);
  const [shift, setShift] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [flex, setFlex] = useState(false);

  useEffect(() => {
    if (!cell) return;
    const p = parseCode(cell.fromRhythm ? '' : cell.code, settings);
    setWp(p.workplace);
    setShift(p.shift ?? (cell.fromRhythm ? baseToShift(cell.base) : null));
    setStatus(p.status?.code ?? null);
    setFlex(cell.flex);
    save.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cell, staff?.id, date]);

  if (!staff || !date || !cell) return null;
  const d = parseIso(date);
  const title = `${staff.short} · ${WEEKDAYS[d.getDay()]}, ${d.getDate()}. ${MONTHS[d.getMonth()]}`;
  const code = status ?? (shift ? (wp ? `${wp}/${shift}` : shift) : '');
  const time = shiftTime(code, settings);
  const shiftsForWp = settings.shifts.filter((s) => !wp || s.times[wp]);
  const submit = (next: { code: string; flex: boolean }) =>
    save.mutate({ staffId: staff.id, date, ...next }, { onSuccess: onClose });

  return (
    <Sheet visible={open} title={title} onClose={onClose}>
      <View style={styles.now}>
        <CodeBadge code={cell.code} settings={settings} />
        <View style={{ flex: 1 }}>
          <Text variant="sm">{describe(cell, settings)}</Text>
          {cell.base ? <Text variant="xs" color="textMuted">Grundrhythmus: {cell.base}</Text> : <Text variant="xs" color="textMuted">Grundrhythmus: frei</Text>}
          {holidayOf(date) ? <Text variant="xs" color="textMuted">Feiertag: {holidayOf(date)}</Text> : null}
        </View>
      </View>

      {canEdit ? (
        <>
          <PickChips label="Arbeitsplatz" value={wp} onChange={(v) => { setWp(v); setStatus(null); }}
            options={settings.workplaces.map((w) => ({ value: w.code, label: w.name }))} />
          <PickChips label="Schicht" value={status ? null : shift} onChange={(v) => { setShift(v); setStatus(null); }}
            options={shiftsForWp.map((s) => ({ value: s.code, label: [s.code, wp ? s.times[wp] : ''].filter(Boolean).join(' ') }))} />
          {wp ? <Button label="Ohne Arbeitsplatz" size="sm" variant="ghost" onPress={() => setWp(null)} /> : null}
          <PickChips label="Abwesenheit und Sonstiges" value={status} onChange={(v) => setStatus(v === status ? null : v)}
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
            <Button label="Auf Rhythmus zurücksetzen" variant="secondary" onPress={() => submit({ code: '', flex: false })} disabled={!cell.entry} />
            <Button label="Frei (DT)" variant="ghost" onPress={() => submit({ code: 'DT', flex: false })} />
          </View>
        </>
      ) : null}

      {isMe && isWork(cell.code, settings) ? (
        <Button label="Diesen Dienst in der Tauschbörse anbieten" variant={canEdit ? 'secondary' : 'primary'}
          onPress={() => { onClose(); router.push({ pathname: '/tausch', params: { offer: date } }); }} />
      ) : null}
      {!canEdit && !isMe ? <Text variant="sm" color="textMuted">{displayName(staff)}</Text> : null}
    </Sheet>
  );
}

function baseToShift(base: string): string | null {
  if (!base) return null;
  if (base === 'S/N' || base === 'M/S' || base === 'M/F') return base.split('/')[0] ?? null;
  return base;
}

export function describe(cell: Cell, s: DpSettings): string {
  if (!cell.code) return 'Frei';
  const p = parseCode(cell.code, s);
  if (p.status) return p.status.label;
  const time = shiftTime(cell.code, s);
  const g = groupOf(p.shift, s);
  const name = { F: 'Frühdienst', M: 'Mitteldienst', S: 'Spätdienst', N: 'Nachtdienst' }[g ?? 'F'];
  const where = p.workplace ? ` am Arbeitsplatz ${p.workplace}` : cell.fromRhythm ? ', laut Rhythmus, noch ohne Arbeitsplatz' : ', ohne Arbeitsplatz';
  return `${g ? name : cell.code}${where}${time ? ` · ${time}` : ''}`;
}

const styles = StyleSheet.create({
  now: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  preview: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
