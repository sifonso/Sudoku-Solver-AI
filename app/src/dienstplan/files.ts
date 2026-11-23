// Datei auswählen und als Base64 lesen (Web und iOS/Android).
import * as DocumentPicker from 'expo-document-picker';
import { Linking, Platform } from 'react-native';

export const MAX_UPLOAD = 20 * 1024 * 1024;

export async function pickFile(): Promise<{ name: string; mime: string; size: number; base64: string } | null> {
  const r = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, multiple: false });
  if (r.canceled || !r.assets?.[0]) return null;
  const a = r.assets[0];
  const mime = a.mimeType ?? 'application/octet-stream';
  let base64: string;
  if (Platform.OS === 'web') {
    const blob = a.file ?? (await (await fetch(a.uri)).blob());
    base64 = await new Promise<string>((res, rej) => {
      const fr = new FileReader();
      fr.onload = () => res(String(fr.result).split(',')[1] ?? '');
      fr.onerror = () => rej(fr.error);
      fr.readAsDataURL(blob);
    });
  } else {
    const FS = await import('expo-file-system/legacy');
    base64 = await FS.readAsStringAsync(a.uri, { encoding: FS.EncodingType.Base64 });
  }
  return { name: a.name, mime, size: a.size ?? Math.round((base64.length * 3) / 4), base64 };
}

export async function openUrl(url: string) {
  if (Platform.OS === 'web') {
    window.open(url, '_blank', 'noopener');
    return;
  }
  await Linking.openURL(url);
}
