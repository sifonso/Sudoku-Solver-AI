# Änderungsprotokoll

Änderungen an der App, neueste zuerst. Dieselben Einträge zeigt die App unter Mehr → Änderungen an der App (Quelle: app/src/changelog.ts).

## 0.8 · 23.11.2026

- Jahresurlaubsplanung: Wünsche mit Priorität, FK4 / SL merkt vor und genehmigt nach dem mündlichen OK der FK3; genehmigter Urlaub steht als U im Dienstplan
- Übersicht nach Kalenderwochen mit Warnung, wenn zu viele gleichzeitig im Urlaub sind; Urlaubsanspruch je Person
- Optional: FK3 gibt selbst in der App frei (in den Einstellungen eintragen)
- Bereich „Regeln und Betriebsvereinbarungen“ mit Datei-Upload (bis 20 MB) für FK4 / SL und FK3
- Geschlossener Betrieb: Registrierung nur noch mit Einladungscode möglich

## 0.7 · 21.11.2026

- Autodisposition nach Regelwerk: Pflichtdienste zuerst, dann Zusatzdienste in fester Reihenfolge, Rest ohne Arbeitsplatz
- Vorschlag der Autodisposition als Monatsplan mit Nachbearbeitung; erst „Veröffentlichen“ schreibt in den Plan
- Hinweis im Monatsplan, wenn Pflichtdienste unbesetzt sind
- Regelwerk: mehrere Qualifikationen je Arbeitsplatz, Qualifikationen bearbeiten, Fahrgemeinschaften, bevorzugte und ungeliebte Schichten je Person
- Personen aus dem Team entfernen, wieder aufnehmen oder endgültig löschen; Einladen direkt aus der Personen-Seite
- Einladen nur noch mit Rolle Mitarbeiter oder FK4 / SL und Vollzeit oder Teilzeit
- Planungsprotokoll: wer hat wann welchen Dienst geändert (Plan, Tausch, Autodisposition, Turnus)
- Mitteilungen zum Dienstplan: Dienständerung, Tauschvorschlag, Anfrage, Genehmigung, veröffentlichte Autodisposition, unbesetzte Pflichtdienste
- Dieses Änderungsprotokoll

## 0.6 · 21.11.2026

- Erste Autodisposition mit Regelwerk (Qualifikationen, Sperren, Vorlieben)
- Export von Monat und Jahresübersicht als Excel und PDF
- Offline lesen: Dienstplan bleibt 7 Tage auf dem Gerät gespeichert
- Im vorübergehenden Turnus keine grauen Kürzel ohne Arbeitsplatz

## 0.5 · 20.11.2026

- Tausch aus Monats- und Jahresansicht, 1:1 auch am selben Tag, Dreieckstausch mit Zustimmung aller
- FK4 / SL kann Tausche anlegen und für andere anbieten
- Kommentare und Markierungen je Tag
- Schnellwahl je Arbeitsplatz im Änderungsfenster, Dienste ohne Arbeitsplatz
- Vorübergehender Turnus (z. B. Ausbildung beim Trainer)
- Ganzer Monat sichtbar, Feiertage Bayern dezent markiert, Jahresansicht besser lesbar

## 0.4 · 20.11.2026

- Dienstplan nach Excel-Vorlage: Monatsübersicht als Startseite, Jahresübersicht, 16-Wochen-Grundturnus
- Team-Übersicht: Zuordnung, Qualifikationen, Telefonliste, Fahrgemeinschaften
- Tauschbörse mit abschaltbarer Genehmigung, Rolle „Chef“ heißt FK4 / SL

## 0.3 · 16.11.2026

- Einladen per Code, Anbindung an Supabase, Last-Test mit 40 Personen

## 0.1 · 16.11.2026

- Erste Fassung: Wochenplan, Personal, Urlaub, Krankmeldung, Aufgaben, Schnellaktionen
