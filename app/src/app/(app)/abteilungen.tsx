import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { roleLabel } from '../../data/api';
import { api } from '../../data/client';
import { useActive, useSession } from '../../data/session';
import { COMPANY } from '../../domain/company';
import { AppScreen } from '../../features/AppScreen';
import { errorText } from '../../features/errors';
import { useTheme } from '../../theme';
import { Banner, Button, Card, SectionHeader, Text, TextField } from '../../ui';

const slugOf = (name: string) =>
  `${name.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/ß/g, 'ss').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'abteilung'}-${Math.random().toString(36).slice(2, 6)}`;

/**
 * Abteilungen der FMG. Jede Abteilung ist ein eigener Bereich mit eigenem Team, Turnus,
 * Regelwerk, Schichtstärke und eigenen FK4 / SL. Wer in mehreren Mitglied ist, wechselt hier.
 */
export default function DepartmentsScreen() {
  const { c } = useTheme();
  const qc = useQueryClient();
  const { tenant, member } = useActive();
  const { memberships, selectTenant, session } = useSession();
  const lead = member.role === 'chef';
  const [name, setName] = useState(tenant.name);
  const [newName, setNewName] = useState('');
  useEffect(() => setName(tenant.name), [tenant.id, tenant.name]);
  const refresh = () => qc.invalidateQueries({ queryKey: ['memberships', session?.userId] });
  const rename = useMutation({ mutationFn: () => api.renameTenant(tenant.id, name), onSuccess: refresh });
  const create = useMutation({
    mutationFn: () => api.createTenant({ slug: slugOf(newName), name: newName.trim(), displayName: member.displayName, initials: member.initials }),
    onSuccess: async (id) => { await refresh(); setNewName(''); selectTenant(id); },
  });
  const err = rename.error ?? create.error;

  return (
    <AppScreen title="Abteilung" eyebrow={`${COMPANY.name} (${COMPANY.short})`} back>
      {err ? <Banner tone="danger" title={errorText(err)} /> : null}
      <SectionHeader title="Aktuelle Abteilung" />
      <Card style={styles.card}>
        {lead ? (
          <>
            <TextField label="Name der Abteilung" value={name} onChangeText={setName} maxLength={80} />
            <Button label="Namen speichern" disabled={name.trim().length < 2 || name.trim() === tenant.name} loading={rename.isPending} onPress={() => rename.mutate()} />
            {rename.isSuccess ? <Banner tone="success" title="Gespeichert." /> : null}
          </>
        ) : <Text variant="lg">{tenant.name}</Text>}
        <Text variant="xs" color="textMuted">
          Turnus, Regelwerk, Schichtstärke, Urlaubsregeln und Team gelten nur für diese Abteilung und werden unter Mehr eingestellt.
        </Text>
      </Card>

      {memberships.length > 1 ? (
        <>
          <SectionHeader title="Abteilung wechseln" count={memberships.length} />
          {memberships.map((m) => {
            const active = m.tenant.id === tenant.id;
            return (
              <Pressable key={m.tenant.id} accessibilityRole="button" accessibilityLabel={`Zu ${m.tenant.name} wechseln`} accessibilityState={{ selected: active }}
                onPress={() => selectTenant(m.tenant.id)}
                style={[styles.item, { borderColor: active ? c.accent : c.border, backgroundColor: active ? c.accentSoft : c.surfaceRaised }]}>
                <View style={{ flex: 1 }}>
                  <Text variant="base">{m.tenant.name}</Text>
                  <Text variant="xs" color="textMuted">{roleLabel[m.member.role]}</Text>
                </View>
                {active ? <Check size={20} color={c.accent} /> : null}
              </Pressable>
            );
          })}
        </>
      ) : null}

      {lead ? (
        <>
          <SectionHeader title="Neue Abteilung anlegen" />
          <Card style={styles.card}>
            <Text variant="xs" color="textMuted">Du wirst FK4 / SL der neuen Abteilung und lädst danach ihr Team ein. Die Abteilung startet mit den Standardregeln, die du anpasst.</Text>
            <TextField label="Name der neuen Abteilung" value={newName} onChangeText={setNewName} maxLength={80} />
            <Button label="Abteilung anlegen" variant="secondary" disabled={newName.trim().length < 2} loading={create.isPending} onPress={() => create.mutate()} />
          </Card>
        </>
      ) : null}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  card: { gap: 10 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 12, borderWidth: 1, minHeight: 56 },
});
