# Backend

Supabase (Postgres + Auth + Edge Functions), Region Frankfurt. Die App wählt das Backend selbst: Mit
`EXPO_PUBLIC_SUPABASE_URL` und `EXPO_PUBLIC_SUPABASE_ANON_KEY` in `app/.env.local` spricht sie mit Supabase,
ohne diese Werte läuft sie mit Demodaten (`app/src/data/client.ts`).

## Dateien

| Pfad | Inhalt |
| --- | --- |
| `supabase/migrations/20261116120000_init.sql` | Schema, RLS, Trigger, RPCs (gleich `replica/schema.sql`) |
| `supabase/migrations/20261116120100_signup_invites_grants.sql` | `slug_available`, `claim_invitations`, Ausführungsrechte |
| `supabase/functions/delete-account` | Konto löschen (Apple-Pflicht) |
| `supabase/functions/invite-member` | Mitarbeiter einladen, Einladungs-Mail über Supabase Auth |
| `supabase/functions/send-push` | Push über Expo Push Service, ausgelöst per Database Webhook |
| `app/src/data/supabase.ts` | Datenschicht der App gegen Supabase |
| `app/.env.example` | Variablennamen ohne Werte |

## Einrichtung im Supabase-Projekt

Kein Access Token nötig. Alles über das Dashboard, plus einmal die Supabase-CLI auf deinem Rechner für die Funktionen.

1. **Region prüfen.** Unter Project Settings → General sollte „Central EU (Frankfurt)“ stehen. Eine andere Region lässt sich nachträglich nicht ändern; dann das Projekt neu anlegen.
2. **Schema einspielen.** SQL Editor → New query → Inhalt von `supabase/migrations/20261116120000_init.sql` einfügen → Run. Danach dasselbe mit `20261116120100_signup_invites_grants.sql`. Reihenfolge einhalten.
3. **Auth einstellen.** Authentication → Sign In / Providers → Email: „Confirm email“ an lassen. Mindestlänge Passwort auf 8 setzen (die App prüft ebenfalls 8).
4. **E-Mail-Versand.** Der eingebaute Mailversand von Supabase ist nur für Tests gedacht und stark begrenzt. Vor echten Nutzern unter Authentication → Emails → SMTP Settings einen eigenen Anbieter eintragen (geplant: Postmark oder Brevo). Dafür brauchst du ein Konto beim Anbieter und eine eigene Absender-Domain.
5. **Werte für die App.** Project Settings → API: „Project URL“ und den „anon“/„publishable“ Key in `app/.env.local` eintragen (Vorlage `app/.env.example`). Beide sind öffentlich. Der `service_role`-Key gehört **nie** in die App.
6. **Edge Functions deployen** (auf deinem Rechner, im Repo-Ordner):
   ```bash
   npx supabase login
   npx supabase link --project-ref <ref aus der Project URL>
   npx supabase functions deploy delete-account invite-member send-push
   npx supabase secrets set PUSH_WEBHOOK_SECRET=<langer Zufallswert>
   ```
   Falls `link` eine fehlende `supabase/config.toml` bemängelt: vorher `npx supabase init` und vorhandene Dateien behalten.
7. **Push-Webhook** (erst sinnvoll, wenn Push-Tokens existieren, siehe unten): Database → Webhooks → Create: Tabelle `notifications`, Event `INSERT`, Typ „Supabase Edge Functions“, Funktion `send-push`, HTTP-Header `x-webhook-secret` = derselbe Wert wie oben.
8. **Backups.** Im Free-Plan gibt es keine automatischen Backups. Vor echten Kundendaten auf einen bezahlten Plan wechseln und unter Database → Backups prüfen, dass tägliche Backups laufen.

## Was getestet ist

Gegen Postgres 16 mit einem Supabase-Auth-Stub, nicht gegen dein Projekt:

- **Nicht angemeldeter Besucher:** Darf nur `slug_available` aufrufen. `create_tenant` und Tabellenzugriffe werden abgewiesen.
- **Einladung:** Wird nur mit bestätigter E-Mail eingelöst, Groß- und Kleinschreibung der Adresse ist egal, und ein zweites Einlösen ergibt 0.
- **Fremder Nutzer:** Sieht 0 Betriebe, 0 Mitglieder, 0 Einladungen, 0 Mitteilungen und 0 Zuweisungen.
- **Betrieb löschen:** Entfernt alles abhängige sauber, auch Zuweisungen und Krankmeldungen.
- **Mitteilungs-Trigger:** Erzeugt beim Zuweisen und Austragen eine Mitteilung, aber nicht, wenn sich jemand selbst einteilt.
- **Schema-Regeln aus `architecture.md`:** Doppelbuchung, Tausch, Urlaubssperre, Zeitumstellung.
- **Edge Functions:** Bestehen die Deno-Typprüfung. Gegen dein Projekt deployed und aufgerufen sind sie noch nicht.
- **App-Datenschicht gegen Supabase:** Typgeprüft. Gegen dein Projekt läuft sie erst, sobald Schritt 2 und 5 erledigt sind.

## Offen

| Thema | Was fehlt | Wer |
| --- | --- | --- |
| Push | EAS-Projekt-ID in `app.json` (`extra.eas.projectId`), dafür Expo-Account; dann Webhook (Schritt 7). Bis dahin registriert die App kein Token. | du: Expo-Account; ich: Einbau |
| Zahlungen | Stripe Checkout, Customer Portal, Webhook `stripe-webhook` mit Signaturprüfung und `stripe_events` | du: Stripe-Konto im Testmodus; ich: Code |
| E-Mail | Eigenes SMTP für Auth-Mails, Absender-Domain | du |
| Passwort vergessen | Screen + `resetPasswordForEmail` + Deep Link | ich |
| Jobs | `expire-swaps`, `trial-expiry`, `purge-tenants`, `quick-action-reminders` per pg_cron | ich |
| Generierte Typen | `supabase gen types` statt untypisierter Zeilen in `supabase.ts` | ich, nach Verbindung |
| Rate Limits | Supabase Auth begrenzt Login und Registrierung selbst; `invite-member` noch ohne eigene Grenze | ich |

## Sicherheits-Checkliste

- [x] Geheimnisse nur in Umgebungsvariablen; `.env*.local` in `app/.gitignore`; im App-Bundle nur URL und anon-Key
- [x] Eingaben serverseitig geprüft: Check-Constraints im Schema, Validierung in `invite-member`
- [x] Rechte bei jedem Lesen und Schreiben über RLS, mit zweitem und fremdem Nutzer getestet (lokal)
- [ ] Rate Limits: Auth über Supabase; eigene Grenze für `invite-member` fehlt
- [ ] Webhooks prüfen Signaturen: `send-push` prüft ein Geheimnis im Header; Stripe-Webhook noch nicht gebaut
- [ ] Uploads: noch keine (Logo für Branding kommt später, dann mit Größen- und Typgrenze)
- [x] Keine Nutzerdaten in URLs; Push-Texte ohne Gesundheitsbezug
- [ ] `npm audit`: meldet Funde in Entwicklungs-Abhängigkeiten von Expo, noch nicht ausgewertet
- [ ] Datenschutzerklärung mit allen Auftragsverarbeitern: Supabase, Expo (Push), Apple/Google (Push-Zustellung), später Stripe und Mail-Anbieter
