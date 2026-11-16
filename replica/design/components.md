# Komponenten

Quelle der Werte: `tokens.json` → `build_tokens.py` → `app/src/theme/tokens.ts` und `tokens.css`.
Code: `app/src/ui/`. Live-Ansicht: Route `/design` (Dunkel erzwingen: `/design?scheme=dark`).
Screenshots: `replica/design/screens/` (Telefon 390 px hell/dunkel, Tablet 1024 px).
Kontrast: 44 Farbpaare geprüft, 0 unter WCAG AA (`python3 contrast.py tokens.json`).

## Gestaltungsregeln

Die Farbwelt kommt aus der Vorlage des Nutzers und besteht aus vier Paaren mit je einem dunklen und einem hellen Ton: Dark Blue + Lavender, Orange + Beige, Burgundy + Rose, Moos + Mint. Weiß ist die Grundfläche.

| Rolle | Farbpaar | Wofür |
| --- | --- | --- |
| accent | Dark Blue / Lavender | Hauptaktionen, „Heute“, Vollzeit |
| highlight | Orange / Beige | Unterbesetzung, Warnungen, Fälligkeit, aktiver Reiter, Aushilfe |
| danger | Burgundy / Rose | Löschen, Ablehnen, Fehler |
| success | Moos / Mint | Genehmigt, erledigt, Teilzeit |

Orange ist nie Textfarbe auf Weiß, weil das nur 3,06:1 erreicht. Auf orangen Flächen steht Dark Blue (4,66:1). Wo Orange als Schrift nötig ist, gilt das dunklere `on-highlight-soft` #A84E12.

Burgundy ist kein Signalrot. Löschen ist deshalb immer zusätzlich durch Text oder ein Icon erkennbar und bei endgültigen Aktionen durch eine Bestätigung abgesichert.

Bei den Mustern gibt es drei eigene Formen: `zacken`, `streifen` und `pfeile`. Sie sind immer zweifarbig aus einem Paar und rein dekorativ, also für Screenreader versteckt. Text steht nie direkt auf einem Muster, sondern auf ruhiger Fläche daneben oder darüber. Einsatz: Streifen am „Heute“-Tag, Bänder auf Schnellaktions-Kacheln, Kopf von Onboarding und Login.

Fotos aus der Vorlage (Flughafen, Flugzeuge, Personen) sind fremde Bilder und kommen nicht in die App. Die App-Oberfläche arbeitet ohne Fotos. Für Store-Screenshots und die Website gilt der Stil der Vorlage: hell, viel Himmel, Dämmerungslicht, Menschen in Alltagskleidung. Dafür kommen nur eigene oder lizenzierte Bilder in Frage.

Schrift: Barlow Semi Condensed für Titel und Versalien-Labels mit Sperrung, Inter für Fließtext und Bedienelemente. Beide stehen unter der SIL Open Font License.

Icons: Lucide (ISC-Lizenz), Strichstärke 2, Größe 18–24. Die Icons werden einzeln importiert, damit nicht die ganze Bibliothek im Bundle landet (siehe „Offene Punkte“).

Trefferflächen sind mindestens 44 × 44 pt. Kacheln für das Tablet im Betrieb sind mindestens 148 pt hoch.

## Bausteine

```
Text
  variants  display 40, xl 28, lg 20 (Barlow), base 16, sm 14, xs 12 (Inter), label 12 Versalien +1.2 Sperrung (Barlow)
  tokens    Farbe nur über Rolle (text, text-muted, on-*), nie Hex
  a11y      Titel mit accessibilityRole="header"; Schrift skaliert mit der Systemeinstellung
  used on   alle
```

```
Button
  variants  primary (accent), secondary (Rahmen border-input), ghost, highlight (Orange, Dark-Blue-Schrift), danger (Burgundy)
  sizes     sm 36, md 44, lg 52
  states    default, pressed (Deckkraft 0,85), focus-visible (2 px Rahmen focus), disabled (0,5), loading (Spinner statt Icon, Label bleibt)
  tokens    radius md 8, Schrift sm/600, Abstand Icon–Text 8
  a11y      role button, accessibilityState disabled/busy; Label bleibt beim Laden für Screenreader erhalten
  used on   S01, S07, S08, S10, S13, S14, S17, S22, S28
```

```
IconButton
  variants  plain, soft (surface), onAccent (auf dunkler Fläche); optional Punkt-Badge (ungelesen)
  size      44 × 44, Icon 20
  a11y      label ist Pflicht, z. B. "Mo 16.11.2026 drucken"
  used on   S03 Drucken, Header Glocke (S25), Einstellungen (S26), Monatswechsel S11
```

```
TextField
  states    default, focus (2 px focus), error (2 px danger + Fehlertext darunter), disabled (surface)
  parts     Versalien-Label oben, Hinweis oder Fehler unten
  tokens    Höhe 48, radius md, Rahmen border-input (3,87:1 auf Weiß)
  a11y      accessibilityLabel = Label, Fehler als accessibilityHint; Fehler nie nur über die Farbe
  used on   S01, S02, S08, S14, S17, S19, S22, S27
```

```
Checkbox
  states    an, aus, disabled
  size      Kästchen 24, Trefferfläche 44 hoch inkl. Text
  a11y      role checkbox, state checked
  used on   S13 "Gelöschte anzeigen", S21 Aufgabe erledigt, S26 Einstellungen
```

```
SegmentedControl
  use       2–4 gleichrangige Ansichten
  states    aktiv (accent-Fläche), inaktiv
  a11y      radiogroup mit radio-Elementen
  used on   S03 Woche/Monat, S13 Standard/Sonder
```

```
Tabs
  states    aktiv (3 px Unterstrich highlight + 600), inaktiv (text-muted); optionale Zahl "(3)"
  a11y      tablist / tab, state selected
  used on   S07–S11 Personal, S13/S15 Aufgaben
```

```
Badge
  tones     neutral, accent, highlight, danger, success
  tokens    label-Typo, radius sm, Fläche *-soft mit on-*-soft
  used on   Admin (S07), STANDARD/SONDER (S13), Antragsstatus (S10, S24)
```

```
Avatar
  variants  nach Beschäftigungsart: vollzeit (Lavender), teilzeit (Mint), aushilfe (Beige)
  content   Kürzel 1–4 Zeichen
  a11y      versteckt, weil der Name immer daneben steht
  used on   S07, S11, S20, ListRow
```

```
EmployeeChip
  parts     Kürzel-Kästchen, Name, Beschäftigungsart oder Warnung
  states    default, selected (Rahmen focus), warning (Rahmen highlight + Text "⚠ Ruhezeit unter 11 h"), pressed
  a11y      Label "Name, Vollzeit, Warnung: …"; Art und Warnung stehen als Text da, nicht nur als Farbe
  used on   S03, S05, S20
```

```
DayCard
  variants  normal (surface), Wochenende (highlight-soft), heute (accent + Zackenstreifen + "· Heute")
  parts     Tageszahl display, Wochentag-Label, Datum, Drucken
  layout    Telefon: Liste; Tablet ab 768: 3 Spalten; Desktop: 7
  used on   S03
```

```
ShiftBlock
  parts     Name lg, Uhrzeit mit Icon, Besetzung "1/2 · fehlt", Liste der Chips, Zuweisen-Feld (gestrichelt)
  states    besetzt, unterbesetzt (Rahmen highlight + Text "fehlt"), leer
  a11y      Zuweisen-Feld mit Label "Mitarbeiter zu Frühschicht hinzufügen"
  used on   S03, S20
```

```
ActionSheet / SheetContent
  use       Aktionsmenü einer Zuweisung; Telefon Bottom Sheet, Tablet/Web später als Popover
  parts     Griff, Versalien-Titel, Zeilen mit Icon-Kachel; destruktive Zeile in danger
  a11y      Scrim mit Label "Menü schließen"; Android-Zurück schließt (onRequestClose)
  used on   S04, S05
```

```
ActionTile
  pairs     lavender, orange, burgundy, moos
  parts     Musterband oben, Icon-Kachel, Titel lg, Untertitel, optional "Fällig"
  size      min. 148 hoch, min. 150 breit, 2 Spalten Telefon, 3–4 Tablet
  a11y      Label "Kühlung, Temperatur eintragen, fällig"
  used on   S16, S18
```

```
Card, PageHeader, SectionHeader, ListRow
  Card      surface-raised, Rahmen border, radius lg 12, Schatten card
  PageHeader Versalien-Eyebrow (on-highlight-soft), Titel xl, Untertitel, Aktion rechts; bricht auf dem Telefon um
  ListRow   min. 64 hoch, Haarlinie unten, leading/trailing frei
  used on   alle Listen-Screens (S07, S09, S10, S15, S25)
```

```
Banner (auch Toast)
  tones     info, success, warning, danger, offline
  a11y      role alert, accessibilityLiveRegion polite
  used on   Offline-Hinweis global, Konflikt beim Zuweisen, Speichern-Fehler, Genehmigungen
```

```
EmptyState
  parts     Icon-Kachel accent-soft, Titel lg, Text, optionale Aktion zentriert
  required  jede Liste hat einen; Texte erklären, wie sich die Liste füllt
  used on   S07, S09, S10, S13, S15, S16, S21, S24, S25
```

## Noch zu bauen (mit den Screens in `/replica-build`)

| Baustein | Für | Hinweis |
| --- | --- | --- |
| Datum- und Zeitwähler | S06, S14, S22 | Nativer Picker auf iOS/Android, auf dem Web eigenes Feld |
| Mitarbeiter-Auswahl mit Warnungen | S05 | Bottom Sheet, sortiert nach „keine Warnung zuerst“ |
| Datentabelle | S11 | Auf dem Telefon als Kartenliste, ab Tablet als Tabelle |
| Monatsraster | S03 Monat | 7 Spalten, Zellen mit Besetzungspunkten |
| Tab-Leiste unten | App-Rahmen | 56 hoch, 4–5 Ziele je nach Rolle |
| Ladeskelett | alle Listen | Flächen in surface, ohne Animation bei „Bewegung reduzieren“ |

## Offene Punkte

- Das Design-Bundle für das Web ist 2,3 MB groß. Die Ursache ist wahrscheinlich, dass die Icon-Bibliothek komplett mitkommt. Vor dem Release werden die Icons einzeln importiert und die Größe wird erneut gemessen.
- TypeScript 6 läuft mit der Typdatei der Icon-Bibliothek in einen Stack-Überlauf. Das `typecheck`-Skript ruft tsc deshalb mit `--stack-size=8000` auf.
- Der Web-Export läuft als Single-Page-App (`web.output: "single"`). Statisches Vorrendern brachte Theme und Fensterbreite durcheinander, weil das HTML ohne beides gerendert wird.
