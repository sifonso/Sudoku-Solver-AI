// Dienstplan nach Excel-Muster: Monatsplan, Jahresübersicht, Team, Rhythmus, Einstellungen, Tauschbörse.
import { expect, loginDp, openTab, test } from './fixtures';

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
    await page.getByRole('radio', { name: 'T2', exact: true }).click();
    await page.getByRole('radio', { name: /^N\b/ }).click();
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
});
