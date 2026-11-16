# Bugs

Gefunden mit der Testsuite am 2026-11-16 (Build e649836 bis b014bd4). Fehler aus den Durchstich-Läufen davor stehen in `build-log.md`.

Offen: S1 0 · S2 0 · S3 0 · S4 0. Behoben: 3 (alle S3).

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

## Zu prüfen (nicht reproduziert)

- **Mitarbeiterin ruft /plan direkt per URL auf.** Vermutung: Mit Supabase sähe sie den Planer-Screen mit Zuweisen-Knöpfen; das Zuweisen selbst lehnt die Datenbank ab (LIVE-05). Im Demo-Modus nicht reproduzierbar, weil Neuladen die Sitzung verwirft. Vorsorglich in e3713d6 eine Rollenprüfung in S03 und S05 eingebaut (Umleitung auf /meine). Prüfen mit einem echten Mitarbeiterkonto in der Supabase-Variante.
- **Abgelaufene Sitzung** auf einem Gerät, das länger im Hintergrund war. Auto-Refresh ist eingebaut (`startAutoRefresh` im Vordergrund), aber noch nicht auf einem Gerät beobachtet.
- **Web-Bundle 2,3 MB** (Icon-Bibliothek komplett). Kein Fehler, aber Ladezeit; in `components.md` vermerkt.
