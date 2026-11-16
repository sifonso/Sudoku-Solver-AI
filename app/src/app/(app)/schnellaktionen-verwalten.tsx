import { Redirect } from 'expo-router';
import { Pencil, Plus, Save, Trash2, X } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useQuickActions, useQuickMutations } from '../../data/hooks';
import { useActive } from '../../data/session';
import type { QuickAction, QuickField, QuickFieldType, QuickIcon, QuickPair } from '../../domain/types';
import { AppScreen } from '../../features/AppScreen';
import { errorText } from '../../features/errors';
import { PAIR_LABEL, QUICK_ICONS } from '../../features/quickIcons';
import { Badge, Banner, Button, Card, Checkbox, ChoiceChips, IconButton, ListRow, SectionHeader, Skeleton, Text, TextField } from '../../ui';

type FieldDraft = { key: string; label: string; type: QuickFieldType; unit: string; min: string; max: string; required: boolean };
type Draft = {
  id?: string; name: string; icon: QuickIcon; pair: QuickPair; folder: string; newFolder: string;
  fields: FieldDraft[]; reminders: string;
};

const NEW_FOLDER = '__neu__';
const NO_FOLDER = '__kein__';
const num = (s: string) => (s.trim() === '' ? undefined : Number(s.trim().replace(',', '.')));
const fieldKey = (label: string, i: number) =>
  (label.toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'feld') + `_${i}`;

function toDraft(a?: QuickAction): Draft {
  return {
    id: a?.id, name: a?.name ?? '', icon: a?.icon ?? 'clipboard', pair: a?.pair ?? 'lavender',
    folder: a?.folderId ?? NO_FOLDER, newFolder: '',
    fields: (a?.fields ?? [{ key: '', label: '', type: 'number', required: true } as QuickField]).map((f) => ({
      key: f.key, label: f.label, type: f.type, unit: f.unit ?? '', min: f.min != null ? String(f.min) : '', max: f.max != null ? String(f.max) : '', required: !!f.required,
    })),
    reminders: (a?.reminderTimes ?? []).join(', '),
  };
}

function validate(d: Draft) {
  const reminders = d.reminders.split(/[,;\s]+/).map((t) => t.trim()).filter(Boolean);
  const badTime = reminders.find((t) => !/^([01]\d|2[0-3]):[0-5]\d$/.test(t));
  const fieldErrors = d.fields.map((f) => {
    if (f.label.trim().length < 1) return 'Bitte eine Bezeichnung eingeben.';
    if (f.type === 'number') {
      for (const v of [f.min, f.max]) if (v.trim() && Number.isNaN(Number(v.trim().replace(',', '.')))) return 'Grenzwerte müssen Zahlen sein.';
      const lo = num(f.min), hi = num(f.max);
      if (lo != null && hi != null && lo > hi) return 'Minimum ist größer als Maximum.';
    }
    return undefined;
  });
  return {
    name: d.name.trim().length < 2 ? 'Bitte einen Namen eingeben.' : undefined,
    folder: d.folder === NEW_FOLDER && d.newFolder.trim().length < 2 ? 'Bitte einen Ordnernamen eingeben.' : undefined,
    fields: d.fields.length === 0 ? 'Mindestens ein Feld.' : undefined,
    fieldErrors,
    reminders: badTime ? `„${badTime}“ ist keine Uhrzeit (HH:MM).` : undefined,
    reminderList: reminders,
    ok: false,
  };
}

/** S19 Schnellaktionen verwalten (Chef, Aufgaben-Manager): Felder mit Einheit und Grenzwerten, Farbe, Ordner, Erinnerungen. */
export default function QuickAdminScreen() {
  const { member } = useActive();
  if (member.role !== 'chef' && member.role !== 'aufgaben_manager') return <Redirect href="/schnell" />;
  return <QuickAdmin />;
}

function QuickAdmin() {
  const { tenant } = useActive();
  const quick = useQuickActions();
  const ops = useQuickMutations();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [touched, setTouched] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const actions = (quick.data?.actions ?? []).filter((a) => !a.archivedAt);
  const folders = quick.data?.folders ?? [];
  const folderName = (id: string | null) => folders.find((f) => f.id === id)?.name;

  const v = draft ? validate(draft) : null;
  const hasErrors = !!v && (!!v.name || !!v.folder || !!v.fields || !!v.reminders || v.fieldErrors.some(Boolean));

  const save = async () => {
    if (!draft || !v) return;
    setTouched(true);
    if (hasErrors) return;
    let folderId: string | null = draft.folder === NO_FOLDER ? null : draft.folder;
    if (draft.folder === NEW_FOLDER) {
      const f = await ops.saveFolder.mutateAsync({ tenantId: tenant.id, name: draft.newFolder.trim(), pair: draft.pair, sort: folders.length + 1 });
      folderId = f.id;
    }
    const fields: QuickField[] = draft.fields.map((f, i) => ({
      key: f.key || fieldKey(f.label, i), label: f.label.trim(), type: f.type,
      ...(f.unit.trim() ? { unit: f.unit.trim() } : {}),
      ...(f.type === 'number' && num(f.min) != null ? { min: num(f.min) } : {}),
      ...(f.type === 'number' && num(f.max) != null ? { max: num(f.max) } : {}),
      ...(f.required ? { required: true } : {}),
    }));
    await ops.save.mutateAsync({
      id: draft.id, tenantId: tenant.id, folderId, name: draft.name.trim(), icon: draft.icon, pair: draft.pair,
      fields, reminderTimes: [...new Set(v.reminderList)].sort(), sort: draft.id ? actions.find((a) => a.id === draft.id)?.sort ?? 0 : actions.length + 1,
    });
    setSaved(draft.name.trim());
    setDraft(null);
    setTouched(false);
  };

  const setField = (i: number, patch: Partial<FieldDraft>) =>
    draft && setDraft({ ...draft, fields: draft.fields.map((f, j) => (j === i ? { ...f, ...patch } : f)) });

  return (
    <AppScreen title="Schnellaktionen verwalten" back>
      {saved ? <Banner tone="success" title={`„${saved}“ gespeichert.`} /> : null}
      {ops.save.isError || ops.saveFolder.isError || ops.archive.isError ? (
        <Banner tone="danger" title={errorText(ops.save.error ?? ops.saveFolder.error ?? ops.archive.error)} />
      ) : null}

      {draft ? (
        <Card style={styles.form}>
          <Text variant="lg">{draft.id ? 'Schnellaktion bearbeiten' : 'Neue Schnellaktion'}</Text>
          <TextField label="Name" value={draft.name} onChangeText={(name) => setDraft({ ...draft, name })} error={touched ? v?.name : undefined} maxLength={60} />
          <ChoiceChips label="Symbol" value={draft.icon} onChange={(icon) => setDraft({ ...draft, icon })}
            options={(Object.keys(QUICK_ICONS) as QuickIcon[]).map((k) => ({ value: k, label: QUICK_ICONS[k].label }))} />
          <ChoiceChips label="Farbe" value={draft.pair} onChange={(pair) => setDraft({ ...draft, pair })}
            options={(Object.keys(PAIR_LABEL) as QuickPair[]).map((k) => ({ value: k, label: PAIR_LABEL[k] }))} />
          <ChoiceChips label="Ordner" value={draft.folder} onChange={(folder) => setDraft({ ...draft, folder })}
            options={[{ value: NO_FOLDER, label: 'Kein Ordner' }, ...folders.map((f) => ({ value: f.id, label: f.name })), { value: NEW_FOLDER, label: 'Neuer Ordner' }]} />
          {draft.folder === NEW_FOLDER ? (
            <TextField label="Name des neuen Ordners" value={draft.newFolder} onChangeText={(newFolder) => setDraft({ ...draft, newFolder })}
              error={touched ? v?.folder : undefined} />
          ) : null}

          <SectionHeader title="Felder" count={draft.fields.length} />
          {draft.fields.map((f, i) => (
            <View key={i} style={styles.field}>
              <View style={styles.fieldHead}>
                <Text variant="label" color="textMuted">Feld {i + 1}</Text>
                {draft.fields.length > 1 ? (
                  <Button label={`Feld ${i + 1} entfernen`} icon={X} size="sm" variant="ghost"
                    onPress={() => setDraft({ ...draft, fields: draft.fields.filter((_, j) => j !== i) })} />
                ) : null}
              </View>
              <TextField label={`Bezeichnung Feld ${i + 1}`} value={f.label} onChangeText={(label) => setField(i, { label })}
                error={touched ? v?.fieldErrors[i] : undefined} placeholder="z. B. Kühlhaus 1" />
              <ChoiceChips label={`Art Feld ${i + 1}`} value={f.type} onChange={(type) => setField(i, { type })}
                options={[{ value: 'number', label: 'Zahl' }, { value: 'text', label: 'Text' }, { value: 'check', label: 'Häkchen' }]} />
              {f.type === 'number' ? (
                <View style={styles.row3}>
                  <View style={styles.col}><TextField label={`Einheit Feld ${i + 1}`} value={f.unit} onChangeText={(unit) => setField(i, { unit })} placeholder="°C" /></View>
                  <View style={styles.col}><TextField label={`Min Feld ${i + 1}`} value={f.min} onChangeText={(min) => setField(i, { min })} keyboardType="numbers-and-punctuation" /></View>
                  <View style={styles.col}><TextField label={`Max Feld ${i + 1}`} value={f.max} onChangeText={(max) => setField(i, { max })} keyboardType="numbers-and-punctuation" /></View>
                </View>
              ) : null}
              <Checkbox label={`Feld ${i + 1} ist Pflicht`} checked={f.required} onChange={(required) => setField(i, { required })} />
            </View>
          ))}
          <Button label="Feld hinzufügen" icon={Plus} variant="secondary" size="sm"
            onPress={() => setDraft({ ...draft, fields: [...draft.fields, { key: '', label: '', type: 'number', unit: '', min: '', max: '', required: false }] })} />

          <TextField label="Erinnerungen" value={draft.reminders} onChangeText={(reminders) => setDraft({ ...draft, reminders })}
            placeholder="08:00, 16:00" hint="Uhrzeiten, zu denen die Kachel als fällig markiert wird. Leer lassen für keine."
            error={touched ? v?.reminders : undefined} />
          <View style={styles.row}>
            <Button label="Abbrechen" variant="secondary" onPress={() => { setDraft(null); setTouched(false); }} />
            <Button label="Speichern" icon={Save} loading={ops.save.isPending || ops.saveFolder.isPending} onPress={() => { save().catch(() => {}); }} />
          </View>
        </Card>
      ) : (
        <Button label="Neue Schnellaktion" icon={Plus} onPress={() => { setSaved(null); setDraft(toDraft()); }} />
      )}

      <SectionHeader title="Vorhanden" count={actions.length} />
      {quick.isLoading ? <Skeleton height={120} /> : actions.length === 0 ? (
        <Text variant="sm" color="textMuted">Noch keine Schnellaktionen.</Text>
      ) : (
        <Card style={styles.list}>
          {actions.map((a) => (
            <ListRow key={a.id} title={a.name}
              subtitle={[folderName(a.folderId), `${a.fields.length} Feld${a.fields.length === 1 ? '' : 'er'}`, a.reminderTimes.length ? `Erinnerung ${a.reminderTimes.join(', ')}` : null].filter(Boolean).join(' · ')}
              trailing={
                <View style={styles.row}>
                  <Badge label={PAIR_LABEL[a.pair]} />
                  <IconButton icon={Pencil} label={`${a.name} bearbeiten`} onPress={() => { setSaved(null); setDraft(toDraft(a)); }} />
                  <IconButton icon={Trash2} label={`${a.name} entfernen`} onPress={() => ops.archive.mutate(a.id)} />
                </View>
              } />
          ))}
        </Card>
      )}
      <Text variant="xs" color="textMuted">Entfernte Schnellaktionen verschwinden aus den Kacheln. Ihre Protokolle bleiben für Prüfungen erhalten.</Text>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  form: { gap: 14 },
  field: { gap: 10, paddingVertical: 8 },
  fieldHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  row3: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  col: { flexGrow: 1, flexBasis: 90 },
  list: { paddingVertical: 0 },
});
