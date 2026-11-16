import { Redirect } from 'expo-router';

// Bis die echten Screens stehen (/replica-build), startet die App auf der Design-Seite.
export default function Index() {
  return <Redirect href="/design" />;
}
