# Build-Log

Stand: 2026-11-16. Meilenstein 1 (Durchstich) und Meilenstein 2 (Pflicht-Screens) laut `architecture.md`. Datenschicht: Demo im Speicher oder Supabase (Projekt angebunden).

## Gesamtstand

- Screens: 23 von 29 gebaut. Als Stub mit Route offen: S06 Schichttypen, S15 Aufgaben-Log, S26 Einstellungen, S27 Profil, S28 Abo, S29 Schicht-Detail.
- Must-haves: 26 fertig, 6 teilweise, 4 offen (von 36). Stand nach Meilenstein 2.
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
| S07 Personal | 2026-11-16 | fertig | Wochensoll pro Person | Nach „Zum Team“ hing per `replace` ein zweiter Tab-Navigator im Stapel; jetzt `back` |
| S08 Mitarbeiter (+ Einladen) | 2026-11-16 | fertig | Qualifikationen, Verfügbarkeit (S27) | Letzter Chef konnte sich aussperren; jetzt DB-Trigger `keep_one_chef`. Eingeladene waren nicht einplanbar, Archivierte fielen aus dem Plan: beides korrigiert |
| S09 Krankmeldungen | 2026-11-16 | fertig | Push-Anfrage an mehrere Springer | – |
| S10 Urlaub (Team) | 2026-11-16 | fertig | – | Knöpfe in Zeilen waren über aria-disabled blockiert (BUG-004) |
| S22 Urlaub beantragen | 2026-11-16 | fertig | Feiertage je Bundesland | „0 Tage“ bei Anträgen im Folgejahr (BUG-005) |
| S23 Krank melden | 2026-11-16 | fertig | – | Mitteilung nannte „Krankmeldung“ (BUG-007, Migration) |
| S24 Schichttausch | 2026-11-16 | fertig | Angebot zurückziehen; Ablauf-Job | Chef kam über „Mehr“ nicht hin (BUG-008, Tab-Konfiguration) |
| S13 Aufgaben | 2026-11-16 | fertig | Aufgaben-Log S15 | – |
| S14 Aufgabe anlegen | 2026-11-16 | fertig | Fälligkeitszeit | Mehrfachauswahl brauchte role group (BUG-009) |
| S21 (Aufgaben) | 2026-11-16 | Checkliste fertig | Offline-Abhaken | Karte war für Screenreader ein einziges Element; Checkboxen wären auf iOS/Android nicht einzeln erreichbar gewesen |
| S16 Schnellaktionen | 2026-11-16 | fertig | Push-Erinnerung | Ordner zählte 0 Aktionen (BUG-011) |
| S17 Eintragen | 2026-11-16 | fertig | Export | `out_of_range` kam vom Gerät; jetzt bestimmt der Server per Trigger |
| S18 Ordner | 2026-11-16 | fertig | – | – |
| S19 Verwalten | 2026-11-16 | fertig | Sortieren per Ziehen | Titel in Listenzeilen gequetscht (BUG-012) |
| S20 Heute | 2026-11-16 | fertig | – | – |
| S11 Statistik | 2026-11-16 | fertig | PDF-Export | Statistik-Knopf brauchte auf 390 px zwei Tipps (BUG-013) |
| S12 Statistik-Detail | 2026-11-16 | fertig | – | – |
| S06, S15, S26–S29 | 2026-11-16 | Stub | alles; Route und Platzhalter mit Zweck vorhanden | – |

## Technik, die nicht offensichtlich war

- Expo SDK 58 ist neuer als das Trainingswissen. APIs wurden gegen die installierten Typdefinitionen geprüft, weil docs.expo.dev in dieser Umgebung gesperrt ist. `expo install` braucht hier `EXPO_OFFLINE=1`.
- TypeScript 6 bricht bei diesem Projekt mit Stack-Überlauf ab (wahrscheinlich wegen der großen Icon-Typdatei). `npm run typecheck` setzt deshalb einen größeren Stack.
- Web-Export als Single-Page-App: Statisches Vorrendern hat Theme und Fensterbreite falsch hydriert.
- Schema ergänzt: Trigger `notify_assignment_change`. Ohne ihn hätte das echte Backend beim Zuweisen keine Mitteilung erzeugt. Mit Postgres 16 getestet.
- Zeit- und Regellogik (`src/domain`) läuft ohne React und hat eigene Tests (`npm run test:domain`, 9 Tests). Sie liefert dieselben Ergebnisse wie die SQL-Funktion `check_assignment`.

## Nicht geprüft

- Kein Lauf auf echtem iPhone oder Android-Gerät. Hier gibt es keinen Simulator, und Expo Go braucht einen Rechner mit Netzzugang zum Gerät.
- Screenreader nur über die Accessibility-Labels im Web geprüft, nicht mit VoiceOver/TalkBack.
