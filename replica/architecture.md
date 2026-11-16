# Architecture: Schichtenmanager-Rebuild (native iOS + Android)

Grundlage: `replica/recon.md` (29 Screens, 11 Flows) und `replica/features.csv` (73 Zeilen).
Schema: `replica/schema.sql`, gegen Postgres 16 mit einem Supabase-Auth-Stub ausgeführt und mit einem Szenario getestet (siehe „Getestet“).

## Stack

Da kein bestehender Stack vorgegeben war, nehme ich durchgehend verwaltete Dienste. So gibt es für alle drei Zielplattformen nur eine Codebasis und genau eine Datenbank.

| layer | choice | why |
| --- | --- | --- |
| App (iOS, Android, Web) | Expo (React Native) + TypeScript + Expo Router | Eine Codebasis für beide Stores und eine Web-Version, in der der Chef am Desktop plant. |
| Styling | React-Native-StyleSheet mit Tokens aus `replica/design/tokens.json` (generiert nach `app/src/theme/tokens.ts`) | Ohne Babel-/Metro-Erweiterung wie bei NativeWind. Komponenten nutzen nur Rollen, nie Hex-Werte. |
| Server-State + Offline | TanStack Query, Cache persistiert in MMKV, pausierte Mutationen als Warteschlange | Der Plan ist offline lesbar. Abhaken und Messwerte werden offline gesammelt und später hochgeladen. Eine eigene Sync-Engine ist dafür nicht nötig. |
| Datenbank | Postgres auf Supabase, Region Frankfurt (eu-central-1) | Das Original wirbt mit „Daten in Deutschland“. RLS, Realtime und Cron laufen in derselben Datenbank. |
| Zugriffsregeln | Row Level Security auf allen Tabellen, Geschäftsregeln in `security definer`-Funktionen | Clients sprechen direkt mit der Datenbank (PostgREST). Die Regeln stehen an genau einer Stelle. |
| Auth | Supabase Auth: E-Mail + Passwort, Einladung per Link | Es gibt keinen Social Login, deshalb ist Sign in with Apple nicht verpflichtend. |
| Push | expo-notifications + Expo Push Service → APNs / FCM | Ein Versandweg für iOS und Android. Echter iOS-Push ist der Hauptgrund für die native App. |
| Realtime | Supabase Realtime (postgres_changes auf `assignments`, `notifications`) | Planänderungen erscheinen ohne Neuladen. Realtime beachtet RLS. |
| Jobs | pg_cron + Supabase Edge Functions | Erinnerungen, Trial-Ablauf, Löschfristen und Push-Versand laufen ohne zusätzlichen Dienst. |
| Zahlungen | Stripe Billing (Karte, SEPA-Lastschrift), Checkout + Customer Portal, nur im Web | Die AGB des Originals nennen Karte und SEPA. In der iOS-App gibt es keinen Kauf-Button, damit greift Apples In-App-Purchase-Pflicht nicht. |
| E-Mail | Supabase Custom SMTP über Postmark oder Brevo | Für Auth-Mails und Benachrichtigungs-Fallback. Mit dem Anbieter ist ein AVV nötig. |
| Export | expo-print (PDF), SheetJS (xlsx), expo-sharing; alles auf dem Gerät | Für PDF-Aushang und Excel-Statistik braucht es keinen Server. |
| Dateien | Supabase Storage | Für Firmenlogo (Branding) und spätere Anhänge. |
| Build + Release | EAS Build, EAS Submit, EAS Update | Store-Builds ohne eigenen Mac-CI-Runner. JS-Fixes gehen ohne neues Review raus. |
| Web-Hosting | Expo-Web-Export als Single-Page-App auf Vercel oder Cloudflare Pages | Die Web-Version braucht keinen eigenen Server. Statisches Vorrendern ist abgeschaltet, weil es Theme und Fensterbreite falsch hydriert. |
| Fehler-Monitoring | Sentry (@sentry/react-native) | Abstürze und JS-Fehler in allen drei Targets. |

Die Marketing-Website gehört nicht in diesen Plan. Sie kommt mit `/replica-launch`.

## Schema

Tables: 31. Access rules: RLS (Policies am Ende von `schema.sql`) plus Spalten-Grants, damit Clients Plan, Status und Stripe-Felder nicht selbst setzen können.

Gruppen:

| Bereich | Tabellen |
| --- | --- |
| Mandant | tenants, members, member_contacts, invitations |
| Stammdaten | locations, qualifications, member_qualifications, availabilities, shift_types, shift_type_qualifications |
| Plan | shifts, assignments, shift_templates, shift_template_entries, handover_notes |
| Abwesenheit | absences, vacation_blocks |
| Tausch | swap_requests, swap_applications |
| Aufgaben | tasks, task_shift_types, task_completions |
| Schnellaktionen | quick_action_folders, quick_actions, quick_action_entries, quick_action_reminders_sent |
| Benachrichtigung | notifications, notification_preferences, tenant_notification_defaults, device_tokens |
| Abrechnung | stripe_events (Stripe-IDs liegen auf tenants) |

Harte Regeln liegen in der Datenbank, nicht in der UI:

| Regel | Umsetzung |
| --- | --- |
| Niemand ist zweimal gleichzeitig eingeteilt | Exclusion-Constraint `no_double_booking` (gist auf member_id + tstzrange) |
| Keine überlappenden offenen/genehmigten Abwesenheiten | Exclusion-Constraint `no_overlapping_absence` |
| Pro Schichttyp und Datum genau eine Schicht | Partieller Unique-Index `shifts_type_date_unique` |
| Pro Zuweisung höchstens ein aktiver Tausch | Partieller Unique-Index `swap_one_active_per_assignment` |
| Aufgabe pro Schicht nur einmal erledigt | `unique (task_id, shift_id)` |
| Offline-Uploads doppelt angekommen | Primärschlüssel ist die auf dem Gerät erzeugte UUID (`task_completions`, `quick_action_entries`) |
| Trial max. 10 Mitarbeiter | Trigger `enforce_member_limit` |
| Urlaubssperre | Harte Prüfung in `request_vacation` |
| Krank/Urlaub-Grund nur für Planer und Betroffene | RLS auf `absences` |
| E-Mail/Telefon nur für Planer und Betroffene | Eigene Tabelle `member_contacts` mit strengerer RLS |

Folgende Regeln erzeugen nur Warnungen und blockieren nichts. So steht es auch auf den Feature-Seiten des Originals („warnt bei Konflikten“): Ruhezeit, fehlende Qualifikation, Abwesenheit, „nicht verfügbar“ und Monatsstunden-Grenze. Alle stecken in `check_assignment()`.

### Getestet

Das Schema lädt fehlerfrei in Postgres 16. Getestet habe ich mit drei Nutzern eines Mandanten und einem fremden Nutzer:

- **Zeitumstellung:** Die Nachtschicht 22:00–06:00 am 24.10.2026, also über die Zeitumstellung, dauert korrekt 9 Stunden.
- **Schichten anlegen:** `ensure_shift` ist idempotent.
- **Warnungen:** Fehlende Qualifikation, Ruhezeit unter 11 h und Monatsgrenze (16 h bei 10 h Grenze) werden gemeldet.
- **Doppelbuchung:** Wird von der Datenbank abgewiesen.
- **Rechte eines Mitarbeiters:** Er sieht 3 Kollegen, aber 0 Kontaktdaten. Er kann den Plan nicht ändern, keinen Schichttyp anlegen und die Statistik nicht abrufen.
- **Schichttausch:** Angebot → Bewerbung → Auswahl → `pending_approval` → Genehmigung durch den Chef → Zuweisung umgebucht. Eine zweite Genehmigung liefert `already_decided`.
- **Urlaub:** Ein Antrag in einer Urlaubssperre wird abgewiesen. Genehmigter Urlaub erscheint in der Statistik (5 Tage Mo–Fr).
- **Fremder Nutzer:** Er sieht 0 Mandanten, 0 Mitglieder, 0 Zuweisungen und 0 Benachrichtigungen.
- **Offline-Upload:** Doppelt hochgeladenes Abhaken ergibt 1 Datensatz.

Nicht getestet sind Realtime, Push, Edge Functions und Stripe, weil sie eine echte Supabase-Instanz brauchen.

## API

Clients sprechen direkt mit PostgREST (CRUD unter RLS) und rufen Postgres-Funktionen per `rpc`. Edge Functions gibt es nur dort, wo externe Dienste oder Geheimnisse im Spiel sind. Wo „—“ als Flow steht, gehört die Route zu keinem der 11 Recon-Flows.

| method path | does | who | input | output | flow |
| --- | --- | --- | --- | --- | --- |
| auth.signUp / signInWithPassword | Konto anlegen / anmelden | alle | E-Mail, Passwort | Session | F01 |
| rpc create_tenant | Mandant anlegen, Aufrufer wird Chef | angemeldet | slug, name, display_name, initials | tenant_id | F01 |
| POST fn/invite-member | Mitglied + Einladung anlegen, Mail senden | chef | Name, Kürzel, Rolle, Typ, E-Mail | member_id | F01 |
| POST fn/accept-invite | Token prüfen, user_id an Mitglied hängen, status active | angemeldet | token | tenant_id | F01 |
| GET members, shift_types, qualifications | Stammdaten | Mitglied | tenant_id | Listen | F02 |
| POST/PATCH/DELETE shift_types (+ shift_type_qualifications) | Schichttypen pflegen | chef, planer | Felder | Zeile | F01 |
| GET shifts?date=between&select=*,assignments(*) | Plan für Zeitraum | Mitglied (RLS filtert) | von, bis | Schichten + Zuweisungen | F02, F04 |
| rpc ensure_shift | Schicht für Typ + Datum holen/anlegen | chef, planer | shift_type_id, date | shift_id | F02 |
| rpc check_assignment | Warnungen vor dem Zuweisen | chef, planer | shift_id, member_id, Zeiten? | [{code,...}] | F02, F06 |
| POST assignments | Zuweisen | chef, planer | tenant_id, shift_id, member_id | Zeile oder Fehler no_double_booking | F02 |
| PATCH assignments | Zeiten bearbeiten | chef, planer | start_at, end_at | Zeile | F03 |
| DELETE assignments | Zuweisung löschen | chef, planer | id | – | F03 |
| rpc apply_template (Migration 2) | Vorlage auf Woche anwenden | chef, planer | template_id, week_start | Anzahl, Warnungen | F02 |
| POST/PATCH members, member_contacts | Mitarbeiter anlegen/bearbeiten/sperren/archivieren | chef | Felder | Zeile | — |
| POST/DELETE availabilities | Verfügbarkeit | selbst, chef, planer | weekday/on_date, Zeiten, kind | Zeile | — |
| rpc request_vacation | Urlaub beantragen | Mitglied | tenant, von, bis, Kommentar | absence_id oder vacation_blocked | F05 |
| rpc decide_absence | Genehmigen/Ablehnen | chef, planer | absence_id, approve | – | F05 |
| PATCH absences status=cancelled | Eigenen Antrag zurückziehen | selbst | id | Zeile | F05 |
| rpc report_sick | Ein-Tap-Krankmeldung | Mitglied | tenant, von, bis? | absence_id | F06 |
| POST fn/request-replacement | Verfügbare Kollegen per Push anfragen | chef, planer | shift_id | Anzahl angefragt | F06 |
| rpc offer_swap | Schicht anbieten | Inhaber der Zuweisung | assignment_id | swap_id | F07 |
| rpc apply_swap | Bewerben | Mitglied | swap_id | – | F07 |
| rpc decide_swap | Bewerber wählen / freigeben / ablehnen | Anbieter, chef, planer | swap_id, member_id, approve | approved, pending_approval, rejected | F07 |
| POST/PATCH tasks, task_shift_types | Aufgaben pflegen, Sonderaufgabe aus S04 | chef, planer, aufgaben_manager | Felder | Zeile | F03, F08 |
| rpc complete_task | Abhaken, idempotent | Eingeteilter, Manager | Geräte-UUID, task_id, shift_id, completed_at | – | F08 |
| DELETE task_completions | Haken zurücknehmen | selbst | id | – | F08 |
| GET task_completions | Aufgaben-Log | Mitglied | Zeitraum | Liste | F08 |
| POST/PATCH quick_action_folders, quick_actions | Schnellaktionen definieren | chef, aufgaben_manager | Felder, Messfelder | Zeile | F09 |
| POST quick_action_entries (Prefer: resolution=ignore-duplicates) | Messwert erfassen, idempotent | Mitglied | Geräte-UUID, Werte, recorded_at | – | F09 |
| GET quick_action_entries | Protokoll / Audit-Export | Mitglied | Aktion, Zeitraum | Liste | F09 |
| rpc stats_month | Monatsstatistik | chef, planer | tenant, Monat | Zeilen pro Mitarbeiter | F10 |
| POST handover_notes | Übergabe-Notiz | Mitglied | shift_id, Text | Zeile | — |
| GET/PATCH notifications | Benachrichtigungszentrale, gelesen markieren | selbst | – / read_at | Liste | — |
| PUT notification_preferences | Eigene Einstellungen | selbst | type, push, email | Zeile | — |
| PUT device_tokens | Push-Token registrieren | selbst | expo_push_token, platform | Zeile | — |
| PATCH tenants | Einstellungen (nur erlaubte Spalten) | chef | Felder | Zeile | — |
| POST fn/billing-checkout | Stripe Checkout öffnen (nur Web) | chef | Tarif | URL | — |
| POST fn/billing-portal | Stripe Customer Portal | chef | – | URL | — |
| POST fn/export-tenant | Datenexport (AGB-Pflicht des Originals) | chef | – | ZIP-URL (Storage, signiert) | — |
| POST fn/delete-account | Eigenes Konto löschen (Apple-Pflicht) | selbst | – | – | — |

Zusammen sind das 40 Routen. 12 davon sind Postgres-Funktionen (11 im Schema, `apply_template` folgt in Migration 2), 7 sind Edge Functions, der Rest ist PostgREST oder Auth. Dazu kommt der Stripe-Webhook.

Webhooks in: `fn/stripe-webhook` (checkout.session.completed, customer.subscription.updated/deleted, invoice.payment_failed). Das Event wird gegen `stripe_events` geprüft und setzt `tenants.plan`/`status`.
Webhooks out: keine.

Jobs:

| name | schedule | does |
| --- | --- | --- |
| send-push | Database Webhook bei Insert in `notifications`, dazu pg_cron jede Minute für Liegengebliebene | Versendet per Expo Push, setzt `pushed_at` und löscht Tokens mit „DeviceNotRegistered“. |
| send-email-notifications | alle 5 min | Mailt Typen mit `email = true` und setzt `emailed_at`. |
| quick-action-reminders | alle 5 min | `reminder_times` in der Zeitzone des Mandanten fällig: erst `quick_action_reminders_sent` (on conflict do nothing), dann eine Benachrichtigung an die Eingeteilten. |
| expire-swaps | stündlich | Setzt offene Tausche mit `expires_at < now()` auf `expired`. |
| trial-expiry | täglich 03:10 | Trial abgelaufen ohne Abo: `status = restricted`, Mail an den Chef. |
| purge-tenants | täglich 03:40 | Mandanten 90 Tage nach Trial-Ende/Kündigung löschen (Frist aus den AGB des Originals übernommen), Warnmail 7 Tage vorher. |
| stripe-seat-sync | bei Statusänderung eines Mitglieds + täglich | Setzt die Stripe-Menge für Zusatz-Mitarbeiter auf max(0, aktive − inklusive). |

## The parts that bite

- **Zeitzonen und Zeitumstellung:** Schichttypen speichern lokale Uhrzeiten. Eine Schicht bekommt beim Anlegen `start_at`/`end_at` in UTC über die Zeitzone des Mandanten (`shift_bounds`). Die Nachtschicht am 24./25.10.2026 hat so korrekt 9 Stunden. Die Statistik summiert echte Dauern und nicht „Ende minus Anfang auf der Uhr“.
- **Idempotenz:** Stripe-Events über `stripe_events.id`. Offline-Uploads über die Geräte-UUID. Erinnerungen über `quick_action_reminders_sent`. `ensure_shift` über den Unique-Index.
- **Races:** Zwei Planer ziehen gleichzeitig dieselbe Person auf überlappende Schichten → der Exclusion-Constraint lässt nur eine Zuweisung durch. Zwei Genehmigungen desselben Tauschs → `select … for update` in `decide_swap`.
- **Offline:** Lesen geht über den persistierten Query-Cache. Schreiben ist offline nur für Abhaken, Messwerte und Krankmeldung erlaubt. Planen und Genehmigen brauchen eine Verbindung, damit Konflikte serverseitig geprüft werden. Die UI zeigt den Offline-Zustand und die Zahl wartender Uploads.
- **Planen auf dem Telefon:** Drag-and-Drop gibt es nur auf Tablet und Web. Auf dem Telefon: Tagesliste → Schicht antippen → Bottom Sheet mit Mitarbeitern, sortiert nach „keine Warnung zuerst“, mit den Warnungen aus `check_assignment` direkt an jedem Namen.
- **Push:** Android 13+ braucht die Laufzeit-Berechtigung POST_NOTIFICATIONS, iOS fragt einmal. Die Abfrage kommt erst nach dem ersten Login mit Erklärung, nicht beim App-Start. Tokens ändern sich; bei jedem App-Start `device_tokens` per Upsert aktualisieren.
- **DSGVO:** Krankmeldungen sind Gesundheitsdaten (Art. 9 DSGVO). Push-Texte deshalb neutral halten („Neue Abwesenheit“, nicht „Bea ist krank“), weil Push über Expo, Apple und Google läuft. Mit Supabase, Stripe, dem Mail-Anbieter und Expo sind AVVs nötig. Konto- und Mandantenlöschung sind als Jobs vorgesehen.
- **Arbeitsrecht:** Die Ruhezeit ist pro Mandant einstellbar (Standard 11 h nach § 5 Abs. 1 ArbZG), weil § 5 Abs. 2 für Branchen wie Gastronomie und Pflege Verkürzungen erlaubt. Die Minijob-Grenze ist gesetzlich ein Euro-Betrag und keine Stundenzahl. Das Schema speichert deshalb eine Stundengrenze pro Mitarbeiter, die der Chef selbst festlegt; gesetzliche Werte werden nicht hart codiert.
- **Feiertage:** Resturlaub zählt aktuell Arbeitstage nach `tenants.workdays`. Gesetzliche Feiertage je Bundesland sind noch nicht modelliert. Sie kommen als eigene Tabelle in Migration 2, sonst wird Urlaub über Feiertage zu hoch gezählt.
- **Mandanten:** Jede Zeile trägt `tenant_id`, jede Policy prüft die Mitgliedschaft. Eine Person kann Mitglied mehrerer Firmen sein (Aushilfe in zwei Betrieben); die App braucht dafür einen Firmenwechsler.
- **App-Store-Review:** Apple verlangt Kontolöschung in der App und einen Demo-Zugang für das Review. Ein Kauf-Button oder ein Link zum Kauf in der iOS-App würde Ärger mit den In-App-Purchase-Regeln bringen; dort wird der Tarif nur angezeigt.
- **Realtime-Last:** Abonniert wird nur auf den sichtbaren Zeitraum und den eigenen Mandanten. Danach wird neu geladen, statt einzelne Events ins Cache zu patchen.

## Build order

1. **Vertical slice.** Ein Chef plant auf dem Tablet eine Schicht, ein Mitarbeiter bekommt auf dem Telefon einen Push und sieht die Schicht.
   Screens S01, S02, S03 (Woche, lesen), S05 (einfach), S21.
   Tabellen: tenants, members, member_contacts, invitations, shift_types, shifts, assignments, notifications, device_tokens.
   Routen: Auth, create_tenant, invite-member, accept-invite, ensure_shift, POST assignments, GET shifts, PUT device_tokens, send-push.
   Fertig, wenn das auf einem echten iPhone (TestFlight) und einem echten Android-Gerät funktioniert.
2. **Must-haves.**
   - Personal: S07, S08 (Sperren, Archivieren, Vollzeit/Aushilfe).
   - Plan: S03 Monat, S04, Konfliktprüfung über check_assignment, Abwesenheiten im Plan.
   - Abwesenheiten: S09, S10, S22, S23 (request_vacation, decide_absence, report_sick).
   - Tausch: S24 (offer/apply/decide_swap, expire-swaps).
   - Aufgaben: S13, S14, S21 Abhaken (complete_task).
   - Schnellaktionen: S16, S17, S19.
   - Benachrichtigungen: S25.
   - Statistik: S11 (stats_month).
   - Offline-Cache und Upload-Warteschlange.
   - Abo im Web: S28, Stripe, trial-expiry.
   - Kontolöschung.
3. **Should-haves.** Qualifikationen und Verfügbarkeit (S27), Vorlagen (S06, apply_template), Resturlaub und Urlaubssperren in S10, Springer-Anfrage (request-replacement), PDF-/Excel-Export, Erinnerungen für Schnellaktionen, Ordner (S18), Aufgaben-Log (S15), „Heute“ (S20), E-Mail-Benachrichtigungen, Einstellungen (S26), Datenexport, purge-tenants, Feiertage.
   **Could-haves.** Standorte, Schicht-Rotation, Übergabe-Notizen (S29), Branding, Sonderschichten, Überstunden.
4. **Fixes aus `/replica-entrepreneur`.** Zum Original gibt es keine öffentlichen Bewertungen (Websuche ohne Treffer). Hier bleibt es daher bei dem, was die Recon selbst zeigt: iOS-Push ohne Homescreen-Umweg und Planung, die auf dem Telefon funktioniert.
