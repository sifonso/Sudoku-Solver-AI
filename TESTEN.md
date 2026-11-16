# App testen

Stand: 2026-11-16, Branch `claude/schichtenmanager-mobile-app-rfndcr`.

## Weg 1: auf dem eigenen Handy mit Expo Go (empfohlen)

Du brauchst einen Rechner (Windows, Mac oder Linux) mit Node.js 22 und das Handy im selben WLAN.

1. Auf dem Handy die App **Expo Go** installieren (App Store / Google Play).
2. Auf dem Rechner:
   ```bash
   git clone -b claude/schichtenmanager-mobile-app-rfndcr https://github.com/sifonso/Sudoku-Solver-AI.git
   cd Sudoku-Solver-AI/app
   npm install
   ```
3. Datei `app/.env.local` anlegen (die Werte stehen im Supabase-Dashboard unter Project Settings → API, beide sind öffentlich):
   ```
   EXPO_PUBLIC_SUPABASE_URL=https://afrgpfjslsewdkipqcvi.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=<publishable key>
   ```
   Ohne diese Datei startet die App mit Demodaten (Café Morgenrot, Demo-Knöpfe auf der Anmeldeseite).
4. `npx expo start` ausführen und den QR-Code mit der Handy-Kamera (iPhone) bzw. in Expo Go (Android) scannen.

Hinweis: Expo Go unterstützt nur die aktuelle Expo-SDK-Version. Die App nutzt SDK 58. Meldet Expo Go eine unpassende Version, Weg 2 nehmen oder einen Development Build erstellen (braucht einen Expo-Account).

## Weg 2: im Browser

Wie Weg 1, Schritt 2 und 3, dann `npx expo start --web`. Die App öffnet sich unter http://localhost:8081. Gut für den Chef-Plan am großen Bildschirm.

## Ablauf für einen Test mit dem Team

1. **Chef-Konto anlegen:** „Firma registrieren“ → „Neuer Betrieb“. Es kommt eine Bestätigungs-Mail von Supabase (englisch). Den Link anklicken: Er endet auf einer leeren Seite (`localhost`), das Konto ist trotzdem bestätigt. Dann in der App anmelden; der Betrieb mit Früh- und Spätschicht wird angelegt.
2. **Kollegen einladen:** Personal → Einladen. Die App zeigt einen **Einladungscode** (z. B. `K7MP-4QXA`), gültig 14 Tage, einmal verwendbar. „Code teilen“ schickt ihn z. B. per WhatsApp.
3. **Kollegin tritt bei:** „Firma registrieren“ → „Mit Einladungscode“ → Code, E-Mail, Passwort. Nach der Bestätigungs-Mail anmelden; sie landet im Betrieb.

### Grenze im kostenlosen Supabase-Tarif

Supabase verschickt mit dem eingebauten Mailversand **höchstens 2 Mails pro Stunde**. Jede Registrierung braucht eine Bestätigungs-Mail. Für mehr als zwei neue Konten pro Stunde gibt es zwei Wege:

- **Bestätigung für die Testphase abschalten:** Supabase-Dashboard → Authentication → Sign In / Providers → Email → „Confirm email“ aus. Konten sind dann sofort aktiv. Dem Betrieb beitreten kann trotzdem nur, wer den Einladungscode hat. Risiko: Jemand könnte ein Konto mit einer fremden E-Mail-Adresse anlegen (ohne Zugriff auf einen Betrieb). Vor dem echten Einsatz wieder einschalten.
- **Eigener Mail-Anbieter (SMTP)** oder **Pro-Tarif:** erst damit lassen sich die Mail-Texte ändern (deutsch, Code statt Link). Im kostenlosen Tarif mit eingebautem Versand sperrt Supabase das Ändern der Vorlagen.

## Was noch nicht geht

- Push-Mitteilungen aufs Handy (braucht Expo-Account); Mitteilungen erscheinen in der App an der Glocke.
- Passwort vergessen (braucht eigene Mail-Vorlagen, siehe oben).
- Schichttypen ändern (S06), Zeiten einer einzelnen Zuweisung ändern (S29), Monatsansicht, Offline-Modus.
