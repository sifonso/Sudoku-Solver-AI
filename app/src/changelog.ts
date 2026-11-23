// Änderungsprotokoll der App. Neue Einträge oben anfügen; dieselben Punkte stehen in CHANGELOG.md.
export interface Release { version: string; date: string; items: string[] }

export const CHANGELOG: Release[] = [
  {
    version: '0.9', date: '2026-11-23', items: [
      'Flughafen München GmbH (FMG): Abteilungen statt Betrieb; Abteilungsname änderbar, weitere Abteilungen mit eigenem Team, Turnus und Regelwerk anlegen und wechseln',
      'AK braucht keine eigene Qualifikation: jede beliebige Qualifikation genügt',
      'Kürzel: UG Urlaub gewünscht, ZG Zeitausgleich gewünscht, Z Zeitausgleich, T tarifliche Freistellung, KiD Krank im Dienst, A Arbeitsbefreiung, D Dienstreise',
      'Urlaubsanspruch: 28 Tage bei Vollzeit, Teilzeit anteilig, plus Zusatzurlaub für Wechselschicht F/S/N (Zahl einstellbar, je Person übersteuerbar)',
      'Abgabefrist für Urlaubswünsche je Jahr; FK4 / SL schickt die Aufforderung an alle',
      'Genehmigten Urlaub ändern oder stornieren; Mitarbeitende beantragen Änderung oder Storno, FK4 / SL entscheidet',
      'Urlaubsübersicht nach Grundturnus der Gruppe mit Schichtstärke je Tag: bis 13 rot, 14 bis 15 gelb (Grenzen einstellbar)',
      'Flextage: 4 selbst gewählt, 2 vom Arbeitgeber; Auswahl an kritischen Tagen, nachdem FK4 / SL die Urlaubsplanung freigegeben hat',
      'Regel „gleichzeitig im Urlaub“ standardmäßig 6, Ausnahmen bleiben möglich',
    ],
  },
  {
    version: '0.8', date: '2026-11-23', items: [
      'Jahresurlaubsplanung: Wünsche mit Priorität, FK4 / SL merkt vor und genehmigt nach dem mündlichen OK der FK3; genehmigter Urlaub steht als U im Dienstplan',
      'Übersicht nach Kalenderwochen mit Warnung, wenn zu viele gleichzeitig im Urlaub sind; Urlaubsanspruch je Person',
      'Optional: FK3 gibt selbst in der App frei (in den Einstellungen eintragen)',
      'Bereich „Regeln und Betriebsvereinbarungen“ mit Datei-Upload (bis 20 MB) für FK4 / SL und FK3',
      'Geschlossener Betrieb: Registrierung nur noch mit Einladungscode möglich',
    ],
  },
  {
    version: '0.7', date: '2026-11-21', items: [
      'Autodisposition nach Regelwerk: Pflichtdienste zuerst, dann Zusatzdienste in fester Reihenfolge, Rest ohne Arbeitsplatz',
      'Vorschlag der Autodisposition als Monatsplan mit Nachbearbeitung; erst „Veröffentlichen“ schreibt in den Plan',
      'Hinweis im Monatsplan, wenn Pflichtdienste unbesetzt sind',
      'Regelwerk: mehrere Qualifikationen je Arbeitsplatz, Qualifikationen bearbeiten, Fahrgemeinschaften, bevorzugte und ungeliebte Schichten je Person',
      'Personen aus dem Team entfernen, wieder aufnehmen oder endgültig löschen; Einladen direkt aus der Personen-Seite',
      'Einladen nur noch mit Rolle Mitarbeiter oder FK4 / SL und Vollzeit oder Teilzeit',
      'Planungsprotokoll: wer hat wann welchen Dienst geändert (Plan, Tausch, Autodisposition, Turnus)',
      'Mitteilungen zum Dienstplan: Dienständerung, Tauschvorschlag, Anfrage, Genehmigung, veröffentlichte Autodisposition, unbesetzte Pflichtdienste',
      'Dieses Änderungsprotokoll',
    ],
  },
  {
    version: '0.6', date: '2026-11-21', items: [
      'Erste Autodisposition mit Regelwerk (Qualifikationen, Sperren, Vorlieben)',
      'Export von Monat und Jahresübersicht als Excel und PDF',
      'Offline lesen: Dienstplan bleibt 7 Tage auf dem Gerät gespeichert',
      'Im vorübergehenden Turnus keine grauen Kürzel ohne Arbeitsplatz',
    ],
  },
  {
    version: '0.5', date: '2026-11-20', items: [
      'Tausch aus Monats- und Jahresansicht, 1:1 auch am selben Tag, Dreieckstausch mit Zustimmung aller',
      'FK4 / SL kann Tausche anlegen und für andere anbieten',
      'Kommentare und Markierungen je Tag',
      'Schnellwahl je Arbeitsplatz im Änderungsfenster, Dienste ohne Arbeitsplatz',
      'Vorübergehender Turnus (z. B. Ausbildung beim Trainer)',
      'Ganzer Monat sichtbar, Feiertage Bayern dezent markiert, Jahresansicht besser lesbar',
    ],
  },
  {
    version: '0.4', date: '2026-11-20', items: [
      'Dienstplan nach Excel-Vorlage: Monatsübersicht als Startseite, Jahresübersicht, 16-Wochen-Grundturnus',
      'Team-Übersicht: Zuordnung, Qualifikationen, Telefonliste, Fahrgemeinschaften',
      'Tauschbörse mit abschaltbarer Genehmigung, Rolle „Chef“ heißt FK4 / SL',
    ],
  },
  {
    version: '0.3', date: '2026-11-16', items: ['Einladen per Code, Anbindung an Supabase, Last-Test mit 40 Personen'],
  },
  {
    version: '0.1', date: '2026-11-16', items: ['Erste Fassung: Wochenplan, Personal, Urlaub, Krankmeldung, Aufgaben, Schnellaktionen'],
  },
];
