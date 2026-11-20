import { Redirect } from 'expo-router';

/** Unbekannte Adresse: zurück zum Einstieg, der je nach Login weiterleitet. */
export default function NotFound() {
  return <Redirect href="/" />;
}
