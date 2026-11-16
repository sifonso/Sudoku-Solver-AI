# Build-Log

Stand: 2026-11-16. Meilenstein 1 (Durchstich) laut `architecture.md`, mit Fake-Datenschicht.

## Gesamtstand

- Screens: 7 von 29 gebaut (S01, S02, S03, S04, S05, S21, S25), 22 als Stub mit Route.
- Must-haves: 1 fertig, 14 teilweise, 21 offen (von 36).
- Durchstich läuft durch: Chef meldet sich an → plant (Woche) → teilt Mira mit Warnungen ein → entfernt eine Zuweisung → Mira meldet sich an → sieht die neue Schicht und die Mitteilung. Geprüft per Playwright im Web-Build bei 390 px und 1440 px, hell und dunkel, ohne Konsolenfehler.
- Push aufs Telefon ist noch nicht drin. Bis zum Backend erscheinen Mitteilungen in der App (Glocke, S25, Banner in S21).

## Screens

| ID | Datum | Stand | Was fehlt | Was schwieriger war als gedacht |
| --- | --- | --- | --- | --- |
| S01 Registrierung | 2026-11-16 | teilweise | echtes Backend; E-Mail-Bestätigung | Firmenadresse aus Namen mit Umlauten (ä→ae, ß→ss) |
| S02 Anmeldung | 2026-11-16 | teilweise | echtes Backend; Passwort vergessen; Firmenwechsler | Sitzungswechsel: `queryClient.clear()` trennte den Sitzungs-Hook von seiner Abfrage, Login blieb hängen. Gelöst mit gezieltem Entfernen. |
| S03 Plan (Woche) | 2026-11-16 | teilweise | Monatsansicht; Abwesenheiten im Plan; Drag-and-Drop ab Tablet; Realtime | Unvollständige Rasterreihen wurden breiter; jetzt feste Spaltenbreite |
| S04 Aktionsmenü | 2026-11-16 | teilweise | „Zeiten bearbeiten“ führt auf Stub S29; „Sonderaufgabe“ fehlt | – |
| S05 Zuweisen | 2026-11-16 | teilweise | echtes Backend | Bereits Eingeteilte standen zuerst als „passt“ in der Liste; jetzt markiert und gesperrt |
| S21 Meine Schichten | 2026-11-16 | teilweise | echtes Backend; Offline-Cache | Reiter-Beschriftung „Meine Schichten“ wurde auf dem Telefon abgeschnitten, jetzt „Schichten“ |
| S25 Mitteilungen | 2026-11-16 | teilweise | Push (APNs/FCM), Einstellungen pro Typ | – |
| S06–S20, S22–S24, S26–S29 | 2026-11-16 | Stub | alles; Route und Platzhalter mit Zweck vorhanden | – |

## Technik, die nicht offensichtlich war

- Expo SDK 58 ist neuer als das Trainingswissen. APIs wurden gegen die installierten Typdefinitionen geprüft, weil docs.expo.dev in dieser Umgebung gesperrt ist. `expo install` braucht hier `EXPO_OFFLINE=1`.
- TypeScript 6 bricht bei diesem Projekt mit Stack-Überlauf ab (wahrscheinlich wegen der großen Icon-Typdatei). `npm run typecheck` setzt deshalb einen größeren Stack.
- Web-Export als Single-Page-App: Statisches Vorrendern hat Theme und Fensterbreite falsch hydriert.
- Schema ergänzt: Trigger `notify_assignment_change`. Ohne ihn hätte das echte Backend beim Zuweisen keine Mitteilung erzeugt. Mit Postgres 16 getestet.
- Zeit- und Regellogik (`src/domain`) läuft ohne React und hat eigene Tests (`npm run test:domain`, 9 Tests). Sie liefert dieselben Ergebnisse wie die SQL-Funktion `check_assignment`.

## Nicht geprüft

- Kein Lauf auf echtem iPhone oder Android-Gerät. Hier gibt es keinen Simulator, und Expo Go braucht einen Rechner mit Netzzugang zum Gerät.
- Screenreader nur über die Accessibility-Labels im Web geprüft, nicht mit VoiceOver/TalkBack.
