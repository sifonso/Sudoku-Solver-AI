// Dienstplan nach Excel-Muster: Monatsplan, Jahresübersicht, Team, Rhythmus, Einstellungen, Tauschbörse.
import { DEMO, expect, loginDp, openTab, test } from './fixtures';

test.describe('Dienstplan', () => {
  test('DP-1 Monatsplan zeigt Personen, Feiertagszeile und Besetzungszähler', async ({ page }) => {
    await loginDp(page, 'chef');
    await expect(page.getByText('Schichtstärke').first()).toBeVisible();
    await expect(page.getByText('Verfügbar').first()).toBeVisible();
    await expect(page.getByRole('button', { name: /^Berger, 1\./ })).toBeVisible();
  });

  test('DP-2 FK4/SL trägt Arbeitsplatz und Schicht ein, der Zähler steigt', async ({ page }) => {
    await loginDp(page, 'chef');
    const cell = page.getByRole('button', { name: /^Berger, 2\./ });
    await cell.click();
    await page.getByRole('radio', { name: 'T2/N', exact: true }).click();
    await page.getByRole('button', { name: 'Speichern' }).click();
    await expect(cell).toHaveAttribute('aria-label', /T2\/N/);
    await cell.click();
    await page.getByRole('radio', { name: 'Urlaub' }).click();
    await page.getByRole('button', { name: 'Speichern' }).click();
    await expect(cell).toHaveAttribute('aria-label', /: U$/);
  });

  test('DP-3 Mitarbeiter:in kann nicht bearbeiten, nur eigene Dienste anbieten', async ({ page }) => {
    await loginDp(page, 'mira');
    await page.getByRole('button', { name: /^Carstens, 3\./ }).click();
    await expect(page.getByRole('button', { name: 'Speichern' })).toHaveCount(0);
  });

  test('DP-4 Jahresübersicht, Team-Tabellen und Grundrhythmus öffnen', async ({ page }) => {
    await loginDp(page, 'mira');
    await openTab(page, 'Jahr');
    await expect(page.getByText('Sonntagsdienste')).toBeVisible();
    await expect(page.getByText(/^Januar · \d+ Dienste$/)).toBeVisible();
    await openTab(page, 'Team');
    await expect(page.getByText('Rita Sommer')).toBeVisible();
    await page.getByRole('tab', { name: 'Qualifikationen' }).click();
    await expect(page.getByText('Summe (X)')).toBeVisible();
    await page.getByRole('tab', { name: 'Telefon' }).click();
    await expect(page.getByRole('link', { name: /Mobil anrufen/ }).first()).toBeVisible();
    await openTab(page, 'Mehr');
    await page.getByRole('button', { name: /^Grundrhythmus/ }).click();
    await expect(page.getByText(/Heute ist Tag \d+ von 112/)).toBeVisible();
  });

  test('DP-5 Tauschbörse: anbieten, anfragen, annehmen, FK4/SL genehmigt', async ({ page }) => {
    await loginDp(page, 'chef');
    // Demo-Schalter: als Berger anbieten
    await openTab(page, 'Mehr');
    await page.getByRole('radio', { name: 'Berger' }).click();
    await openTab(page, 'Tausch');
    await page.getByRole('button', { name: 'Anbieten' }).click();
    await page.getByRole('radiogroup', { name: 'Welcher Dienst?' }).getByRole('radio').first().click();
    await page.getByRole('button', { name: 'Anbieten' }).last().click();
    await expect(page.getByText('Noch keine Anfragen.')).toBeVisible();
    // als Person mit freiem Tag anfragen: die erste, bei der „Anfragen“ erscheint
    for (const who of ['Carstens', 'Diehl', 'Engel', 'Fuchs', 'Graf', 'Haas', 'Iske']) {
      await openTab(page, 'Mehr');
      await page.getByRole('radio', { name: who }).click();
      await openTab(page, 'Tausch');
      if (await page.getByRole('button', { name: 'Anfragen' }).count()) break;
    }
    await page.getByRole('button', { name: 'Anfragen' }).first().click();
    await page.getByRole('button', { name: 'Anfrage senden' }).click();
    await expect(page.getByText(/^Angefragt/)).toBeVisible();
    await openTab(page, 'Mehr');
    await page.getByRole('radio', { name: 'Berger' }).click();
    await openTab(page, 'Tausch');
    await page.getByRole('button', { name: 'Annehmen' }).click();
    await expect(page.getByText('Wartet auf Genehmigung').first()).toBeVisible();
    await openTab(page, 'Mehr');
    await page.getByRole('radio', { name: 'mein Login' }).click();
    await openTab(page, 'Tausch');
    await page.getByRole('button', { name: 'Genehmigen' }).click();
    await expect(page.getByText('Getauscht').first()).toBeVisible();
  });

  test('DP-6 Einstellungen: Genehmigungspflicht abschalten und Mindestbesetzung ändern', async ({ page }) => {
    await loginDp(page, 'chef');
    await openTab(page, 'Mehr');
    await page.getByRole('button', { name: /^Einstellungen Dienstplan/ }).click();
    await page.getByRole('checkbox', { name: /Genehmigung/ }).click();
    await page.getByRole('button', { name: 'T1/F erhöhen' }).click();
    await page.getByRole('button', { name: 'Speichern' }).click();
    await expect(page.getByText('Einstellungen gespeichert.')).toBeVisible();
    await page.getByRole('button', { name: 'Zurück' }).click();
    await openTab(page, 'Tausch');
    await expect(page.getByText('Ohne Genehmigung')).toBeVisible();
  });

  test('DP-7 Kommentar mit Markierung: alle dürfen schreiben, ändern nur Verfasser:in', async ({ page }) => {
    await loginDp(page, 'mira');
    const cell = page.getByRole('button', { name: /^Carstens, 5\./ });
    await cell.click();
    await page.getByLabel('Neuer Kommentar').fill('Fahrgemeinschaft klären');
    await page.getByRole('radio', { name: /^Markierung #/ }).first().click();
    await page.getByRole('button', { name: 'Hinzufügen' }).click();
    await expect(page.getByText('Fahrgemeinschaft klären')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Kommentar bearbeiten' })).toBeVisible();
    await page.getByRole('button', { name: 'Schließen', exact: true }).click();
    await expect(cell).toHaveAttribute('aria-label', /1 Kommentar/);
    // FK4/SL sieht den Kommentar, darf ihn aber nicht ändern
    await openTab(page, 'Mehr');
    await page.getByRole('button', { name: 'Abmelden' }).click();
    await page.getByRole('button', { name: DEMO.chef }).click(); // ohne Neuladen, Demodaten bleiben
    await expect(page.getByText('Besetzung').first()).toBeVisible();
    await page.getByRole('button', { name: /^Carstens, 5\./ }).click();
    await expect(page.getByText('Fahrgemeinschaft klären')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Kommentar bearbeiten' })).toHaveCount(0);
  });

  test('DP-8 Tausch am selben Tag aus dem Monatsplan: Vorschlag, Zustimmung, Genehmigung', async ({ page }) => {
    await loginDp(page, 'chef');
    // Demo: als Berger handeln und einen Tag finden, an dem Berger und Carstens beide Dienst haben
    await openTab(page, 'Mehr');
    await page.getByRole('radio', { name: 'Berger' }).click();
    await openTab(page, 'Monat');
    await page.getByRole('button', { name: 'Nächster Monat' }).click();
    let day = 0;
    for (let d = 1; d <= 28; d++) {
      const a = await page.getByRole('button', { name: new RegExp(`^Berger, ${d}\\.:`) }).getAttribute('aria-label');
      const b = await page.getByRole('button', { name: new RegExp(`^Carstens, ${d}\\.:`) }).getAttribute('aria-label');
      if (a && b && !/frei|: (U|K|Z|DT)\b/.test(a) && !/frei|: (U|K|Z|DT)\b/.test(b)) { day = d; break; }
    }
    expect(day).toBeGreaterThan(0);
    await page.getByRole('button', { name: new RegExp(`^Carstens, ${day}\\.:`) }).click();
    await page.getByRole('button', { name: 'Mit Carstens tauschen' }).click();
    await expect(page.getByText('Ergebnis')).toBeVisible();
    await expect(page.getByText(/^Berger: .* → /)).toBeVisible();
    await page.getByRole('button', { name: 'Vorschlag senden' }).click();
    await openTab(page, 'Mehr');
    await page.getByRole('radio', { name: 'Carstens' }).click();
    await openTab(page, 'Tausch');
    await expect(page.getByText('Wartet auf deine Zustimmung')).toBeVisible();
    await page.getByRole('button', { name: 'Zustimmen' }).click();
    await openTab(page, 'Mehr');
    await page.getByRole('radio', { name: 'mein Login' }).click();
    await openTab(page, 'Tausch');
    await page.getByRole('button', { name: 'Genehmigen' }).click();
    await expect(page.getByText('Getauscht').first()).toBeVisible();
  });

  test('DP-9 Änderungsfenster: Schnellwahl je Arbeitsplatz und Schicht ohne Arbeitsplatz', async ({ page }) => {
    await loginDp(page, 'chef');
    await page.getByRole('button', { name: /^Diehl, 6\./ }).click();
    await expect(page.getByRole('radio', { name: 'PA/N' })).toHaveCount(0); // Nacht nur an T1/T2
    await page.getByRole('radio', { name: 'S Spätdienst' }).click();
    await page.getByRole('button', { name: 'Speichern' }).click();
    await expect(page.getByRole('button', { name: /^Diehl, 6\./ })).toHaveAttribute('aria-label', /: S$/);
  });

  test('DP-10 Autodisposition: Regel setzen, Vorschlag berechnen, übernehmen', async ({ page }) => {
    await loginDp(page, 'chef');
    await page.getByRole('button', { name: 'Regelwerk' }).first().click();
    await page.getByRole('button', { name: /^Person:/ }).click();
    await page.getByRole('radio', { name: 'Berger' }).click();
    await page.getByRole('checkbox', { name: 'Gesperrte Schichten: N · Nachtdienst' }).click();
    await page.getByRole('checkbox', { name: 'Bevorzugte Schichten: F' }).click();
    await page.getByRole('button', { name: 'Regeln für Berger speichern' }).click();
    await expect(page.getByText('Regeln für Berger gespeichert.')).toBeVisible();
    await page.getByRole('button', { name: 'Zurück', exact: true }).click();
    await page.getByRole('button', { name: 'Autodisposition' }).click();
    await page.getByRole('button', { name: 'Zeitraum: nächster Monat' }).click();
    await page.getByRole('button', { name: 'Vorschlag berechnen' }).click();
    await expect(page.getByText(/^Vorschlag .*: \d+ Einträge$/)).toBeVisible();
    // Nachbearbeiten im Entwurf: erste vorgeschlagene Zelle ändern
    await page.getByRole('button', { name: /\(Vorschlag\)$/ }).first().click();
    await page.getByRole('radio', { name: 'S Spätdienst' }).click();
    await page.getByRole('button', { name: 'Speichern' }).click();
    await page.getByRole('button', { name: /^Veröffentlichen/ }).click();
    await expect(page.getByText('Veröffentlicht.', { exact: false })).toBeVisible();
    // Protokoll zeigt die Autodisposition
    await page.getByRole('button', { name: 'Zurück', exact: true }).click();
    await openTab(page, 'Mehr');
    await page.getByRole('button', { name: /^Planungsprotokoll/ }).click();
    await expect(page.getByText(/→/).filter({ visible: true }).first()).toBeVisible();
    await expect(page.getByText('Autodisposition', { exact: true }).filter({ visible: true }).first()).toBeVisible();
  });

  test('DP-11 Export Monat als Excel und PDF', async ({ page }, info) => {
    test.skip(info.project.name === 'phone', 'Download einmal reicht');
    await loginDp(page, 'chef');
    for (const [label, ext, magic] of [['Als Excel (.xlsx)', 'xlsx', 'PK'], ['Als PDF', 'pdf', '%PDF']] as const) {
      await page.getByRole('button', { name: 'Monat exportieren' }).click();
      const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: label }).click()]);
      expect(dl.suggestedFilename()).toMatch(new RegExp(`^Dienstplan_\\d{4}-\\d{2}\\.${ext}$`));
      const fs = await import('node:fs');
      const head = fs.readFileSync(await dl.path()).subarray(0, 4).toString('latin1');
      expect(head.startsWith(magic)).toBe(true);
    }
  });

  test('DP-12 Änderung durch FK4/SL: Mitteilung an die Person und Eintrag im Planungsprotokoll', async ({ page }) => {
    await loginDp(page, 'chef');
    await page.getByRole('button', { name: /^Berger, 9\./ }).click();
    await page.getByRole('radio', { name: 'T1/S', exact: true }).click();
    await page.getByRole('button', { name: 'Speichern' }).click();
    await openTab(page, 'Mehr');
    await page.getByRole('button', { name: /^Planungsprotokoll/ }).click();
    await expect(page.getByText(/^Berger am 9\./).first()).toBeVisible();
    await page.getByRole('button', { name: 'Zurück', exact: true }).click();
    await page.getByRole('button', { name: 'Abmelden' }).click();
    await page.getByRole('button', { name: DEMO.mira }).click();
    await expect(page.getByText('Besetzung').first()).toBeVisible();
    await page.getByRole('button', { name: /^Benachrichtigungen, 1 ungelesen/ }).click();
    await expect(page.getByText('Dienst geändert').first()).toBeVisible();
  });

  test('DP-13 Person aus dem Team entfernen und wieder aufnehmen', async ({ page }) => {
    await loginDp(page, 'chef');
    await openTab(page, 'Team');
    await page.getByRole('button', { name: /^Ida Jansen/ }).click();
    await page.getByRole('button', { name: 'Aus dem Team entfernen …' }).click();
    await page.getByRole('button', { name: 'Aus dem Team entfernen' }).click();
    await expect(page.getByText(/ist aus dem Team entfernt/)).toBeVisible();
    await page.getByRole('button', { name: 'Zurück', exact: true }).click();
    await openTab(page, 'Monat');
    await expect(page.getByRole('button', { name: /^Jansen, 1\./ })).toHaveCount(0);
    await openTab(page, 'Team');
    await page.getByRole('button', { name: /^Ida Jansen/ }).click();
    await page.getByRole('button', { name: 'Wieder ins Team aufnehmen' }).click();
    await page.getByRole('button', { name: 'Zurück', exact: true }).click();
    await openTab(page, 'Monat');
    await expect(page.getByRole('button', { name: /^Jansen, 1\./ })).toBeVisible();
  });
});
