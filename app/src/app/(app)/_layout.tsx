import { Stack } from 'expo-router';
import { useTheme } from '../../theme';

export default function AppLayout() {
  const { c } = useTheme();
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg } }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="zuweisen" options={{ presentation: 'modal' }} />
    </Stack>
  );
}
