import { Redirect, router } from 'expo-router';
import { CalendarDays, ChevronLeft, ChevronRight, Pencil, Settings2, X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Platform, StyleSheet, View, useWindowDimensions } from 'react-native';
import { canPlan } from '../../../data/api';
import { useAbsences, useMembers, usePlan, useUnassign } from '../../../data/hooks';
import { useActive } from '../../../data/session';
import { addDays, formatDate, isoWeekday, localTime, startOfWeek, today, weekdayShort } from '../../../domain/time';
import type { Assignment, Member, PlanSlot } from '../../../domain/types';
import { AppScreen } from '../../../features/AppScreen';
import { tokens } from '../../../theme';
import {
  ActionSheet, Banner, Button, Card, DayCard, EmployeeChip, EmptyState, IconButton, ShiftBlock, Skeleton, Text,
} from '../../../ui';

/** Kalenderwoche nach ISO 8601. */
function isoWeek(date: string): number {
  const thursday = addDays(date, 4 - isoWeekday(date));
  const jan1 = `${thursday.slice(0, 4)}-01-01`;
  const days = (Date.parse(thursday) - Date.parse(jan1)) / 86_400_000;
  return Math.floor(days / 7) + 1;
}

/** S03 Schichtplan, Wochenansicht. */
export default function PlanScreen() {
  const { member } = useActive();
  // Nur Chef/Planer. Die Datenbank lehnt Zuweisungen anderer Rollen ohnehin ab (RLS).
  if (!canPlan(member.role)) return <Redirect href="/meine" />;
  return <Planner />;
}

function Planner() {
  const { tenant } = useActive();
  const tz = tenant.timezone;
  const now = today(tz);
  const [week, setWeek] = useState(startOfWeek(now));
  const to = addDays(week, 6);
  const plan = usePlan(week, to);
  const absences = useAbsences(week, to);
  const members = useMembers();
  const unassign = useUnassign();
  const [menu, setMenu] = useState<{ a: Assignment; m: Member; slot: PlanSlot } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const { width } = useWindowDimensions();
  const cols = width >= 1280 ? 4 : width >= 900 ? 3 : width >= 640 ? 2 : 1;
  // Feste Spaltenbreite, damit unvollständige Reihen nicht breiter werden als volle.
  const GAP = 16;
  const inner = Math.min(width, tokens.layout.contentMax) - 32;
  const cellWidth = cols === 1 ? inner : Math.floor((inner - GAP * (cols - 1)) / cols);

  const byId = useMemo(() => new Map((members.data ?? []).map((m) => [m.id, m])), [members.data]);
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(week, i)), [week]);
  const slotsByDay = useMemo(() => {
    const map = new Map<string, PlanSlot[]>();
    for (const s of plan.data ?? []) map.set(s.date, [...(map.get(s.date) ?? []), s]);
    return map;
  }, [plan.data]);

  const loading = plan.isLoading || members.isLoading;
  const error = plan.error || members.error;
  const noTypes = plan.isSuccess && plan.data.length === 0;

  return (
    <AppScreen
      title={`KW ${isoWeek(week)} · ${formatDate(week).slice(0, 6)}–${formatDate(to)}`}
      eyebrow={tenant.name}
      onRefresh={() => { plan.refetch(); members.refetch(); }}
      refreshing={plan.isRefetching}
      actions={<IconButton icon={Settings2} label="Schichttypen" onPress={() => router.push('/schichttypen')} />}
    >
      <View style={styles.nav}>
        <IconButton icon={ChevronLeft} label="Vorige Woche" tone="soft" onPress={() => setWeek(addDays(week, -7))} />
        <Button label="Diese Woche" variant="secondary" size="sm" icon={CalendarDays} onPress={() => setWeek(startOfWeek(now))}
          disabled={week === startOfWeek(now)} />
        <IconButton icon={ChevronRight} label="Nächste Woche" tone="soft" onPress={() => setWeek(addDays(week, 7))} />
      </View>

      {notice ? <Banner tone="success" title={notice} /> : null}
      {unassign.isError ? <Banner tone="danger" title="Entfernen fehlgeschlagen" body="Bitte noch einmal versuchen." /> : null}

      {error ? (
        <Banner tone="danger" title="Plan konnte nicht geladen werden" body="Prüfe die Verbindung."
          action={<Button label="Erneut" size="sm" variant="secondary" onPress={() => { plan.refetch(); members.refetch(); }} />} />
      ) : loading ? (
        <View style={styles.grid}>
          {Array.from({ length: Math.min(cols, 3) }, (_, i) => (
            <View key={i} style={[styles.cell, { width: cellWidth }]}>
              <Skeleton height={84} radius={12} />
              <Skeleton height={140} />
              <Skeleton height={140} />
            </View>
          ))}
        </View>
      ) : noTypes ? (
        <Card>
          <EmptyState icon={CalendarDays} title="Noch keine Schichttypen"
            body="Lege fest, welche Schichten es gibt, zum Beispiel Früh- und Spätschicht. Danach kannst du dein Team einteilen."
            action={<Button label="Schichttypen anlegen" onPress={() => router.push('/schichttypen')} />} />
        </Card>
      ) : (
        <View style={styles.grid}>
          {days.map((d) => {
            const slots = slotsByDay.get(d) ?? [];
            return (
              <View key={d} style={[styles.cell, { width: cellWidth }]}>
                <DayCard
                  day={Number(d.slice(8))}
                  weekday={weekdayShort(d)}
                  date={formatDate(d)}
                  today={d === now}
                  weekend={isoWeekday(d) >= 6}
                  onPrint={Platform.OS === 'web' ? () => window.print() : undefined}
                >
                  {(() => {
                    const away = (absences.data ?? []).filter((a) => a.status === 'approved' && a.startDate <= d && a.endDate >= d);
                    if (!away.length) return null;
                    return (
                      <Text variant="sm" color="textMuted">
                        Abwesend: {away.map((a) => `${byId.get(a.memberId)?.displayName ?? '?'} (${a.kind === 'sick' ? 'krank' : 'Urlaub'})`).join(', ')}
                      </Text>
                    );
                  })()}
                  {slots.length === 0 ? (
                    <Text variant="sm" color="textMuted">An diesem Tag sind keine Schichten vorgesehen.</Text>
                  ) : (
                    slots.map((slot) => (
                      <ShiftBlock
                        key={slot.shiftType.id}
                        name={slot.shiftType.name}
                        time={`${localTime(slot.startAt, tz)} – ${localTime(slot.endAt, tz)}`}
                        staffed={slot.assignments.length}
                        needed={slot.shift?.minStaff ?? slot.shiftType.minStaff}
                        onAdd={() => router.push({ pathname: '/zuweisen', params: { type: slot.shiftType.id, date: d } })}
                      >
                        {slot.assignments.map((a) => {
                          const m = byId.get(a.memberId);
                          if (!m) return null;
                          return (
                            <EmployeeChip key={a.id} name={m.displayName} initials={m.initials} employment={m.employmentType}
                              onPress={() => setMenu({ a, m, slot })} />
                          );
                        })}
                      </ShiftBlock>
                    ))
                  )}
                </DayCard>
              </View>
            );
          })}
        </View>
      )}

      <ActionSheet
        visible={!!menu}
        title={menu ? `${menu.m.displayName} · ${menu.slot.shiftType.name}` : ''}
        onClose={() => setMenu(null)}
        items={menu ? [
          { label: 'Zeiten bearbeiten', icon: Pencil, onPress: () => router.push({ pathname: '/schicht/[id]', params: { id: menu.a.shiftId } }) },
          {
            label: 'Zuweisung löschen', icon: X, destructive: true,
            onPress: () => {
              const m = menu;
              unassign.mutate(m.a.id, {
                onSuccess: () => setNotice(`${m.m.displayName} ist nicht mehr in der ${m.slot.shiftType.name} am ${weekdayShort(m.slot.date)}.`),
              });
            },
          },
        ] : []}
      />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  cell: { gap: 12 },
});
