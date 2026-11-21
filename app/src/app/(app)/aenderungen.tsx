import { StyleSheet, View } from 'react-native';
import { CHANGELOG } from '../../changelog';
import { AppScreen } from '../../features/AppScreen';
import { Card, Text } from '../../ui';

/** Änderungsprotokoll der App für alle. */
export default function ChangelogScreen() {
  return (
    <AppScreen title="Änderungen an der App" eyebrow="Änderungsprotokoll" back>
      {CHANGELOG.map((r) => (
        <Card key={r.version} style={styles.card}>
          <Text variant="lg">Version {r.version}</Text>
          <Text variant="xs" color="textMuted">{r.date.slice(8)}.{r.date.slice(5, 7)}.{r.date.slice(0, 4)}</Text>
          {r.items.map((it) => (
            <View key={it} style={styles.item}>
              <Text variant="sm" color="textMuted">•</Text>
              <Text variant="sm" style={{ flex: 1 }}>{it}</Text>
            </View>
          ))}
        </Card>
      ))}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  card: { gap: 6 },
  item: { flexDirection: 'row', gap: 8 },
});
