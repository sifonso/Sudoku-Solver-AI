import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { Save } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { canPlan } from '../../data/api';
import { useShiftTypes, useTaskMutations, useTasks } from '../../data/hooks';
import { useActive } from '../../data/session';
import { AppScreen } from '../../features/AppScreen';
import { errorText } from '../../features/errors';
import { Banner, Button, Card, ChoiceChips, MultiChips, Skeleton, Text, TextField } from '../../ui';

const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7].map((d) => ({ value: d, label: ['', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'][d]! }));

/**
 * S14 Aufgabe anlegen/bearbeiten.
 * ?id=… bearbeitet eine Standardaufgabe, ?assignment=…&who=… legt eine Sonderaufgabe für eine Zuweisung an (aus S04).
 */
export default function TaskEditScreen() {
  const { member } = useActive();
  if (!(canPlan(member.role) || member.role === 'aufgaben_manager')) return <Redirect href="/aufgaben" />;
  return <TaskEdit />;
}

function TaskEdit() {
  const { id, assignment, who } = useLocalSearchParams<{ id?: string; assignment?: string; who?: string }>();
  const { tenant } = useActive();
  const tasks = useTasks();
  const types = useShiftTypes();
  const { save } = useTaskMutations();
  const special = !!assignment;
  const existing = id ? tasks.data?.find((t) => t.id === id) : undefined;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [shiftTypeIds, setShiftTypeIds] = useState<string[]>([]);
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [priority, setPriority] = useState<'0' | '1' | '2'>('1');
  const [touched, setTouched] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (existing && !loaded) {
      setTitle(existing.title);
      setDescription(existing.description ?? '');
      setShiftTypeIds(existing.shiftTypeIds);
      setWeekdays(existing.weekdays ?? []);
      setPriority(String(existing.priority) as '0' | '1' | '2');
      setLoaded(true);
    }
  }, [existing, loaded]);

  if (id && tasks.isLoading) return <AppScreen title="Aufgabe" back><Skeleton height={300} /></AppScreen>;

  const errors = {
    title: title.trim().length < 2 ? 'Bitte einen Titel eingeben.' : title.length > 200 ? 'Höchstens 200 Zeichen.' : undefined,
    shiftTypes: !special && shiftTypeIds.length === 0 ? 'Mindestens einen Schichttyp wählen.' : undefined,
  };
  const submit = () => {
    setTouched(true);
    if (errors.title || errors.shiftTypes) return;
    save.mutate({
      id, tenantId: tenant.id, title: title.trim(), description: description.trim() || null,
      kind: special ? 'special' : 'standard', assignmentId: special ? assignment! : null,
      shiftTypeIds: special ? [] : shiftTypeIds, weekdays: special || weekdays.length === 0 || weekdays.length === 7 ? null : [...weekdays].sort(),
      priority: Number(priority) as 0 | 1 | 2,
    }, { onSuccess: () => (router.canGoBack() ? router.back() : router.replace('/aufgaben')) });
  };

  return (
    <AppScreen title={special ? 'Sonderaufgabe' : id ? 'Aufgabe bearbeiten' : 'Neue Aufgabe'} back>
      {special && who ? <Text variant="sm" color="textMuted">Nur für {who} in dieser Schicht.</Text> : null}
      {save.isError ? <Banner tone="danger" title={errorText(save.error)} /> : null}
      <Card style={{ gap: 16 }}>
        <TextField label="Titel" value={title} onChangeText={setTitle} error={touched ? errors.title : undefined} maxLength={200} />
        <TextField label="Beschreibung (optional)" value={description} onChangeText={setDescription} multiline maxLength={1000} />
        {!special ? (
          <>
            <MultiChips label="In welchen Schichten?" values={shiftTypeIds} onChange={setShiftTypeIds}
              options={(types.data ?? []).map((t) => ({ value: t.id, label: t.name }))} />
            {touched && errors.shiftTypes ? <Text variant="xs" color="danger">{errors.shiftTypes}</Text> : null}
            <MultiChips label="An welchen Tagen?" values={weekdays} onChange={setWeekdays} options={WEEKDAYS}
              hint="Nichts gewählt heißt: an jedem Tag dieser Schichten." />
          </>
        ) : null}
        <ChoiceChips label="Priorität" value={priority} onChange={setPriority}
          options={[{ value: '0', label: 'Niedrig' }, { value: '1', label: 'Normal' }, { value: '2', label: 'Hoch' }]} />
        <Button label="Speichern" icon={Save} fullWidth size="lg" loading={save.isPending} onPress={submit} />
      </Card>
    </AppScreen>
  );
}
