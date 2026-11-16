import { router } from 'expo-router';
import { ClipboardList, Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { canPlan } from '../../../data/api';
import { useShiftTypes, useTaskMutations, useTasks } from '../../../data/hooks';
import { useActive } from '../../../data/session';
import type { Task } from '../../../domain/types';
import { AppScreen } from '../../../features/AppScreen';
import { errorText } from '../../../features/errors';
import { Badge, Banner, Button, Card, Checkbox, EmptyState, SegmentedControl, Skeleton, Text } from '../../../ui';

const WD = ['', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const PRIO = ['Niedrig', 'Normal', 'Hoch'] as const;

/** S13 Aufgaben verwalten: Standardaufgaben an Schichttypen, Sonderaufgaben einzelner Zuweisungen. */
export default function TasksScreen() {
  const { tenant, member } = useActive();
  const tasks = useTasks();
  const types = useShiftTypes();
  const ops = useTaskMutations();
  const [kind, setKind] = useState<'standard' | 'special'>('standard');
  const [showDeleted, setShowDeleted] = useState(false);
  const canEdit = canPlan(member.role) || member.role === 'aufgaben_manager';
  const typeName = useMemo(() => new Map((types.data ?? []).map((t) => [t.id, t.name])), [types.data]);

  const all = tasks.data ?? [];
  const count = (k: Task['kind']) => all.filter((t) => t.kind === k && !t.deletedAt).length;
  const list = all.filter((t) => t.kind === kind && (showDeleted || !t.deletedAt))
    .sort((a, b) => Number(!!a.deletedAt) - Number(!!b.deletedAt) || b.priority - a.priority || a.title.localeCompare(b.title, 'de'));

  return (
    <AppScreen title="Aufgaben" eyebrow={tenant.name} onRefresh={() => tasks.refetch()} refreshing={tasks.isRefetching}>
      <View style={styles.head}>
        <SegmentedControl label="Art" value={kind} onChange={setKind} options={[
          { value: 'standard', label: `Standard (${count('standard')})` },
          { value: 'special', label: `Sonder (${count('special')})` },
        ]} />
        {canEdit && kind === 'standard' ? (
          <Button label="Neue Aufgabe" icon={Plus} onPress={() => router.push('/aufgabe-neu')} />
        ) : null}
      </View>
      <Checkbox label="Gelöschte anzeigen" checked={showDeleted} onChange={setShowDeleted} />
      {ops.setDeleted.isError ? <Banner tone="danger" title={errorText(ops.setDeleted.error)} /> : null}

      {tasks.isLoading ? (
        <View style={styles.list}>{[0, 1].map((i) => <Skeleton key={i} height={110} radius={12} />)}</View>
      ) : tasks.isError ? (
        <Banner tone="danger" title="Aufgaben konnten nicht geladen werden"
          action={<Button label="Erneut" size="sm" variant="secondary" onPress={() => tasks.refetch()} />} />
      ) : list.length === 0 ? (
        <Card>
          <EmptyState icon={ClipboardList}
            title={kind === 'standard' ? 'Noch keine Standardaufgaben' : 'Keine Sonderaufgaben'}
            body={kind === 'standard'
              ? 'Standardaufgaben hängen an Schichttypen, zum Beispiel „Kasse zählen“ in jeder Spätschicht. Wer eingeteilt ist, hakt sie in der App ab.'
              : 'Sonderaufgaben vergibst du im Plan: Mitarbeiter-Kärtchen antippen, dann „Sonderaufgabe“.'}
            action={canEdit && kind === 'standard' ? <Button label="Erste Aufgabe anlegen" icon={Plus} onPress={() => router.push('/aufgabe-neu')} /> : undefined} />
        </Card>
      ) : (
        <View style={styles.list}>
          {list.map((t) => (
            <Card key={t.id} style={[styles.card, t.deletedAt ? styles.deleted : null]}>
              <View style={styles.row}>
                <Text variant="lg" style={{ flex: 1 }}>{t.title}</Text>
                {t.deletedAt ? <Badge label="Gelöscht" /> : <Badge label={PRIO[t.priority]} tone={t.priority === 2 ? 'highlight' : 'neutral'} />}
              </View>
              {t.description ? <Text variant="sm" color="textMuted">{t.description}</Text> : null}
              {t.kind === 'standard' ? (
                <View style={styles.tags}>
                  {t.shiftTypeIds.map((id) => <Badge key={id} label={typeName.get(id) ?? '?'} tone="accent" />)}
                  <Text variant="xs" color="textMuted">{t.weekdays ? t.weekdays.map((d) => WD[d]).join(', ') : 'jeden Tag'}</Text>
                </View>
              ) : null}
              <Text variant="xs" color="textMuted">{t.completionCount}× erledigt</Text>
              {canEdit ? (
                <View style={styles.row}>
                  {t.deletedAt ? (
                    <Button label="Wiederherstellen" icon={RotateCcw} size="sm" variant="secondary"
                      onPress={() => ops.setDeleted.mutate({ id: t.id, deleted: false })} />
                  ) : (
                    <>
                      {t.kind === 'standard' ? (
                        <Button label="Bearbeiten" icon={Pencil} size="sm" variant="secondary"
                          onPress={() => router.push({ pathname: '/aufgabe-neu', params: { id: t.id } })} />
                      ) : null}
                      <Button label="Löschen" icon={Trash2} size="sm" variant="ghost"
                        onPress={() => ops.setDeleted.mutate({ id: t.id, deleted: true })} />
                    </>
                  )}
                </View>
              ) : null}
            </Card>
          ))}
        </View>
      )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, alignItems: 'center', justifyContent: 'space-between' },
  list: { gap: 12 },
  card: { gap: 8 },
  deleted: { opacity: 0.7 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' },
});
