import { router } from 'expo-router';
import { Folder } from 'lucide-react-native';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { useActive } from '../data/session';
import { dueSince } from '../domain/quick';
import type { QuickAction, QuickEntry, QuickFolder } from '../domain/types';
import { ActionTile } from '../ui';
import { PAIR_PATTERN, QUICK_ICONS } from './quickIcons';

/** Kachelraster für S16/S18. Spaltenzahl nach Breite, damit Kacheln auf dem Tablet im Betrieb groß bleiben. */
export function QuickGrid({ folders, actions, entries, extra }: {
  folders: QuickFolder[]; actions: QuickAction[]; entries: QuickEntry[];
  /** Weitere Kacheln in derselben Spaltenbreite. */
  extra?: (style: { width: `${number}%` }) => React.ReactNode;
}) {
  const { tenant } = useActive();
  const { width } = useWindowDimensions();
  const cols = width >= 1100 ? 4 : width >= 700 ? 3 : 2;
  const basis = { width: `${Math.floor(100 / cols) - 3}%` as const };
  return (
    <View style={styles.grid}>
      {folders.map((f) => {
        const inside = actions.filter((a) => a.folderId === f.id && !a.archivedAt);
        const due = inside.some((a) => dueSince(a, entries, tenant.timezone));
        return (
          <View key={f.id} style={basis}>
            <ActionTile title={f.name} subtitle={`${inside.length} Aktion${inside.length === 1 ? '' : 'en'}`} icon={Folder}
              pair={f.pair} pattern={PAIR_PATTERN[f.pair]} due={due}
              onPress={() => router.push({ pathname: '/ordner/[id]', params: { id: f.id } })} />
          </View>
        );
      })}
      {/* Aktionen in Ordnern nur im Ordner zeigen; gezählt und auf Fälligkeit geprüft werden sie oben trotzdem (BUG-011). */}
      {actions.filter((a) => !a.archivedAt && (folders.length === 0 || !a.folderId)).map((a) => {
        const due = dueSince(a, entries, tenant.timezone);
        return (
          <View key={a.id} style={basis}>
            <ActionTile title={a.name} subtitle={due ? `Fällig seit ${due}` : 'Tippen zum Eintragen'}
              icon={QUICK_ICONS[a.icon].icon} pair={a.pair} pattern={PAIR_PATTERN[a.pair]} due={!!due}
              onPress={() => router.push({ pathname: '/schnellaktion/[id]', params: { id: a.id } })} />
          </View>
        );
      })}
      {extra?.(basis)}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
});
