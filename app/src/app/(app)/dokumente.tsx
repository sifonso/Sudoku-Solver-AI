import { FileText, Paperclip, Plus, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useActive } from '../../data/session';
import { MAX_UPLOAD, openUrl, pickFile } from '../../dienstplan/files';
import { dp as dpApi, useActor, useDocs, useDpAction } from '../../dienstplan/hooks';
import { DOC_CATEGORIES, type DocItem } from '../../dienstplan/model';
import { PickChips } from '../../dienstplan/ui';
import { AppScreen } from '../../features/AppScreen';
import { errorText } from '../../features/errors';
import { Banner, Button, Card, EmptyState, IconButton, SectionHeader, Skeleton, Text, TextField } from '../../ui';

const toIso = (de: string) => {
  const m = de.trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  return m ? `${m[3]}-${(m[2] ?? '').padStart(2, '0')}-${(m[1] ?? '').padStart(2, '0')}` : null;
};
const kb = (n: number | null) => (n == null ? '' : n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

/** Regeln zum Dienstplan und Betriebsvereinbarungen. Lesen alle, hochladen FK4/SL und FK3. */
export default function DocsScreen() {
  const { tenant } = useActive();
  const actor = useActor();
  const docs = useDocs();
  const canWrite = actor.isLead || !!actor.isFk3;
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [cat, setCat] = useState<string>(DOC_CATEGORIES[0]);
  const [note, setNote] = useState('');
  const [valid, setValid] = useState('');
  const [file, setFile] = useState<Awaited<ReturnType<typeof pickFile>>>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const add = useDpAction((t, v: Parameters<typeof dpApi.addDoc>[1], a) => dpApi.addDoc(t, v, a));
  const del = useDpAction((t, id: string, a) => dpApi.deleteDoc(t, id, a));
  const show = async (d: DocItem) => {
    try { await openUrl(await dpApi.docUrl(tenant.id, d)); } catch (e) { setMsg(errorText(e)); }
  };
  const choose = async () => {
    setMsg(null);
    const f = await pickFile().catch(() => null);
    if (f && f.size > MAX_UPLOAD) { setMsg('Datei ist größer als 20 MB.'); return; }
    if (f) { setFile(f); if (!title) setTitle(f.name.replace(/\.[^.]+$/, '')); }
  };
  const reset = () => { setTitle(''); setNote(''); setValid(''); setFile(null); setOpen(false); };

  return (
    <AppScreen title="Regeln und Vereinbarungen" eyebrow="Dokumente" back onRefresh={() => docs.refetch()} refreshing={docs.isRefetching}
      actions={canWrite ? <Button label="Neu" icon={Plus} size="sm" onPress={() => setOpen(!open)} /> : null}>
      {msg ? <Banner tone="danger" title={msg} /> : null}
      {del.isError ? <Banner tone="danger" title={errorText(del.error)} /> : null}
      {open && canWrite ? (
        <Card style={styles.card}>
          <TextField label="Titel" value={title} onChangeText={setTitle} maxLength={200} />
          <PickChips label="Bereich" showLabel value={cat} onChange={setCat} options={DOC_CATEGORIES.map((k) => ({ value: k, label: k }))} />
          <TextField label="Gültig ab (optional)" value={valid} onChangeText={setValid} placeholder="TT.MM.JJJJ" />
          <TextField label="Text oder Zusammenfassung (optional)" value={note} onChangeText={setNote} multiline maxLength={4000} />
          <View style={styles.row}>
            <Button label={file ? 'Andere Datei' : 'Datei wählen (PDF, Bild, Word …)'} icon={Paperclip} variant="secondary" onPress={choose} />
            {file ? <Text variant="sm">{file.name} · {kb(file.size)}</Text> : null}
          </View>
          {add.isError ? <Banner tone="danger" title={errorText(add.error)} /> : null}
          <View style={styles.row}>
            <Button label="Speichern" disabled={!title.trim() || (!file && !note.trim())} loading={add.isPending}
              onPress={() => add.mutate({ title: title.trim(), category: cat, note: note.trim(), validFrom: toIso(valid), file }, { onSuccess: reset })} />
            <Button label="Abbrechen" variant="ghost" onPress={reset} />
          </View>
        </Card>
      ) : null}
      {!docs.data ? <Skeleton height={200} /> : docs.data.length === 0 ? (
        <EmptyState icon={FileText} title="Noch nichts abgelegt" body={canWrite ? 'Mit „Neu“ Dienstplanregeln oder Betriebsvereinbarungen hochladen.' : 'FK4 / SL legen hier Regeln und Betriebsvereinbarungen ab.'} />
      ) : DOC_CATEGORIES.map((k) => {
        const items = docs.data!.filter((d) => d.category === k);
        if (!items.length) return null;
        return (
          <View key={k} style={{ gap: 8 }}>
            <SectionHeader title={k} count={items.length} />
            {items.map((d) => (
              <Card key={d.id} style={styles.card}>
                <View style={styles.row}>
                  <Text variant="lg" style={{ flex: 1 }}>{d.title}</Text>
                  {canWrite ? <IconButton icon={Trash2} label={`${d.title} löschen`} onPress={() => del.mutate(d.id)} /> : null}
                </View>
                <Text variant="xs" color="textMuted">
                  {[d.validFrom && `gültig ab ${d.validFrom.slice(8)}.${d.validFrom.slice(5, 7)}.${d.validFrom.slice(0, 4)}`, `abgelegt von ${d.uploadedName}`,
                    new Date(d.uploadedAt).toLocaleDateString('de-DE')].filter(Boolean).join(' · ')}
                </Text>
                {d.note ? <Text variant="sm">{d.note}</Text> : null}
                {d.path ? <Button label={`Öffnen: ${d.fileName ?? 'Datei'} (${kb(d.size)})`} icon={FileText} size="sm" variant="secondary" onPress={() => show(d)} /> : null}
              </Card>
            ))}
          </View>
        );
      })}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  card: { gap: 10 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, alignItems: 'center' },
});
