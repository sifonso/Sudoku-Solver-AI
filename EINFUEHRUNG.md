# Einführung im geschlossenen Umfeld

Stand 23.11.2026. Für eine Gruppe mit 32 Planstellen (33 Personen), 6 FK4 / SL und einer FK3.

## Wie die App erreichbar ist

Die App besteht aus zwei Teilen:

1. **Datenbank und Anmeldung:** Supabase, Projekt in Frankfurt (eu-central-1). Zugriff nur mit Login. Jede Tabelle ist pro Betrieb abgeschottet (Row Level Security); Mitarbeitende sehen keine Personalnummern und keine gesundheitlichen Einschränkungen.
2. **Oberfläche:** dieselbe App läuft im Browser (Rechner, Handy) und als iOS/Android-App.

„Geschlossen“ heißt hier:

- Neue Konten entstehen nur mit Einladungscode von FK4 / SL (Code 14 Tage gültig, einmal verwendbar).
- Nach dem Anlegen des eigenen Betriebs wird das Anlegen weiterer Betriebe in der Datenbank gesperrt (`app_config.allow_new_tenants = false`).
- Die Web-Version wird mit `EXPO_PUBLIC_INVITE_ONLY=1` gebaut; dann gibt es auf der Anmeldeseite nur „Mit Einladungscode registrieren“.

### Verteilung, drei Wege

| Weg | Aufwand | Hinweis |
| --- | --- | --- |
| **Web-App** unter einer eigenen Adresse (z. B. Netlify, Vercel oder ein Firmenserver) | gering | Auf dem Handy „Zum Home-Bildschirm“, sieht aus wie eine App. Push-Mitteilungen braucht hier eine zusätzliche Web-Push-Anbindung. |
| **Expo Go** (Test) | gering | Nur zum Ausprobieren, nicht für den Dauerbetrieb. |
| **Native App** intern | mittel | iOS: Apple Developer Program und TestFlight oder Verteilung über Apple Business Manager. Android: APK direkt oder interner Test in Google Play. Push über Expo. |

Empfehlung für den Start: Web-App unter eigener Adresse, später bei Bedarf native App.

### Noch geschlossener: Betrieb im Firmennetz

Supabase lässt sich selbst betreiben (Docker). Die Web-App ist eine statische Seite und läuft auf jedem Webserver im Intranet. Das braucht die Firmen-IT.

## Vor dem Echtbetrieb klären

- **Betriebsrat:** Dienstplanung, Planungsprotokoll („wer hat wann was geändert“) und Mitteilungen sind eine technische Einrichtung, die Verhalten oder Leistung überwachen kann; Mitbestimmung nach § 87 Abs. 1 Nr. 6 BetrVG. Quelle: https://www.gesetze-im-internet.de/betrvg/__87.html
- **Datenschutz:** Beschäftigtendaten (§ 26 BDSG, https://www.gesetze-im-internet.de/bdsg_2018/__26.html). Gesundheitliche Einschränkungen sind besondere Kategorien nach Art. 9 DSGVO; Supabase und ein Hosting-Anbieter sind Auftragsverarbeiter nach Art. 28 DSGVO (Vertrag nötig). Verordnungstext: https://eur-lex.europa.eu/eli/reg/2016/679/oj
- **Firmen-IT:** ob Dienstplandaten bei einem externen Anbieter liegen dürfen oder intern betrieben werden müssen.

## Planstellen und Teilzeit

Eine Planstelle kann mehrere Personen haben, z. B. „23a“ und „23b“ mit sich ergänzendem Grundturnus. Jede Person hat ihren eigenen 16-Wochen-Turnus und eigenen Urlaubsanspruch. Weitere Abteilungen werden später als eigener Betrieb mit eigener Schichtstärke, eigenen Arbeitsplätzen und eigenen FK4 / SL angelegt.

## Rollen

| Rolle | Darf |
| --- | --- |
| Mitarbeiter | eigenen Plan, Team, Tausch, Urlaubswünsche, Kommentare, Dokumente lesen |
| FK4 / SL | planen, Autodisposition, Regelwerk, Einstellungen, Urlaub vormerken, Protokolle, Dokumente ablegen |
| FK3 | Login als Mitarbeiter, in den Einstellungen als Freigabe eingetragen: Jahresurlaub freigeben, Dokumente ablegen |
