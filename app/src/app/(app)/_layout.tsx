import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { registerForPush } from '../../features/push';
import { useTheme } from '../../theme';

export default function AppLayout() {
  const { c } = useTheme();
  // Push erst nach dem Login anfragen. Fehler hier dürfen die App nicht aufhalten.
  useEffect(() => {
    registerForPush().catch(() => {});
  }, []);
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg } }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="zuweisen" options={{ presentation: 'modal' }} />
    </Stack>
  );
}
