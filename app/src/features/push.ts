// Push-Registrierung. Fragt erst nach dem Login (nicht beim App-Start) und nur auf echten Geräten.
// Ohne EAS-Projekt-ID (app.json extra.eas.projectId) gibt es kein Expo-Push-Token: dann passiert nichts.
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { api } from '../data/client';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export type PushResult = 'registered' | 'denied' | 'unsupported' | 'not_configured';

export async function registerForPush(): Promise<PushResult> {
  if (Platform.OS === 'web' || !Device.isDevice) return 'unsupported';
  const projectId: string | undefined =
    Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) return 'not_configured';

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Schichten und Mitteilungen',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  const current = await Notifications.getPermissionsAsync();
  const status = current.granted ? current : await Notifications.requestPermissionsAsync();
  if (!status.granted) return 'denied';

  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
  await api.registerDeviceToken(token, Platform.OS === 'ios' ? 'ios' : 'android');
  return 'registered';
}
