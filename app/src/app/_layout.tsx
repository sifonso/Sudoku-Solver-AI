import {
  BarlowSemiCondensed_600SemiBold,
  BarlowSemiCondensed_700Bold,
} from '@expo-google-fonts/barlow-semi-condensed';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { QueryProvider } from '../data/persist';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SessionProvider, useSession } from '../data/session';
import { ThemeProvider, useTheme } from '../theme';

function RootStack() {
  const { session, loading, member } = useSession();
  const { c } = useTheme();
  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.bg }}>
        <ActivityIndicator color={c.accent} accessibilityLabel="Lädt" />
      </View>
    );
  }
  const signedIn = !!session && !!member;
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg } }}>
      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Screen name="design" />
    </Stack>
  );
}

export default function RootLayout() {
  const [loaded, error] = useFonts({
    BarlowSemiCondensed_600SemiBold,
    BarlowSemiCondensed_700Bold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });
  // Bei Ladefehler der Schriften mit Systemschrift weiter, statt weiß zu bleiben.
  if (!loaded && !error) return null;
  return (
    <SafeAreaProvider>
      <QueryProvider>
        <ThemeProvider>
          <SessionProvider>
            <StatusBar style="auto" />
            <RootStack />
          </SessionProvider>
        </ThemeProvider>
      </QueryProvider>
    </SafeAreaProvider>
  );
}
