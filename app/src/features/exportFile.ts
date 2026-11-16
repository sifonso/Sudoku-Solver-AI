import { Platform, Share } from 'react-native';

/**
 * Datei ausgeben. Web: Download. iOS/Android: System-Teilen-Dialog mit dem Inhalt
 * (Excel, Numbers, Mail). Eine echte Datei-Freigabe kommt mit expo-sharing im nativen Build.
 */
export async function exportText(filename: string, content: string, mime = 'text/csv;charset=utf-8'): Promise<'downloaded' | 'shared' | 'dismissed'> {
  if (Platform.OS === 'web') {
    const url = URL.createObjectURL(new Blob([content], { type: mime }));
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return 'downloaded';
  }
  const r = await Share.share({ title: filename, message: content });
  return r.action === Share.sharedAction ? 'shared' : 'dismissed';
}
