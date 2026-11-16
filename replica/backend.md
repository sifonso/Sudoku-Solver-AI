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
| Zahlungen | Stripe Checkout, Customer Portal, Webhook `stripe-webhook` mit Signaturprüfung und `stripe_events` | du: Stripe-Konto im Testmodus; ich: Code |
| E-Mail | Eigenes SMTP für Auth-Mails, Absender-Domain (Pflicht vor echten Nutzern, siehe oben) | du |
| Passwort vergessen | Screen + `resetPasswordForEmail` + Deep Link | ich |
| Jobs | `expire-swaps`, `trial-expiry`, `purge-tenants`, `quick-action-reminders` per pg_cron | ich |
| Generierte Typen | `supabase gen types` statt untypisierter Zeilen in `supabase.ts` | ich, nach Verbindung |
| Rate Limits | Supabase Auth begrenzt Login und Registrierung selbst; `invite-member` noch ohne eigene Grenze | ich |

## Sicherheits-Checkliste

- [x] Geheimnisse nur in Umgebungsvariablen; `.env*.local` in `app/.gitignore`; im App-Bundle nur URL und anon-Key
- [x] Eingaben serverseitig geprüft: Check-Constraints im Schema, Validierung in `invite-member`
- [x] Rechte bei jedem Lesen und Schreiben über RLS, mit zweitem und fremdem Nutzer getestet (lokal und live)
- [ ] Rate Limits: Auth über Supabase; eigene Grenze für `invite-member` fehlt
- [ ] Webhooks prüfen Signaturen: `send-push` prüft ein Geheimnis im Header; Stripe-Webhook noch nicht gebaut
- [ ] Uploads: noch keine (Logo für Branding kommt später, dann mit Größen- und Typgrenze)
- [x] Keine Nutzerdaten in URLs; Push-Texte ohne Gesundheitsbezug
- [ ] `npm audit`: meldet Funde in Entwicklungs-Abhängigkeiten von Expo, noch nicht ausgewertet
- [ ] Datenschutzerklärung mit allen Auftragsverarbeitern: Supabase, Expo (Push), Apple/Google (Push-Zustellung), später Stripe und Mail-Anbieter
