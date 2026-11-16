# Recon map: Schichtenmanager (Web/PWA → native iOS + Android)

Scope: das komplette Produkt (Schichtplanung, Personal, Abwesenheiten, Schichttausch, Aufgaben, Schnellaktionen, Benachrichtigungen, Statistiken, Rollen). Es ist klein genug, um es nicht weiter zu schneiden.
Für: neue Version als native App für iOS und Android (Store-Distribution statt PWA).
Datum: 2026-11-16

Grundlage sind ausschließlich die öffentliche Website, die AGB, das Impressum und fünf öffentliche Produkt-Screenshots. Kein Account, kein App-Code, keine API-Mitschnitte. Alles, was nur im eingeloggten Bereich sichtbar wäre, ist als „abgeleitet“ markiert.

Anbieter laut Impressum: Christian Troffmann, TroCoding (Einzelunternehmer), Cloppenburg. Die AGB (Stand 04.02.2026) enthalten keine Klausel gegen den Nachbau oder Wettbewerb; § 11 behält nur die Rechte an der Software selbst beim Anbieter. Falls du selbst der Anbieter bist, entfällt die Clean-Room-Einschränkung und der eigene Code/die eigene API ist die bessere Quelle als diese Recon.

## Sources

| # | source | URL | notes |
| --- | --- | --- | --- |
| 1 | Startseite inkl. Features, Preise, FAQ | https://schichtenmanager.de/#features | 10 Feature-Kacheln, 4 Tarife, 8 FAQ |
| 2 | Feature: Schichtplanung | https://schichtenmanager.de/schichtplanung/ | Screenshot Kalenderansicht |
| 3 | Feature: Mitarbeiterverwaltung | https://schichtenmanager.de/mitarbeiterverwaltung/ | Screenshot Personal-Übersicht |
| 4 | Feature: Abwesenheiten | https://schichtenmanager.de/abwesenheiten/ | Urlaubssperren, Resturlaub |
| 5 | Feature: Schichttausch | https://schichtenmanager.de/schichttausch/ | Angebot → Bewerbung → Genehmigung |
| 6 | Feature: Aufgabenverwaltung | https://schichtenmanager.de/aufgabenverwaltung/ | Screenshot Aufgabenverwaltung |
| 7 | Feature: Schnellaktionen | https://schichtenmanager.de/schnellaktionen/ | Screenshot Kachel-Startseite |
| 8 | Feature: Benachrichtigungen | https://schichtenmanager.de/benachrichtigungen/ | Push, In-App, E-Mail |
| 9 | Feature: Statistiken | https://schichtenmanager.de/statistiken/ | Screenshot Schicht-Statistik |
| 10 | Feature: Mobile App (PWA) | https://schichtenmanager.de/mobile-app/ | „Keine App-Store Downloads nötig“ |
| 11 | Feature: Rollen & Rechte | https://schichtenmanager.de/rollen-rechte/ | 4 Rollen |
| 12 | Branche Pflege | https://schichtenmanager.de/branchen/pflege/ | Ruhezeiten, Springer, Übergabe |
| 13 | Branche Gastronomie | https://schichtenmanager.de/branchen/gastronomie/ | HACCP, Event-Schichten, Inventur |
| 14 | Branche Einzelhandel | https://schichtenmanager.de/branchen/einzelhandel/ | Multi-Filiale, Minijob-Stunden |
| 15 | Branche Produktion | https://schichtenmanager.de/branchen/produktion/ | 3-Schicht-Rotation, Überstunden |
| 16 | Registrierung | https://schichtenmanager.de/register/ | Formularfelder inkl. Subdomain |
| 17 | AGB | https://schichtenmanager.de/agb/ | Trial-, Lösch- und Kündigungsfristen |
| 18 | Impressum | https://schichtenmanager.de/impressum/ | Anbieter |

Nicht gefunden: Help Center, Changelog, öffentliche API-Doku, App-Store-/Play-Listing (gibt es nicht, das Produkt ist bewusst nur PWA), Walkthrough-Videos. Eine Websuche nach „schichtenmanager.de“ lieferte keinen Treffer zur Domain, also auch keine Reviews.

## Core loop

Der Chef legt Schichttypen an und zieht Mitarbeiter in den Kalender; die Mitarbeiter sehen ihre Schichten sofort auf dem Handy, bekommen Push bei Änderungen und arbeiten die an die Schicht gehängten Aufgaben ab.

## Wichtige Beobachtungen für die native Version

Die heutige App ist eine PWA (Startseite, /mobile-app/). Push auf iOS funktioniert dort nur nach „Zum Homescreen hinzufügen“, das ist die größte Reibung, die eine native App beseitigt. Gleichzeitig wirbt die Website mit „Keine App-Store Downloads nötig“; die neue Version ändert also die Positionierung.

Mandantenfähigkeit läuft über eine eigene Subdomain pro Firma (Registrierungsformular: „Ihre Subdomain“). Eine native App braucht dafür einen Workspace-Picker oder Login per E-Mail mit Firmen-Lookup.

Der Planungs-Screen ist erkennbar für Desktop gebaut (3 Tagesspalten nebeneinander, Drag-and-Drop). Auf dem Telefon muss Planung anders funktionieren (Tagesliste + Zuweisen per Bottom Sheet). Tablet kann das Spaltenlayout behalten.

Die Schnellaktionen-Startseite (große farbige Kacheln, „Heute: Wer arbeitet heute?“) sieht nach einem fest installierten Tablet im Betrieb aus. Ein Kiosk-/Gerätemodus ist daher wahrscheinlich ein eigener Nutzungsfall (abgeleitet, nicht belegt).

Abrechnung: Tarife werden pro Monat im Voraus per Kreditkarte/SEPA bezahlt (AGB § 4). Für die Store-Apps die Buchung im Web lassen und die App nur als Zugang zum bestehenden Konto ausliefern; Kauf-Buttons in der iOS-App würden Apples In-App-Purchase-Regeln auslösen.

## Screens

Status: „gesehen“ = auf Screenshot oder Website sichtbar. „abgeleitet“ = aus Text erschlossen.

| ID | screen | route / how to reach | purpose | key components | states seen |
| --- | --- | --- | --- | --- | --- |
| S01 | Registrierung | /register | Firma + Instanz anlegen, Trial starten | Felder Subdomain, Firmenname, Name, E-Mail, Passwort ×2, Honeypot „Website“, Checkbox Datenschutz/AGB | gesehen: leer |
| S02 | Login / Workspace wählen | {subdomain}.schichtenmanager.de (abgeleitet) | Anmeldung in die Firmeninstanz | E-Mail, Passwort, Subdomain | abgeleitet |
| S03 | Schichtplan (Monat/Woche) | Hauptnavigation | Schichten sehen und zuweisen | Monatstitel, Vorheriger/Nächster, Segment Monat/Woche, Tageskarte (Datum, Wochentag, „HEUTE“-Badge, Drucken-Button), Schicht-Block (Name, Uhrzeit), Mitarbeiter-Chip (Initialen-Avatar, Name, Kürzel, Farbe nach Beschäftigungsart) | gesehen: gefüllt, Wochenende farbig hinterlegt, heutiger Tag blau |
| S04 | Zuweisungs-Kontextmenü | Tap/Klick auf Mitarbeiter-Chip in S03 | Zuweisung bearbeiten | Popover mit Name, „Sonderaufgabe“, „Zeiten bearbeiten“, „Zuweisung löschen“ (rot) | gesehen |
| S05 | Mitarbeiter zuweisen | Drag-and-Drop in S03; mobil: Sheet (abgeleitet) | Mitarbeiter auf Schicht setzen, Konflikte sehen | Mitarbeiterliste gefiltert nach Verfügbarkeit/Qualifikation, Konfliktwarnung (Überschneidung, Ruhezeit, Abwesenheit) | abgeleitet: Warnung |
| S06 | Schichttypen & Vorlagen | Einstellungen (abgeleitet) | Schichttypen mit Zeiten/Wochentagen, Wochenvorlagen | Liste, Formular Name/Start/Ende/Wochentage/Qualifikation | abgeleitet (Namen wie „Di.-Fr. Frühschicht“ belegen Wochentagsbindung) |
| S07 | Personal › Übersicht | Personal, Tab „Übersicht“ | Mitarbeiterliste | Header „Mitarbeiterverwaltung · 6 aktiv“, Button „Neuer Mitarbeiter“, Gruppen „Vollzeit-Mitarbeiter“ / „Aushilfen“ mit Zähler, Zeile: Avatar, Name, Admin-Badge, „Keine feste Schicht konfiguriert“, Buttons Bearbeiten/Sperren/Entfernen | gesehen: gefüllt |
| S08 | Mitarbeiter anlegen/bearbeiten | „Neuer Mitarbeiter“ / „Bearbeiten“ | Stammdaten | Name, Kontakt, Kürzel, Beschäftigungsart, Rolle, feste Schicht, Qualifikationen, Stundenkontingent, Verfügbarkeit, Archivieren | abgeleitet |
| S09 | Personal › Krankmeldungen | Tab „Krankmeldungen“ | Krankmeldungen sehen, Ersatz planen | Liste, betroffene Schichten, „Ersatz finden“ | Tab gesehen, Inhalt abgeleitet |
| S10 | Personal › Urlaub | Tab „Urlaub“ | Anträge genehmigen, Übersicht, Resturlaub | Antragsliste mit Genehmigen/Ablehnen, Kalenderübersicht, Urlaubssperren | Tab gesehen, Inhalt abgeleitet |
| S11 | Personal › Schicht-Statistik | Tab „Schicht-Statistik“ | Schichten und Stunden pro Monat | Monatswähler ‹ Januar 2026 ›, Export-Button, Tabelle Mitarbeiter/Kürzel/Typ/Schichten/Stunden/Details | gesehen: gefüllt |
| S12 | Statistik-Detail | „Details“ in S11 | Einzelauswertung pro Mitarbeiter | Schichtliste, Stunden, Abwesenheiten | abgeleitet |
| S13 | Aufgaben › Verwaltung | Aufgaben, Tab „Verwaltung“ | Standard- und Sonderaufgaben pflegen | Button „Neue Aufgabe“, Segment „Standard-Aufgaben (3)“ / „Sonderaufgaben (3)“, Checkbox „Gelöschte anzeigen“, Aufgabenkarte (Titel, Badge STANDARD, Schichttyp-Tags, Zähler, Bearbeiten/Löschen) | gesehen: gefüllt |
| S14 | Aufgabe anlegen/bearbeiten | „Neue Aufgabe“ | Aufgabe definieren | Titel, Typ, Schichttypen, Wiederholung, Priorität, Fälligkeit | abgeleitet |
| S15 | Aufgaben-Log | Tab „Aufgaben-Log“ | Wer hat was wann erledigt | Liste mit Filter | Tab gesehen, Inhalt abgeleitet |
| S16 | Schnellaktionen-Startseite | Startseite für Mitarbeiter/Tablet (abgeleitet) | Tägliche Protokolle mit einem Tap | Kachelraster: Aktion (Emoji, Farbe, „Tippen zum Eintragen“), Ordner („5 Aktionen“), „Heute“, „Aufgaben“ | gesehen: gefüllt |
| S17 | Schnellaktion eintragen | Tap auf Aktionskachel | Messwert(e) erfassen | Formular aus frei definierten Messfeldern, Speichern mit Zeitstempel | abgeleitet |
| S18 | Schnellaktionen-Ordner | Tap auf Ordnerkachel | Untergruppe von Aktionen | Kachelraster | abgeleitet |
| S19 | Schnellaktionen verwalten | Admin (abgeleitet) | Aktionen/Felder/Farben/Icons/Erinnerungen definieren | Formular, Feld-Editor | abgeleitet |
| S20 | Heute | Kachel „Heute“ | Wer arbeitet heute | Liste nach Schicht | Kachel gesehen |
| S21 | Meine Schichten / Meine Aufgaben | Mitarbeiter-Start (abgeleitet) | eigene Schichten und Aufgaben, abhaken | Liste, Checkbox | abgeleitet |
| S22 | Urlaub beantragen | Mitarbeiter | Antrag stellen | Zeitraum, Kommentar, Resturlaub | abgeleitet |
| S23 | Krankmelden | Mitarbeiter | Ein-Klick-Krankmeldung | Bestätigung, Zeitraum | abgeleitet |
| S24 | Schichttausch | Mitarbeiter + Chef | Schicht anbieten, bewerben, genehmigen | Tauschbörse, Status | abgeleitet |
| S25 | Benachrichtigungen | Glocke oben rechts | In-App-Benachrichtigungszentrale | Liste, gelesen/ungelesen | Glocke gesehen |
| S26 | Einstellungen | Zahnrad (abgeleitet) | Benachrichtigungen, Tausch-Genehmigung, Sichtbarkeit Gesamtplan, Urlaubssperren, Branding (Professional) | Formulare | abgeleitet |
| S27 | Profil & Verfügbarkeit | Mitarbeiter | Self-Service eigene Daten und Verfügbarkeit | Formular, Wochenraster | abgeleitet |
| S28 | Abo & Export | Chef | Tarif, Rechnungen, Datenexport (AGB § 8 Abs. 4) | Tarifkarten, Export | abgeleitet |
| S29 | Übergabe-Protokoll | Schicht-Detail (Branchenseiten Pflege/Produktion) | Infos an die nächste Schicht | Textnotiz pro Schicht | abgeleitet |

## Flows

```
F01 Firma registriert sich und erstellt den ersten Plan
    S01 -> S02 -> S06 (Schichttypen) -> S08 (Mitarbeiter anlegen) -> S03 -> S05
    happy path clicks: unbekannt, Ziel ≤ 15 bis zur ersten Zuweisung
    edge: Subdomain vergeben, Trial nach 14 Tagen abgelaufen (Zugang eingeschränkt, Daten 90 Tage gehalten)

F02 Chef plant eine Woche
    S03 (Woche) -> S05 pro Schicht -> automatische Push an Betroffene
    edge: Konflikt Überschneidung, Ruhezeit unterschritten, Mitarbeiter abwesend, Qualifikation fehlt, Vorlage anwenden statt einzeln

F03 Zuweisung ändern
    S03 -> S04 -> "Zeiten bearbeiten" | "Sonderaufgabe" | "Zuweisung löschen"
    happy path clicks: 3

F04 Mitarbeiter sieht seinen Plan
    Push -> S21 bzw. S03 (nur eigene Details)
    edge: offline (Plan aus Cache), Gesamtplan-Sichtbarkeit abgeschaltet

F05 Urlaub beantragen und genehmigen
    MA: S22 -> absenden -> Chef: Push -> S10 -> Genehmigen -> MA: Push -> Eintrag in S03
    edge: Urlaubssperre im Zeitraum, Resturlaub reicht nicht, Mindestbesetzung unterschritten

F06 Krankmeldung und Ersatz
    MA: S23 (1 Tap) -> Chef: Push -> S09 -> betroffene Schichten markiert -> S05 Ersatz anfragen (Push an verfügbare MA)
    edge: niemand verfügbar, mehrere sagen gleichzeitig zu

F07 Schichttausch
    MA A: S24 Schicht anbieten -> MA B: bewerben -> Chef: genehmigen (oder Auto-Genehmigung) -> S03 aktualisiert, alle per Push informiert
    edge: B fehlt Qualifikation, B hätte Überschneidung, Angebot läuft ab

F08 Aufgaben in der Schicht erledigen
    Chef: S13 -> S14 (an Schichttypen hängen) -> MA: S16/S21 "Aufgaben" -> abhaken -> S15 Log
    edge: wiederkehrend täglich/wöchentlich, Sonderaufgabe nur für eine Zuweisung (aus S04)

F09 HACCP-Temperatur protokollieren
    Erinnerung (Push) -> S16 -> S17 -> Speichern
    happy path clicks: 2-3
    edge: Wert außerhalb Grenzwert (abgeleitet), vergessene Messung, Export für Audit

F10 Monatsauswertung exportieren
    S11 -> Monat wählen -> Export (Excel/PDF) bzw. Details -> S12

F11 Plan drucken/aushängen
    S03 -> Drucken-Button pro Tag bzw. PDF-Export
```

## Components

| component | variants | states | used on |
| --- | --- | --- | --- |
| Button | primary (blau), success (grün, Export), secondary (Outline), warning-soft (Sperren), danger (Entfernen) | default, pressed, disabled, loading | alle |
| Icon-Button | Drucken, Pfeil vor/zurück, Glocke, Einstellungen | default, pressed | S03, S11, Header |
| Segmented Control | Monat/Woche, Standard/Sonder | aktiv/inaktiv | S03, S13 |
| Tab-Leiste | Übersicht/Krankmeldungen/Urlaub/Schicht-Statistik, Verwaltung/Log | aktiv mit Unterstrich | S07–S11, S13–S15 |
| Seitenkopf-Karte | Icon-Kachel, Titel, Untertitel, Aktion rechts | – | S07, S11, S13 |
| Tageskarte | normal, Wochenende (beige), heute (blau + Badge) | – | S03 |
| Schicht-Block | Name, Uhrzeit, Liste Zuweisungen | leer, besetzt, Konflikt (abgeleitet) | S03 |
| Mitarbeiter-Chip | Vollzeit (blau), Aushilfe (orange) | default, selected, dragging | S03 |
| Avatar | Initialen, Farbe nach Beschäftigungsart | – | S03, S07 |
| Badge | Admin, STANDARD, HEUTE, Kürzel, Typ, Zähler | – | mehrere |
| Gruppen-Header | Vollzeit (blau), Aushilfen (gelb), mit Zähler | – | S07 |
| Listenzeile Mitarbeiter | mit Aktionen | aktiv, gesperrt | S07 |
| Kontextmenü/Popover | Aktionsliste mit farbigen Icon-Kacheln, destruktiv rot | – | S04 |
| Aufgabenkarte | Standard, Sonder | aktiv, gelöscht | S13 |
| Tag/Chip | Schichttyp | – | S13 |
| Aktionskachel | Aktion (Emoji/Farbe), Ordner (Anzahl), System (Heute, Aufgaben) | default, pressed | S16, S18 |
| Monatswähler | ‹ Monat Jahr › | – | S11 |
| Datentabelle | Statistik | leer, gefüllt | S11 |
| Checkbox | „Gelöschte anzeigen“, Aufgabe erledigt | an/aus | S13, S21 |
| Formularfelder | Text, E-Mail, Passwort, Datum/Zeitraum, Uhrzeit, Zahl, Auswahl, Mehrfachauswahl | default, focus, error | S01, S08, S14, S17, S22 |
| Bottom Sheet / Modal | Zuweisen, Bestätigen | – | neu für mobil |
| Toast | Erfolg, Fehler, offline | – | alle |
| Empty State | keine Schichten, keine Mitarbeiter, keine Aufgaben | – | alle Listen (nicht gesehen, muss gebaut werden) |

## Inferred data model

```
Tenant       id, subdomain, company_name, plan (trial|basic|professional|enterprise),
             trial_ends_at, employee_limit, branding (logo, color), settings (json:
             swap_requires_approval, employees_see_full_plan, notification_defaults)
             evidence: S01, Preise, AGB § 3, FAQ Rollen/Tausch
             confidence: high (subdomain, plan), medium (settings)

User         id, tenant_id, name, email, password_hash, initials (Kürzel), color,
             role (chef|planer|aufgaben_manager|mitarbeiter), is_admin,
             employment_type (vollzeit|aushilfe), status (aktiv|gesperrt|archiviert),
             fixed_shift_type_id?, weekly_hours_target?, vacation_days_per_year?,
             minijob_hours_limit?
             evidence: S07 (Gruppen, Admin-Badge, Sperren/Entfernen, "feste Schicht"),
             S11 (Kürzel, Typ), Rollen-Seite, Einzelhandel "Minijob-Stunden"
             confidence: high (role, type, status), medium (Kontingente)

Location     id, tenant_id, name
             evidence: Einzelhandel "Multi-Filial-Überblick"
             confidence: guess (nur Marketingtext, kein Screenshot)

Qualification       id, tenant_id, name
UserQualification   user_id, qualification_id, valid_until?
             evidence: Mitarbeiterverwaltung FAQ, Pflege, Produktion
             confidence: high (Entität), guess (valid_until)

Availability id, user_id, weekday | date, from, to, kind (verfügbar|nicht|bevorzugt)
             evidence: Mitarbeiterverwaltung, Einzelhandel
             confidence: medium

ShiftType    id, tenant_id, name, start_time, end_time, weekdays[], color?,
             required_qualification_ids[], min_staff?
             evidence: S03 ("Di.-Fr. Frühschicht 06:00-14:00", Nachtschicht über Mitternacht),
             S13 Tags, Pflege "Mindestbesetzung"
             confidence: high (Name/Zeiten/Wochentage), guess (min_staff)

Shift        id, tenant_id, shift_type_id, date, start_override?, end_override?,
             is_special (Event/Sonderschicht), location_id?
             evidence: S03, Gastronomie "Event-Planung"
             confidence: medium (könnte auch nur Assignment+Datum sein)

Assignment   id, shift_id, user_id, start_override?, end_override?, created_by
             evidence: S04 "Zeiten bearbeiten", "Zuweisung löschen"
             confidence: high

ShiftTemplate id, tenant_id, name, entries (json: weekday, shift_type_id, user_id?)
             evidence: Schichtplanung "Schichtvorlagen", FAQ wiederkehrende Pläne
             confidence: medium

Absence      id, user_id, type (urlaub|krank), from, to, status (beantragt|genehmigt|abgelehnt),
             comment, decided_by, decided_at
             evidence: Abwesenheiten-Seite, Tabs S09/S10
             confidence: high

VacationBlock id, tenant_id, from, to, reason
             evidence: "Urlaubssperren"
             confidence: high

SwapRequest  id, assignment_id, offered_by, status (offen|beworben|genehmigt|abgelehnt|abgelaufen),
             accepted_user_id?, decided_by?
SwapApplication  id, swap_request_id, user_id, created_at
             evidence: Schichttausch FAQ ("Kollegen können sich bewerben")
             confidence: high

Task         id, tenant_id, title, kind (standard|sonder), shift_type_ids[],
             assignment_id? (Sonderaufgabe), recurrence (täglich|wöchentlich|custom),
             priority, due_at?, deleted_at
             evidence: S13, S04 "Sonderaufgabe", Aufgaben-Seite
             confidence: high

TaskCompletion id, task_id, user_id, date, completed_at
             evidence: Zähler auf S13, Aufgaben-Log, "wer wie oft"
             confidence: high

QuickActionFolder id, tenant_id, name, icon, color, sort
QuickAction  id, tenant_id, folder_id?, name, icon (Emoji), color, fields (json: label,
             type, unit, min?, max?), reminder_times[]
QuickActionEntry id, quick_action_id, user_id, values (json), created_at
             evidence: S16, Schnellaktionen FAQ
             confidence: high (Struktur), guess (min/max-Grenzwerte)

HandoverNote id, shift_id, author_id, text, created_at
             evidence: Pflege/Produktion "Übergabe-Protokoll"
             confidence: medium

Notification id, user_id, type, payload, read_at, created_at
NotificationPreference user_id, type, push, email
DeviceToken  id, user_id, platform (ios|android|web), token
             evidence: Benachrichtigungen-Seite
             confidence: high
```

Relationships: Tenant 1-n User, Tenant 1-n ShiftType, ShiftType 1-n Shift, Shift 1-n Assignment, User 1-n Assignment, User n-m Qualification, ShiftType n-m Qualification, User 1-n Absence, Assignment 1-n SwapRequest, SwapRequest 1-n SwapApplication, Task n-m ShiftType, Task 1-n TaskCompletion, QuickActionFolder 1-n QuickAction, QuickAction 1-n QuickActionEntry, Shift 1-n HandoverNote, User 1-n Notification.

## Feature matrix

Siehe `features.csv`. Must: 36, should: 24, could: 10, skip: 3.

## Out of scope (cannot or should not be cloned)

- Name „Schichtenmanager“, Logo, Texte und Screenshots des Originals. Eigener Name und eigenes Branding (Schritt `/replica-brand`).
- Bestandskunden und deren Daten: gehören dem Anbieter bzw. den Kunden (AGB § 11 Abs. 2). Eine Migration geht nur über den Datenexport des Kunden.
- Behauptungen wie „bis zu 80 % Zeitersparnis“ oder „HACCP-konform“: ohne eigenen Nachweis nicht übernehmen.
- Enterprise-Leistungen (SLA, dedizierter Ansprechpartner, individuelle Rollen) sind Vertrag und Service, kein App-Feature.

## Size

Screens 29, flows 11, entities 20. Hard parts:

1. Offline-Lesezugriff plus spätere Synchronisation ohne Datenverlust (Plan offline sehen, Aufgaben/Schnellaktionen offline erfassen, Konflikte beim Sync).
2. Regelprüfung bei der Zuweisung: Überschneidung, 11-Stunden-Ruhezeit nach ArbZG § 5, Qualifikation, Abwesenheit, Urlaubssperre, Minijob-Stundengrenze. Nachtschichten über Mitternacht machen das fehleranfällig.
3. Planung auf dem Telefon: Drag-and-Drop über drei Tagesspalten funktioniert nur auf Tablet/Desktop. Für Phone braucht es ein eigenes Interaktionsmodell.
4. Push über APNs und FCM mit Präferenzen pro Ereignistyp und E-Mail-Fallback.
5. Mandantenfähigkeit mit 4 Rollen und Sichtbarkeitsregeln (Mitarbeiter sehen Gesamtplan, aber keine Details anderer).
6. PDF-/Excel-Export (Plan, Statistik, Schnellaktions-Protokolle für Audits).

Size: L (ein Quartal für ein kleines Team, gerechnet für die Must- und Should-Zeilen mit eigenem Backend). Nur die Must-Zeilen mit einem Backend-as-a-Service: eher M.
