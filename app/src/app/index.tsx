import { Redirect } from 'expo-router';
import { canPlan } from '../data/api';
import { useSession } from '../data/session';

/** Einstieg: ohne Login zur Anmeldung, Planer zum Plan, alle anderen zu ihren Schichten. */
export default function Index() {
  const { session, member } = useSession();
  if (!session || !member) return <Redirect href="/login" />;
  return <Redirect href={canPlan(member.role) ? '/plan' : '/meine'} />;
}
