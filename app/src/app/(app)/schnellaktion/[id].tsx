import { useLocalSearchParams } from 'expo-router';
import { Check, FileX } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useMembers, useQuickActions, useQuickEntries, useQuickMutations } from '../../../data/hooks';
import { useActive } from '../../../data/session';
import { checkEntry, dueSince } from '../../../domain/quick';
import { addDays, formatDate, localDate, localTime, today, zonedToUtc } from '../../../domain/time';
import { AppScreen } from '../../../features/AppScreen';
import { errorText } from '../../../features/errors';
import { Badge, Banner, Button, Card, Checkbox, EmptyState, SectionHeader, Skeleton, Text, TextField } from '../../../ui';

/** S17 Schnellaktion eintragen: Felder aus der Definition, Grenzwerte sofort sichtbar, letzte Einträge. */
export default function QuickEntryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { tenant } = useActive();
  const tz = tenant.timezone;
  const quick = useQuickActions();
  const since = zonedToUtc(addDays(today(tz), -7), '00:00', tz);
  const entries = useQuickEntries(since, id);
  const members = useMembers();
  const { addEntry } = useQuickMutations();
  const action = quick.data?.actions.find((a) => a.id === id);
  const [values, setValues] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState(false);
  const [saved, setSaved] = useState<{ outOfRange: boolean } | null>(null);
  const names = useMemo(() => new Map((members.data ?? []).map((m) => [m.id, m.displayName])), [members.data]);

  if (quick.isLoading) return <AppScreen title="Eintragen" back><Skeleton height={300} /></AppScreen>;
  if (!action || action.archivedAt) {
    return <AppScreen title="Eintragen" back><Card><EmptyState icon={FileX} title="Nicht mehr verfügbar" body="Diese Schnellaktion wurde entfernt." /></Card></AppScreen>;
  }

  const check = checkEntry(action.fields, values);
  const due = dueSince(action, entries.data ?? [], tz);
  const submit = () => {
    setTouched(true);
    setSaved(null);
    if (!check.ok) return;
    addEntry.mutate({ quickActionId: action.id, values }, {
      onSuccess: (e) => { setSaved({ outOfRange: e.outOfRange }); setValues({}); setTouched(false); },
    });
  };

  return (
    <AppScreen title={action.name} eyebrow="Schnellaktion" back>
      {due ? <Banner tone="warning" title={`Fällig seit ${due} Uhr`} /> : null}
      {saved ? (
        saved.outOfRange
          ? <Banner tone="warning" title="Gespeichert, aber außerhalb der Grenzwerte." body="Bitte Maßnahme ergreifen und den Chef informieren." />
          : <Banner tone="success" title="Gespeichert." />
      ) : null}
      {addEntry.isError ? <Banner tone="danger" title={errorText(addEntry.error)} /> : null}

      <Card style={styles.form}>
        {action.fields.map((f) => {
          const err = touched ? check.errors[f.key] : undefined;
          const oor = check.outOfRange.includes(f.key);
          const range = f.min != null || f.max != null ? `Soll ${f.min ?? '…'} bis ${f.max ?? '…'}${f.unit ? ` ${f.unit}` : ''}` : undefined;
          if (f.type === 'check') {
            return (
              <View key={f.key}>
                <Checkbox label={f.label} checked={values[f.key] === 'ja'} onChange={(v) => setValues({ ...values, [f.key]: v ? 'ja' : '' })} />
                {err ? <Text variant="xs" color="danger">{err}</Text> : null}
              </View>
            );
          }
          return (
            <View key={f.key} style={{ gap: 4 }}>
              <TextField
                label={`${f.label}${f.unit ? ` (${f.unit})` : ''}${f.required ? '' : ' – optional'}`}
                value={values[f.key] ?? ''}
                onChangeText={(v) => setValues({ ...values, [f.key]: v })}
                keyboardType={f.type === 'number' ? 'numbers-and-punctuation' : 'default'}
                error={err}
                hint={oor ? undefined : range}
              />
              {oor ? <Text variant="xs" color="onHighlightSoft">⚠ Außerhalb des Sollbereichs ({range?.replace('Soll ', '')})</Text> : null}
            </View>
          );
        })}
        <Button label="Speichern" icon={Check} size="lg" fullWidth loading={addEntry.isPending} onPress={submit} />
      </Card>

      <SectionHeader title="Letzte 7 Tage" count={entries.data?.length} />
      {entries.isLoading ? <Skeleton height={64} /> : (entries.data ?? []).length === 0 ? (
        <Text variant="sm" color="textMuted">Noch keine Einträge.</Text>
      ) : (
        <Card style={styles.list}>
          {entries.data!.slice(0, 20).map((e) => (
            <View key={e.id} style={styles.entry}>
              <View style={styles.entryHead}>
                <Text variant="sm" style={{ flex: 1 }}>
                  {localDate(e.recordedAt, tz) === today(tz) ? 'Heute' : formatDate(localDate(e.recordedAt, tz))}, {localTime(e.recordedAt, tz)} · {names.get(e.memberId) ?? '?'}
                </Text>
                {e.outOfRange ? <Badge label="Abweichung" tone="highlight" /> : null}
              </View>
              <Text variant="xs" color="textMuted">
                {action.fields.filter((f) => e.values[f.key]).map((f) => `${f.label}: ${e.values[f.key]}${f.unit && f.type === 'number' ? ` ${f.unit}` : ''}`).join(' · ')}
              </Text>
            </View>
          ))}
        </Card>
      )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  form: { gap: 14 },
  list: { gap: 10 },
  entry: { gap: 2 },
  entryHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
