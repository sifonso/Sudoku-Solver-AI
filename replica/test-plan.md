# Testplan: Schichtplaner (Rebuild)

Build: e3713d6  Datum: 2026-11-16
Umgebungen:
- **e2e:** Web-Build im Demo-Modus, Telefon 390 px und Desktop 1440 px. Aufruf: `npm run test:e2e` in `app/`.
- **live:** Supabase-Projekt `afrgpfjslsewdkipqcvi`. Aufruf: `npm run test:live` mit `SB_URL`, `SB_PUB` und `SB_SECRET`.
- **domain:** Zeit- und Regellogik ohne UI. Aufruf: `npm run test:domain`.

Ergebnis: e2e 62/62 (31 Fälle × 2 Breiten), live 7/7, domain 9/9. Jeder e2e-Test schlägt fehl bei Konsolenfehlern, Seitenfehlern oder 5xx-Antworten.

Spalte „auto“:
- **e2e / live / domain:** automatisiert in der jeweiligen Suite.
- **manuell:** braucht ein echtes Gerät oder einen echten Dienst.
- **–:** Screen noch nicht gebaut (Meilenstein 2).

## Gebaute Flows

| Fall | Flow | Typ | Schritte | Erwartet | auto | Ergebnis |
| --- | --- | --- | --- | --- | --- | --- |
| F01-H1 | F01 Registrierung/Login | happy | Demo-Chef anmelden | landet in /plan mit Betriebsname | e2e | pass |
| F01-H2 | F01 | happy | Betrieb registrieren | /plan mit Früh- und Spätschicht | e2e | pass |
| F01-H3 | F01 | happy | echtes Konto bestätigt, erster Login | Betrieb aus Registrierungsdaten angelegt | live (app-UI, einmalig) | pass |
| F01-E1 | F01 | edge: leere Eingaben | leeres Formular absenden | alle 5 Fehlermeldungen, kein Absenden | e2e | pass |
| F01-E2 | F01 | edge: Umlaute, ß, Emoji | „Grüße & Söhne 🍞 Café“ | Adresse `gruesse-soehne-cafe` | e2e | pass |
| F01-E3 | F01 | edge: sehr lange Eingabe | 60 Zeichen Betriebsname | kein waagrechtes Scrollen | e2e | pass |
| F01-E4 | F01 | edge: Doppelklick | „Betrieb anlegen“ doppelt | ein Betrieb, kein Fehler | e2e | pass |
| F01-E5 | F01 | edge: E-Mail-Bestätigung | Registrierung gegen Supabase | Hinweis „Bitte E-Mail bestätigen“, Mail kommt an | manuell | offen (Mailversand, siehe backend.md) |
| F01-N1 | F01 | negativ: E-Mail vergeben | chef@demo.de registrieren | Meldung „schon ein Konto“ | e2e | pass |
| F01-N2 | F01 | negativ: Adresse vergeben | „Café Morgenrot“ | Meldung „Firmenadresse vergeben“ | e2e | pass |
| F01-N3 | F01 | negativ: Gast ruft RPC auf | create_tenant ohne Login | 42501 | live | pass |
| S02-N1 | Login | negativ: falsches Passwort | | Meldung, bleibt auf /login | e2e | pass |
| S02-E1 | Login | edge: nur Tastatur | Tab, Eingabe, Tab, Enter | angemeldet | e2e | pass |
| S02-E2 | Login | edge: Aufruf ohne Login | /plan direkt | Umleitung auf /login | e2e | pass |
| S02-E3 | Login | edge: abgelaufene Sitzung | Token abgelaufen, App im Vordergrund | Auto-Refresh oder zurück zum Login | manuell | offen |
| F02-H1 | F02 Woche planen | happy | Plan öffnen | 7 Tage, „Heute“, Unterbesetzung als Text | e2e | pass |
| F02-H2 | F02 | happy | Mira Mi früh zuweisen | Hinweise Ruhezeit + Monatsgrenze, Chip im Plan | e2e | pass |
| F02-E1 | F02 | edge: schon eingeteilt | Zuweisen öffnen | Eingeteilte markiert, nicht wählbar | e2e | pass |
| F02-E2 | F02 | edge: Doppelklick | Person doppelt antippen | genau eine Zuweisung | e2e | pass |
| F02-E3 | F02 | edge: Zurück mitten im Ablauf | Zuweisen öffnen, Zurück | nichts geändert | e2e | pass |
| F02-E4 | F02 | edge: Wochenwechsel | vor/zurück/„Diese Woche“ | Titel wechselt, Knopf-Zustand stimmt | e2e | pass |
| F02-E5 | F02 | edge: Breite | 390 und 1440 px | gleich breite Spalten, kein waagrechtes Scrollen | e2e | pass |
| F02-E6 | F02 | edge: Zeitumstellung | Nachtschicht 27./28.03.2027 | 7 h | live + domain | pass |
| F02-E7 | F02 | edge: zwei Planer gleichzeitig | überlappende Zuweisung | DB lehnt ab (23P01) | live | pass |
| F02-E8 | F02 | edge: Neuladen mitten im Ablauf | Zuweisen offen, Neuladen | Supabase: Sitzung bleibt; Demo: Daten zurückgesetzt (gewollt) | live (app-UI, einmalig) | pass |
| F02-N1 | F02 | negativ: Mitarbeiterin plant | Insert als Mitarbeiterin | 42501 | live | pass |
| F03-H1 | F03 Zuweisung ändern | happy | Chip → „Zuweisung löschen“ | Hinweis, ein Chip weniger | e2e | pass |
| F03-E1 | F03 | „Zeiten bearbeiten“ | | öffnet S29 | e2e (nur Navigation) | Stub |
| F04-H1 | F04 Mitarbeiter sieht Plan | happy | Chef teilt ein, Mira meldet sich an | Banner + Mitteilung, danach gelesen | e2e | pass |
| F04-H2 | F04 | Rollen | Mira angemeldet | nur Schichten/Schnell/Tausch/Mehr | e2e | pass |
| F04-E1 | F04 | Inhalt | Mira | Stunden und Kollegen sichtbar | e2e | pass |
| F04-E2 | F04 | edge: Daten anderer Nutzer | fremde Person liest 8 Tabellen | 0 Zeilen | live | pass |
| F04-E3 | F04 | edge: offline | Flugmodus | letzter Plan sichtbar | manuell | offen (Offline-Cache noch nicht gebaut) |
| F04-E4 | F04 | Push | Chef teilt ein | Push aufs Telefon | manuell | offen (EAS-Projekt fehlt) |
| ACC-H1 | Konto | Abmelden | Abmelden, Zurück | bleibt auf /login | e2e | pass |
| ACC-H2 | Konto | Löschen als einziger Chef | zwei Bestätigungen | Konto + Betrieb weg, Login scheitert | e2e + live | pass |
| ACC-E1 | Konto | Löschen abbrechen | | nichts geändert | e2e | pass |
| ACC-E2 | Konto | Löschen als Mitarbeiterin | | archiviert, Historie bleibt | live | pass |
| LIVE-03 | F01 Einladung | Einladen + Einlösen | invite-member, claim_invitations | aktiv; Nicht-Chef 403; zweites Einlösen 0 | live | pass |
| LIVE-05 | Rechte | Tarifspalte | Chef/Mitarbeiterin ändern `plan` | 42501 | live | pass |
| A11Y-* | S01, S02, S03, S05, S21, S25, Mehr | axe WCAG 2.1 AA | | 0 Verstöße | e2e | pass (nach BUG-001–003) |
| SR-1 | alle gebauten | Screenreader | VoiceOver/TalkBack | sinnvolle Namen, Reihenfolge | manuell | offen (kein Gerät hier) |

## Noch nicht gebaute Flows

| Flow | Fälle (Auswahl) | Stand |
| --- | --- | --- |
| F05 Urlaub beantragen/genehmigen | H: Antrag → Push → Genehmigen → im Plan. E: Urlaubssperre, Resturlaub, Mindestbesetzung. N: Antrag in Sperre (DB lehnt ab, lokal getestet) | – |
| F06 Krankmeldung und Ersatz | H: Ein-Tap → Planer benachrichtigt → Ersatz anfragen. E: niemand verfügbar, zwei sagen zu | – |
| F07 Schichttausch | H: anbieten → bewerben → freigeben. E: Qualifikation fehlt, Überschneidung, Ablauf. N: doppelte Freigabe (DB lehnt ab, lokal getestet) | – |
| F08 Aufgaben | H: Aufgabe an Schichttyp, abhaken. E: offline doppelt hochgeladen (DB idempotent, lokal getestet) | – |
| F09 HACCP-Temperatur | H: Erinnerung → Wert erfassen. E: Wert außerhalb Grenze, Export | – |
| F10 Monatsstatistik | H: Monat wählen, Export. E: Zeitumstellung in den Stunden | – (stats_month lokal getestet) |
| F11 Drucken | H: Tagesplan drucken | Web: Browserdruck; nativ offen |
| Zahlung | N: Karte abgelehnt (`4000 0000 0000 0002`) | – (Stripe fehlt) |
