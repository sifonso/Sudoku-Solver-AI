import { Hammer } from 'lucide-react-native';
import { Card, EmptyState, Text } from '../ui';
import { AppScreen } from './AppScreen';

/** Platzhalter für Screens, die nach dem Durchstich gebaut werden. ID = Recon-Screen-ID. */
export function StubScreen({ id, title, purpose, milestone, back = true }: {
  id: string; title: string; purpose: string; milestone: 2 | 3; back?: boolean;
}) {
  return (
    <AppScreen title={title} eyebrow={id} back={back}>
      <Card>
        <EmptyState
          icon={Hammer}
          title="Noch in Arbeit"
          body={`${purpose} Kommt mit Meilenstein ${milestone}.`}
        />
      </Card>
      <Text variant="xs" color="textMuted">Recon-ID {id} · replica/recon.md</Text>
    </AppScreen>
  );
}
