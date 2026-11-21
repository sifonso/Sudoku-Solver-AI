# Backend

Supabase (Postgres + Auth + Edge Functions), Region Frankfurt. Die App wählt das Backend selbst: Mit
`EXPO_PUBLIC_SUPABASE_URL` und `EXPO_PUBLIC_SUPABASE_ANON_KEY` in `app/.env.local` spricht sie mit Supabase,
ohne diese Werte läuft sie mit Demodaten (`app/src/data/client.ts`).

## Dateien

| Pfad | Inhalt |
| --- | --- |
| `supabase/migrations/20261116155153_init.sql` | Schema, RLS, Trigger, RPCs (gleich `replica/schema.sql`) |
| `supabase/migrations/20261116155155_signup_invites_grants.sql` | `slug_available`, `claim_invitations`, Ausführungsrechte |
| `supabase/functions/delete-account` | Konto löschen (Apple-Pflicht) |
| `supabase/functions/invite-member` | Mitarbeiter einladen, Einladungs-Mail über Supabase Auth |
| `supabase/functions/send-push` | Push über Expo Push Service, ausgelöst per Database Webhook |
| `app/src/data/supabase.ts` | Datenschicht der App gegen Supabase |
| `app/.env.example` | Variablennamen ohne Werte |

## Stand im Supabase-Projekt

Projekt `afrgpfjslsewdkipqcvi`, Region eu-central-1 (Frankfurt). Eingerichtet am 2026-11-16 über die Management API.

| Schritt | Stand |
| --- | --- |
| Migrationen `init` und `signup_invites_grants` | eingespielt und im Projekt registriert; 31 Tabellen, RLS auf allen 31 |
| Edge Functions `delete-account`, `invite-member`, `send-push` | deployed; `send-push` ohne JWT-Prüfung am Gateway, prüft stattdessen `x-webhook-secret` |
| Secret `PUSH_WEBHOOK_SECRET` | gesetzt (Wert nicht gespeichert; beim Einrichten des Webhooks neu setzen und denselben Wert im Webhook-Header eintragen) |
| Auth: E-Mail-Bestätigung | an |
| Auth: Mindestlänge Passwort | 8 (vorher 6) |
| App: `app/.env.local` | Project URL + publishable Key (öffentlich, nicht im Repo) |

## Noch einzurichten

1. **Eigenes SMTP.** Der eingebaute Versand erlaubt 2 Mails pro Stunde (`rate_limit_email_sent = 2`). Damit scheitern Registrierungen und Einladungen, sobald mehr als zwei pro Stunde passieren. Lösung: Authentication → Emails → SMTP Settings mit einem Anbieter (Postmark oder Brevo) und eigener Absender-Domain.
2. **Site URL.** Steht auf `http://localhost:3000`. Der Bestätigungslink bestätigt das Konto trotzdem, landet danach aber auf einer leeren Seite. Sobald es eine Web-Adresse oder einen Deep Link gibt (`schichtplaner://`), unter Authentication → URL Configuration eintragen.
3. **Push-Webhook**, sobald die App eine EAS-Projekt-ID hat: Database → Webhooks → Create, Tabelle `notifications`, Event `INSERT`, Ziel Edge Function `send-push`, Header `x-webhook-secret`.
4. **Backups.** Im Free-Plan gibt es keine automatischen Backups. Vor echten Kundendaten auf einen bezahlten Plan wechseln und unter Database → Backups prüfen.

## Live-Test (2026-11-16, gegen das Projekt)

29 Prüfungen, 0 Fehler. Testkonten über die Admin-API als bestätigt angelegt (`@example.com`, keine Mails) und danach samt Betrieb gelöscht.

- **Gast ohne Login:** `slug_available` geht. `create_tenant` wird mit 42501 abgewiesen.
- **Chef:** Legt einen Betrieb an, danach ist die Firmenadresse vergeben. Er kann Schichttypen anlegen und über `invite-member` eine Person mit bestehendem Konto einladen.
- **Nicht-Mitglied:** `invite-member` antwortet mit 403.
- **Eingeladene:** `claim_invitations` ergibt 1, danach ist sie aktives Mitglied. Sie sieht ihre Schicht und die Mitteilung „Neue Schicht“.
  - Planen wird abgewiesen (42501).
  - Den Betrieb umzubenennen bleibt ohne Wirkung.
  - Die Spalte `plan` ist für sie und auch für den Chef gesperrt.
  - Von den Kontaktdaten sieht sie nur ihre eigenen.
- **Nachtschicht über die Zeitumstellung am 27./28.03.2027:** dauert 7 Stunden.
- **Doppelte Zuweisung:** abgewiesen.
- **Fremde Person:** sieht 0 Zeilen in 7 Tabellen.
- **Konto löschen:**
  - Eine Mitarbeiterin wird archiviert, ihre Historie bleibt.
  - Der einzige Chef bekommt erst 409 `sole_chef`. Mit Bestätigung werden danach Konto und Betrieb gelöscht.
- **App im Browser gegen das Projekt:** Login mit bestätigtem Konto legt den Betrieb aus den Registrierungsdaten an. Plan, Zuweisen und Neuladen funktionieren mit erhaltener Sitzung und ohne Konsolenfehler.

## Lokale Tests

Zusätzlich lokal gegen Postgres 16 mit Supabase-Auth-Stub:

- **Nicht angemeldeter Besucher:** Darf nur `slug_available` aufrufen. `create_tenant` und Tabellenzugriffe werden abgewiesen.
- **Einladung:** Wird nur mit bestätigter E-Mail eingelöst, Groß- und Kleinschreibung der Adresse ist egal, und ein zweites Einlösen ergibt 0.
- **Fremder Nutzer:** Sieht 0 Betriebe, 0 Mitglieder, 0 Einladungen, 0 Mitteilungen und 0 Zuweisungen.
- **Betrieb löschen:** Entfernt alles abhängige sauber, auch Zuweisungen und Krankmeldungen.
- **Mitteilungs-Trigger:** Erzeugt beim Zuweisen und Austragen eine Mitteilung, aber nicht, wenn sich jemand selbst einteilt.
- **Schema-Regeln aus `architecture.md`:** Doppelbuchung, Tausch, Urlaubssperre, Zeitumstellung.

## Offen

| Thema | Was fehlt | Wer |
| --- | --- | --- |
| Push | EAS-Projekt-ID in `app.json` (`extra.eas.projectId`), dafür Expo-Account; dann Webhook (Schritt 7). Bis dahin registriert die App kein Token. | du: Expo-Account; ich: Einbau |
| E-Mail | Eigenes SMTP für Auth-Mails, Absender-Domain (Pflicht vor echten Nutzern, siehe oben) | du |
| Passwort vergessen | Screen + `resetPasswordForEmail` + Deep Link | ich |
| Jobs | `expire-swaps`, `quick-action-reminders` per pg_cron | ich |
| Generierte Typen | `supabase gen types` statt untypisierter Zeilen in `supabase.ts` | ich, nach Verbindung |
| Rate Limits | Supabase Auth begrenzt Login und Registrierung selbst; `invite-member` noch ohne eigene Grenze | ich |

## Sicherheits-Checkliste

- [x] Geheimnisse nur in Umgebungsvariablen; `.env*.local` in `app/.gitignore`; im App-Bundle nur URL und anon-Key
- [x] Eingaben serverseitig geprüft: Check-Constraints im Schema, Validierung in `invite-member`
- [x] Rechte bei jedem Lesen und Schreiben über RLS, mit zweitem und fremdem Nutzer getestet (lokal und live)
- [ ] Rate Limits: Auth über Supabase; eigene Grenze für `invite-member` fehlt
- [x] Webhooks prüfen Signaturen bzw. Geheimnis: `send-push` prüft `x-webhook-secret` (Stripe entfällt)
- [ ] Uploads: noch keine (Logo für Branding kommt später, dann mit Größen- und Typgrenze)
- [x] Keine Nutzerdaten in URLs; Push-Texte ohne Gesundheitsbezug
- [ ] `npm audit`: meldet Funde in Entwicklungs-Abhängigkeiten von Expo, noch nicht ausgewertet
- [ ] Datenschutzerklärung mit allen Auftragsverarbeitern: Supabase, Expo (Push), Apple/Google (Push-Zustellung), später der Mail-Anbieter

## Entscheidung 2026-11-16: keine Bezahlfunktion

Die App wird teamintern genutzt. Migration `internal_use`: Tarif `internal` als Standard, keine Testphase (`trial_ends_at` leer), kein Personenlimit. Stripe, Abo-Screen und die Jobs `trial-expiry`, `stripe-seat-sync`, `purge-tenants` entfallen. S28 ist jetzt nur noch „Datenexport“.

## Last: 40 Personen (2026-11-16)

Gemessen gegen das Projekt mit einem Testbetrieb: 40 Personen, 3 Schichttypen, 448 Zuweisungen in 4 Wochen (`npm run test:load`, Median aus 3 Läufen, vom Cloud-Container über Proxy; auf dem Handy kommt die Mobilfunk-Latenz hinzu).

| Abfrage | vorher | nachher |
| --- | --- | --- |
| Plan einer Woche (S03) | 366–402 ms | unverändert |
| Mitarbeiterliste (S07) | 154–346 ms | unverändert |
| Zuweisen-Liste (S05) | 40 Anfragen, 454–566 ms | 1 Anfrage (`check_assignments`), 165 ms |
| Monatsstatistik (S11) | 150–154 ms | unverändert |
| Mitteilungen (S25) | 153–167 ms | unverändert |

Grenzen außerhalb der App, nicht selbst geprüft (Preisseite von hier nicht erreichbar):
- Realtime: laut Supabase-Doku 200 gleichzeitige Verbindungen im Free-Plan. Die App nutzt Realtime noch nicht; Mitteilungen werden alle 15 s abgefragt, bei 40 Personen etwa 160 Anfragen pro Minute.
- Free-Projekte werden nach etwa einer Woche Inaktivität pausiert und haben keine herunterladbaren Backups (Drittquellen). Bei täglicher Nutzung greift die Pause nicht; Backups sind trotzdem ein Grund für Pro.
- E-Mail: eingebauter Versand 2 Mails/Stunde (Projekteinstellung `rate_limit_email_sent = 2`, selbst ausgelesen). 40 Einladungen brauchen eigenes SMTP.

## Einladen per Code (2026-11-16)

Supabase lehnt im kostenlosen Tarif mit eingebautem Mailversand das Ändern der Mail-Vorlagen ab (`entitlement_required: auth.email_templates`). Mails mit Code statt Link sind damit erst mit Pro oder eigenem SMTP möglich. Deshalb:

- `invite-member` verschickt keine Mail mehr (nur mit `send_email: true`) und gibt einen 8-stelligen Einladungscode zurück (14 Tage gültig, einmalig, nur als SHA-256 gespeichert).
- RPC `claim_invitation_code(code)` verknüpft das angemeldete Konto mit dem eingeladenen Mitglied; unabhängig von der E-Mail-Adresse. Getestet lokal und live (falscher Code, zweite Verwendung, Groß-/Kleinschreibung).
- Registrierung „Mit Einladungscode“ und Beitreten für Konten ohne Betrieb in der App.
- Abschalten der E-Mail-Bestätigung habe ich nicht vorgenommen (Sicherheitseinstellung, Entscheidung des Projekteigentümers); Anleitung in `TESTEN.md`.

## Dienstplan nach Excel-Vorlage (2026-11-20)

Migration `20261120120000_dienstplan` (live eingespielt, lokal getestet): `dp_settings`, `dp_staff` (Grundrhythmus, Qualifikationen, Telefon), `dp_staff_private` (Personalnummer, nur FK4/SL), `dp_entries` (Kürzel je Person und Tag, FLEX), `dp_carpools`, `dp_swaps` mit `dp_swap_requests`. Schreiben am Plan nur FK4/SL bzw. Planer; die Tauschbörse läuft über die Funktionen `dp_offer_swap`, `dp_request_swap`, `dp_accept_request`, `dp_decide_swap`, `dp_cancel_swap`. Ob ein Tausch genehmigt werden muss, steht in `dp_settings.data.swapApproval`.

Import der Excel (Personendaten, Ausgabe nie ins Repository):

    python3 app/scripts/import-dienstplan.py plan.xlsx /tmp/seed.json
    python3 app/scripts/seed-to-sql.py /tmp/seed.json <firmenadresse> > /tmp/import.sql

Die SQL-Datei wird über die Management API oder den SQL-Editor im Dashboard ausgeführt. Stand: Im Live-Projekt gibt es noch keinen Betrieb, der Import wartet auf die erste Registrierung.

Abweichung zur Excel: Die Jahresübersicht der Excel zählt S/N-Dienste doppelt als Nachtdienst (Formel zählt „S/N“ und „*/N“). Die App zählt jeden einmal; Dienste, Sonntags- und Feiertagsdienste stimmen mit der Excel überein (geprüft für eine Person 2027: 227 / 32 / 7).

### Nachtrag 2026-11-20: Ringtausch, Kommentare, vorübergehender Turnus

Migration `20261120180000_dienstplan_ring_comments` (live eingespielt, lokal getestet):
- `dp_swaps` mit `kind` (offer/direct), `legs` (Ring: Dienst von Glied i geht an Glied i+1), `accepted`, `created_by_lead`. Funktionen `dp_propose_swap`, `dp_respond_proposal`; `dp_apply_ring` prüft und schreibt. Tausch am selben Tag (1:1) und Dreieckstausch geprüft. Von FK4/SL angelegte Tausche brauchen keine Genehmigung.
- `dp_comments`: lesen alle im Betrieb; ändern/löschen nur Verfasser:in, Einträge von FK4/SL alle FK4/SL. Verfasserfelder sind per Trigger unveränderlich.
- `dp_effective` berücksichtigt `staff.data.overrides` (follow / shift / none).

### Nachtrag 2026-11-21: Autodisposition, Regelwerk, Export, Offline

- Migration `20261121090000_dienstplan_rules` (live): `dp_staff_private.rules` für Regeln je Person (gesundheitliche Einschränkungen, Vorlieben). Nur FK4/SL und Planer lesen und schreiben (RLS wie Personalnummer).
- Betriebsweites Regelwerk in `dp_settings.data.dispo`: Qualifikation je Arbeitsplatz, „(X)“ zählt mit, Vorlieben, gleichmäßige Verteilung, Überhang verteilen.
- Autodisposition (`app/src/dienstplan/dispo.ts`) läuft auf dem Gerät der FK4/SL, Ergebnis wird als Vorschlag gezeigt und erst auf Knopfdruck geschrieben (Upsert in `dp_entries`, RLS: nur can_plan).
- Export Excel (.xlsx, selbst geschrieben, fflate) und PDF (jsPDF) für Monat und Jahresübersicht. Web: Download; iOS/Android: Teilen-Dialog über expo-sharing. In der Artifact-Vorschau sind Downloads gesperrt.
- Offline lesen: Im Live-Betrieb werden Dienstplan-Abfragen 7 Tage auf dem Gerät gehalten (TanStack Query Persist, AsyncStorage).
