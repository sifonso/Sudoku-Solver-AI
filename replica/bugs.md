# Bugs

Gefunden mit der Testsuite am 2026-11-16 (Build e649836 bis b014bd4). Fehler aus den Durchstich-Läufen davor stehen in `build-log.md`.

Offen: S1 0 · S2 0 · S3 0 · S4 0. Behoben: 13 (S2: 3, S3: 9, S4: 1).

### BUG-001: Checkbox meldet ihren Zustand nicht, solange sie nicht angehakt ist

- Severity: S3
- Flow / case: F01 / A11Y-S01
- Screen: S01
- Build: b014bd4  Browser / device: Chromium 1243, 390 px und 1440 px

Steps
1. /registrieren öffnen
2. „Betrieb anlegen“ ohne Eingaben drücken
3. axe (WCAG 2.1 AA) ausführen

Expected: Element mit `role="checkbox"` hat `aria-checked="false"`.
Actual: `aria-checked` fehlt. axe meldet `aria-required-attr` (critical). Screenreader können „nicht angehakt“ nicht ansagen.
Evidence: Test A11Y-S01 rot, Knoten `<div aria-label="Ich akzeptiere AGB und Datenschutzerklärung." role="checkbox" tabindex="0">`.
Suspected cause: React Native Web lässt das Attribut weg, wenn `accessibilityState.checked` false ist.
Status: fixed in e3713d6 (`aria-checked` wird ausdrücklich gesetzt, `src/ui/Field.tsx`)

### BUG-002: Mitarbeiter-Kärtchen hat einen anderen Namen als seinen sichtbaren Text

- Severity: S3
- Flow / case: F02 / A11Y-S03
- Screen: S03
- Build: b014bd4  Browser / device: Chromium 1243, 390 px und 1440 px

Steps
1. Als Demo-Chef anmelden
2. axe auf dem Plan ausführen

Expected: Der zugängliche Name enthält den sichtbaren Text (WCAG 2.5.3 „Label in Name“), damit Sprachsteuerung „LK“ oder „Lena Kraus Vollzeit“ findet.
Actual: Name war „Lena Kraus, Vollzeit“, sichtbar ist „LK Lena Kraus Vollzeit“. axe meldet `label-content-name-mismatch` (serious), 6 Treffer.
Evidence: Test A11Y-S03 rot.
Status: fixed in e3713d6 (kein eigenes Label mehr, der Name kommt aus dem Inhalt, `src/ui/Badge.tsx`)

### BUG-003: Knopf „Zuweisen“ hat ein Label ohne das Wort „Zuweisen“

- Severity: S3
- Flow / case: F02 / A11Y-S03
- Screen: S03
- Build: b014bd4 (nach Fix von BUG-002)  Browser / device: Chromium 1243, 390 px und 1440 px

Steps
1. Als Demo-Chef anmelden
2. axe auf dem Plan ausführen

Expected: Der Name enthält den sichtbaren Text „Zuweisen“.
Actual: Name war „Mitarbeiter zu Frühschicht hinzufügen“. axe meldet `label-content-name-mismatch`: 2 Treffer bei 390 px, 8 bei 1440 px.
Evidence: Test A11Y-S03 rot nach dem Fix von BUG-002.
Status: fixed in e3713d6 (Name jetzt „Zuweisen: Frühschicht“, `src/ui/Plan.tsx`)

### BUG-004: Knöpfe in Listenzeilen ohne eigene Aktion sind nicht bedienbar

- Severity: S3
- Flow / case: F05 / F05-E2
- Screen: S22 (betrifft jede ListRow ohne onPress mit Knopf im trailing)
- Build: e3713d6+ (M2 in Arbeit)  Browser / device: Chromium 1243, 390 und 1440 px

Steps
1. Als Mira Urlaub beantragen
2. In „Meine Anträge“ auf „Zurückziehen“ tippen

Expected: Antrag wird zurückgezogen.
Actual: Knopf reagiert nicht. Die Zeile ist ein deaktivierter Pressable mit `aria-disabled`, das an den Knopf vererbt wird; Screenreader melden ihn als deaktiviert.
Evidence: Test F05-E2 (Timeout „waiting for element to be visible, enabled and stable“).
Status: fixed in 27a6f77 (ListRow ohne Aktion ist eine einfache View, `src/ui/Layout.tsx`)

### BUG-005: Antrag im Folgejahr zeigt „0 Tage“

- Severity: S3
- Flow / case: F05 / F05-H1
- Screen: S22, S10
- Build: wie BUG-004

Steps
1. Urlaub 02.03.–06.03. des Folgejahres beantragen

Expected: „5 Tage“.
Actual: „0 Tage“. Die Tagesanzeige pro Antrag schnitt auf das laufende Jahr zu.
Evidence: Screenshot zu F05-E2, Test F05-H1 erweitert.
Status: fixed in 27a6f77 (`daysOf` zählt den ganzen Antrag, `src/features/vacation.ts`)

### BUG-006: Datumsfelder behalten nach dem Absenden ihre Werte

- Severity: S4
- Flow / case: F05 / F05-H1
- Screen: S22, S10 (Sperren)

Expected: Formular ist nach erfolgreichem Absenden leer.
Actual: Datumsfelder zeigten weiter den abgeschickten Zeitraum.
Status: fixed in 27a6f77 (Felder werden neu aufgebaut)

### BUG-007: Mitteilung zur Krankmeldung verrät Gesundheitsdaten im Push

- Severity: S2 (Datenschutz)
- Flow / case: F06 / F06-H1
- Screen: Mitteilungen der Planer, später Push
- Build: Schema-Migration `init` (Projekt seit 2026-11-16)

Steps
1. Mitarbeiterin meldet sich krank (`report_sick`)
2. Mitteilung beim Chef ansehen

Expected: Laut architecture.md neutraler Text ohne Gesundheitsbezug, weil Mitteilungen als Push über Expo, Apple und Google gehen.
Actual: Titel „Krankmeldung“.
Evidence: Code-Lesung der Funktion `report_sick`, jetzt durch F06-H1 und LIVE-05c abgesichert.
Status: fixed in Migration `absence_privacy` (live eingespielt): Titel „Neue Abwesenheit“, Text „Bitte den Plan prüfen.“, ohne Namen

### BUG-008: Chef erreicht Schichttausch, Schnellaktionen und eigene Schichten nicht

- Severity: S2
- Flow / case: F07 / F07-E0
- Screen: Mehr → S24, S16, S21 (Rolle Chef)
- Build: 6. M2-Commit  Browser / device: Chromium 1243, 390 und 1440 px

Steps
1. Als Chef anmelden
2. Mehr → „Schichttausch“

Expected: S24 öffnet sich.
Actual: Die App bleibt auf dem Plan. Für Rollen ausgeblendete Reiter waren mit `href: null` konfiguriert; damit ist die Route nicht nur unsichtbar, sondern unerreichbar.
Evidence: Screenshot zu F07-H2 (Plan statt Tausch), Regressionstest F07-E0.
Status: fixed in 52c27bf (nur die Schaltfläche in der Tab-Leiste wird ausgeblendet, `src/app/(app)/(tabs)/_layout.tsx`)

### BUG-009: Mehrfachauswahl hat eine Listen-Rolle ohne Listeneinträge

- Severity: S3
- Flow / case: F08 / A11Y-S13/S14
- Screen: S14 (Schichttypen, Wochentage)

Expected: Gruppe von Checkboxen mit Namen (role group).
Actual: Container mit role list, Kinder sind checkboxes. axe meldet `aria-required-children` (critical), 2 Treffer.
Evidence: Test A11Y-S13/S14 rot.
Status: fixed in 7150980 (`role="group"`, `src/ui/Navigation.tsx`)

### BUG-010: Kacheln haben ein Label, das nicht zum sichtbaren Text passt

- Severity: S3
- Flow / case: F09 / A11Y-S16
- Screen: S16, S18

Actual: Label „Reinigung, 2 Aktionen“, sichtbar zusätzlich „Fällig“; axe `label-content-name-mismatch` (5 Treffer).
Status: fixed in 10d1f19 (Name aus dem Inhalt, `src/ui/Tiles.tsx`)

### BUG-011: Ordner-Kachel zählt 0 Aktionen und wird nie fällig

- Severity: S3
- Flow / case: F09 / F09-H1
- Screen: S16

Steps
1. Als Mira Schnellaktionen öffnen

Expected: „Reinigung 2 Aktionen“.
Actual: „Reinigung 0 Aktionen“. Die Startseite gab nur Aktionen ohne Ordner ins Raster, das daraus auch den Ordnerinhalt zählte. Fällige Aktionen im Ordner hätten die Kachel nie markiert.
Evidence: Accessibility-Snapshot `button "Reinigung 0 Aktionen"`.
Status: fixed in 10d1f19 (`src/features/QuickGrid.tsx`)

### BUG-012: Listenzeilen quetschen den Titel auf Buchstabenbreite

- Severity: S3
- Flow / case: F09 / F09-H4
- Screen: S19 (betrifft jede ListRow mit breiten Aktionen, 390 px)

Expected: Titel lesbar, Aktionen notfalls in der nächsten Zeile.
Actual: Titel „Kühlung“ stand senkrecht, ein Buchstabe pro Zeile.
Evidence: Screenshot zu F09-H4 (Telefon).
Status: fixed in 10d1f19 (Mindestbreite und Umbruch in `ListRow`; Icon-Knöpfe in S19); Test prüft Titelbreite

### BUG-013: Erster Tipp auf einen Knopf geht verloren, wenn er knapp in die Zeile passt

- Severity: S2
- Flow / case: F10 / P-E2
- Screen: S07 „Statistik“ bei 390 px (betrifft jeden Button mit Rahmen am Zeilenende)

Steps
1. Als Chef Personal öffnen (390 px breit)
2. „Statistik“ einmal antippen

Expected: S11 öffnet sich.
Actual: Nichts passiert, erst der zweite Tipp wirkt. Beim Drücken bekam der Knopf den Fokus, der Rahmen wuchs von 1 auf 2 px, der Knopf brach in die nächste Zeile um und das Loslassen landete daneben. Kein History-Aufruf protokolliert.
Evidence: Debug-Lauf mit `history.pushState`-Spion; Bounding-Box vor/nach Fokus unterschiedlich.
Status: fixed in b15a9eb (Fokusring als Outline ohne Layout-Änderung, `src/ui/Button.tsx`; Eingabefeld gleicht Rahmen über Padding aus); Regressionstest P-E2 vergleicht Bounding-Box

## Zu prüfen (nicht reproduziert)

- **Mitarbeiterin ruft /plan direkt per URL auf.** Vermutung: Mit Supabase sähe sie den Planer-Screen mit Zuweisen-Knöpfen; das Zuweisen selbst lehnt die Datenbank ab (LIVE-05). Im Demo-Modus nicht reproduzierbar, weil Neuladen die Sitzung verwirft. Vorsorglich in e3713d6 eine Rollenprüfung in S03 und S05 eingebaut (Umleitung auf /meine). Prüfen mit einem echten Mitarbeiterkonto in der Supabase-Variante.
- **Abgelaufene Sitzung** auf einem Gerät, das länger im Hintergrund war. Auto-Refresh ist eingebaut (`startAutoRefresh` im Vordergrund), aber noch nicht auf einem Gerät beobachtet.
- **Web-Bundle 2,3 MB** (Icon-Bibliothek komplett). Kein Fehler, aber Ladezeit; in `components.md` vermerkt.
- **LIVE-07 einmal ohne HTTP-Status** (2026-11-16): `delete-account` lieferte beim ersten Lauf nach Einspielen der Abwesenheits-Tests kein 409, beim nächsten Lauf schon. Vermutlich Netzwerkfehler beim Funktionsaufruf; der Test gibt jetzt die Antwort aus, falls es wieder passiert.
