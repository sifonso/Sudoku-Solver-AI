// F09 Schnellaktionen: Kacheln (S16), Ordner (S18), Eintragen (S17), Verwalten (S19), Heute (S20).
import { axe, expect, loginAs, openTab, test, type Page } from './fixtures';

async function openQuickAsChef(page: Page) {
  await openTab(page, 'Mehr');
  await page.getByRole('button', { name: /^Schnellaktionen S16/ }).click();
  await expect(page.getByRole('button', { name: /^Kühlung/ })).toBeVisible();
}

test.describe('F09 Schnellaktionen', () => {
  test('F09-H1 Kacheln: Aktionen, Ordner, Heute, Aufgaben', async ({ page }) => {
    await loginAs(page, 'mira');
    await openTab(page, 'Schnell');
    await expect(page.getByRole('button', { name: /^Kühlung/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Inventur Getränke/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Reinigung 2 Aktionen/ })).toBeVisible();
    await page.getByRole('button', { name: /^Heute Wer arbeitet heute/ }).click();
    await expect(page.getByText('Heute im Dienst')).toBeVisible();
    await expect(page.getByText(/Heute ist niemand eingeplant|Frühschicht|Spätschicht|Sonntagsdienst|Nachtschicht/).filter({ visible: true }).first()).toBeVisible();
  });

  test('F09-H2 Temperatur: Pflichtfelder, Abweichung sofort sichtbar, gespeichert mit Hinweis', async ({ page }) => {
    await loginAs(page, 'mira');
    await openTab(page, 'Schnell');
    await page.getByRole('button', { name: /^Kühlung/ }).click();
    await page.getByRole('button', { name: 'Speichern' }).click();
    await expect(page.getByText('Pflichtfeld')).toHaveCount(3);
    await page.getByLabel('Kühlhaus 1 (°C)').fill('4');
    await page.getByLabel('Kühlvitrine (°C)').fill('5,5');
    await page.getByLabel('Tiefkühler (°C)').fill('-12');
    await expect(page.getByText(/Außerhalb des Sollbereichs \(-25 bis -18 °C\)/)).toBeVisible();
    await page.getByRole('button', { name: 'Speichern' }).click();
    await expect(page.getByText('Gespeichert, aber außerhalb der Grenzwerte.')).toBeVisible();
    await expect(page.getByText('Abweichung')).toBeVisible();
    await expect(page.getByText(/Heute, \d\d:\d\d · Mira Okafor/)).toBeVisible();
    await expect(page.getByLabel('Kühlhaus 1 (°C)')).toHaveValue('');
  });

  test('F09-E1 Text in Zahlenfeld wird abgefangen', async ({ page }) => {
    await loginAs(page, 'mira');
    await openTab(page, 'Schnell');
    await page.getByRole('button', { name: /^Kühlung/ }).click();
    await page.getByLabel('Kühlhaus 1 (°C)').fill('kalt');
    await page.getByRole('button', { name: 'Speichern' }).click();
    await expect(page.getByText('Bitte eine Zahl eingeben.')).toBeVisible();
  });

  test('F09-H3 Ordner öffnen, Häkchen-Aktion speichern', async ({ page }) => {
    await loginAs(page, 'mira');
    await openTab(page, 'Schnell');
    await page.getByRole('button', { name: /^Reinigung 2 Aktionen/ }).click();
    await page.getByRole('button', { name: /^Theke desinfiziert/ }).click();
    await page.getByRole('checkbox', { name: 'Erledigt' }).click();
    await page.getByRole('button', { name: 'Speichern' }).click();
    await expect(page.getByText('Gespeichert.', { exact: true })).toBeVisible();
  });

  test('F09-H4 Chef legt Schnellaktion mit neuem Ordner an', async ({ page }) => {
    await loginAs(page, 'chef');
    await openQuickAsChef(page);
    await page.getByRole('button', { name: 'Schnellaktionen verwalten', exact: true }).click();
    await page.getByRole('button', { name: 'Neue Schnellaktion' }).click();
    await page.getByLabel('Name', { exact: true }).fill('Spülmaschine');
    await page.getByRole('radio', { name: 'Temperatur' }).click();
    await page.getByRole('radio', { name: 'Burgund' }).click();
    await page.getByRole('radio', { name: 'Neuer Ordner' }).click();
    await page.getByLabel('Name des neuen Ordners').fill('Küche');
    await page.getByLabel('Bezeichnung Feld 1').fill('Spültemperatur');
    await page.getByLabel('Einheit Feld 1').fill('°C');
    await page.getByLabel('Min Feld 1').fill('90');
    await page.getByLabel('Max Feld 1').fill('60');
    await page.getByLabel('Erinnerungen').fill('09:00, 25:00');
    await page.getByRole('button', { name: 'Speichern' }).click();
    await expect(page.getByText('Minimum ist größer als Maximum.')).toBeVisible();
    await expect(page.getByText('„25:00“ ist keine Uhrzeit (HH:MM).')).toBeVisible();
    await page.getByLabel('Min Feld 1').fill('60');
    await page.getByLabel('Max Feld 1').fill('90');
    await page.getByLabel('Erinnerungen').fill('09:00, 14:30');
    await page.getByRole('button', { name: 'Speichern' }).click();
    await expect(page.getByText('„Spülmaschine“ gespeichert.')).toBeVisible();
    await expect(page.getByText(/Küche · 1 Feld · Erinnerung 09:00, 14:30/).filter({ visible: true })).toBeVisible();
    // BUG-012: Titel nicht auf Buchstabenbreite gequetscht
    const titleBox = await page.getByText('Spülmaschine', { exact: true }).filter({ visible: true }).boundingBox();
    expect(titleBox!.width).toBeGreaterThan(60);
    await page.getByRole('button', { name: 'Zurück', exact: true }).click();
    await page.getByRole('button', { name: /^Küche 1 Aktion/ }).click();
    await page.getByRole('button', { name: /^Spülmaschine/ }).click();
    await page.getByLabel('Spültemperatur (°C)').fill('85');
    await page.getByRole('button', { name: 'Speichern' }).click();
    await expect(page.getByText('Gespeichert.', { exact: true })).toBeVisible();
  });

  test('F09-E2 Entfernen: Kachel weg, Mitarbeiterin ohne Verwalten', async ({ page }) => {
    await loginAs(page, 'chef');
    await openQuickAsChef(page);
    await page.getByRole('button', { name: 'Schnellaktionen verwalten', exact: true }).click();
    await page.getByRole('button', { name: 'Inventur Getränke entfernen' }).click();
    await expect(page.getByRole('button', { name: 'Inventur Getränke entfernen' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Zurück', exact: true }).click();
    await expect(page.getByRole('button', { name: /^Inventur Getränke/ })).toHaveCount(0);
  });

  test('F09-N1 Mitarbeiterin sieht keinen Verwalten-Knopf', async ({ page }) => {
    await loginAs(page, 'mira');
    await openTab(page, 'Schnell');
    await expect(page.getByRole('button', { name: /^Kühlung/ })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Schnellaktionen verwalten', exact: true })).toHaveCount(0);
  });

  test('A11Y-S16/S17/S19/S20', async ({ page }) => {
    await loginAs(page, 'chef');
    await openQuickAsChef(page);
    expect(await axe(page)).toEqual([]);
    await page.getByRole('button', { name: /^Kühlung/ }).click();
    await page.getByRole('button', { name: 'Speichern' }).click();
    expect(await axe(page)).toEqual([]);
    await page.getByRole('button', { name: 'Zurück', exact: true }).click();
    await page.getByRole('button', { name: 'Schnellaktionen verwalten', exact: true }).click();
    await page.getByRole('button', { name: 'Neue Schnellaktion' }).click();
    expect(await axe(page)).toEqual([]);
    await page.getByRole('button', { name: 'Abbrechen' }).click();
    await page.getByRole('button', { name: 'Zurück', exact: true }).click();
    await page.getByRole('button', { name: /^Heute Wer arbeitet heute/ }).click();
    expect(await axe(page)).toEqual([]);
  });
});
