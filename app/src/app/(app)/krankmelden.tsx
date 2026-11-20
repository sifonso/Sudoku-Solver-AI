import { router } from 'expo-router';
import { Stethoscope } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useReportSick } from '../../data/hooks';
import { useActive } from '../../data/session';
import { addDays, formatRange, isoWeekday, today } from '../../domain/time';
import { AppScreen } from '../../features/AppScreen';
import { errorText } from '../../features/errors';
import { Banner, Button, Card, ChoiceChips, Text } from '../../ui';

type Span = '1' | '2' | '3' | 'week';

/** S23 Krank melden: ein Zeitraum, ein Tipp. Planer bekommen eine neutrale Mitteilung ohne Grund. */
export default function SickScreen() {
  const { tenant } = useActive();
  const start = today(tenant.timezone);
  const [span, setSpan] = useState<Span>('1');
  const report = useReportSick();
  const end =
    span === 'week' ? addDays(start, 7 - isoWeekday(start)) : addDays(start, Number(span) - 1);

  if (report.isSuccess) {
    return (
      <AppScreen title="Krank melden" back>
        <Banner tone="success" title="Krankmeldung ist raus."
          body={`Für ${formatRange(start, end)}. Deine FK4 bzw. SL sieht, welche Schichten betroffen sind, und kümmert sich um Ersatz. Gute Besserung!`} />
        <Button label="Zu meinen Schichten" variant="secondary" onPress={() => router.replace('/meine')} />
      </AppScreen>
    );
  }

  return (
    <AppScreen title="Krank melden" back>
      <Card style={styles.card}>
        <ChoiceChips<Span>
          label="Wie lange voraussichtlich?"
          value={span}
          onChange={setSpan}
          options={[
            { value: '1', label: 'Nur heute' },
            { value: '2', label: 'Heute und morgen' },
            { value: '3', label: '3 Tage' },
            { value: 'week', label: 'Bis Sonntag' },
          ]}
        />
        <Text variant="base">Zeitraum: {formatRange(start, end)}</Text>
        {report.isError ? <Banner tone="danger" title={errorText(report.error)} /> : null}
        <Button label="Krankmeldung senden" icon={Stethoscope} size="lg" fullWidth loading={report.isPending}
          onPress={() => report.mutate({ start, end })} />
      </Card>
      <View style={styles.note}>
        <Text variant="xs" color="textMuted">
          Ein Attest oder eine eAU geht weiter auf dem üblichen Weg an deinen Arbeitgeber. Den Grund sieht hier niemand außer Chef und Planern.
        </Text>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  card: { gap: 16 },
  note: { paddingHorizontal: 4 },
});
