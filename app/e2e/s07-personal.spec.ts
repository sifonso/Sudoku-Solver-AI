// S07/S08 Personal: Team, Einladen, Bearbeiten, Sperren, Entfernen.
import { memberRow, candidateRow, chip, expect, loginAs, openTab, test } from './fixtures';

test.describe('S07/S08 Personal', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'chef');
    await openTab(page, 'Personal');
    await expect(page.getByText('6 aktiv')).toBeVisible();
  });

  test('P-H1 Team nach Beschäftigungsart gruppiert', async ({ page }) => {
    await expect(page.getByText('VOLLZEIT · 3')).toBeVisible();
    await expect(page.getByText('TEILZEIT · 1')).toBeVisible();
    await expect(page.getByText('AUSHILFEN · 2')).toBeVisible();
    await expect(page.getByText('Jana Wilke (du)')).toBeVisible();
  });

  test('P-H2 Einladen: Kürzel aus Namen, danach einplanbar', async ({ page }) => {
    await page.getByRole('button', { name: 'Einladen' }).click();
    await page.getByLabel('Name').fill('Ömer Yıldız');
    await expect(page.getByLabel('Kürzel')).toHaveValue('ÖY');
    await page.getByRole('radio', { name: 'Aushilfe' }).click();
    await page.getByLabel('E-Mail').fill('oemer@test.de');
    await page.getByRole('button', { name: 'Einladung senden' }).click();
    await expect(page.getByText('Ömer Yıldız ist eingeladen')).toBeVisible();
    await expect(page.getByText(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/)).toBeVisible();
    await page.getByRole('button', { name: 'Zum Team' }).click();
    await expect(page.getByText('EINGELADEN · 1')).toBeVisible();

    await openTab(page, 'Plan');
    await page.getByRole('button', { name: 'Zuweisen: Frühschicht' }).nth(2).click();
    await expect(candidateRow(page, 'Ömer Yıldız')).toBeVisible();
  });

  test('P-N1 Einladen: Pflichtfelder und belegtes Kürzel', async ({ page }) => {
    await page.getByRole('button', { name: 'Einladen' }).click();
    await page.getByRole('button', { name: 'Einladung senden' }).click();
    await expect(page.getByText('Bitte den Namen eingeben.')).toBeVisible();
    await expect(page.getByText('Bitte eine gültige E-Mail-Adresse eingeben.')).toBeVisible();
    await page.getByLabel('Name').fill('Lea Klein');
    await expect(page.getByLabel('Kürzel')).toHaveValue('LK');
    await page.getByLabel('E-Mail').fill('lea@test.de');
    await page.getByRole('button', { name: 'Einladung senden' }).click();
    await expect(page.getByText('Dieses Kürzel hat schon jemand im Team.')).toBeVisible();
  });

  test('P-H3 Stundengrenze setzen erscheint in der Liste und als Hinweis', async ({ page }) => {
    await memberRow(page, 'Tom Sander').click();
    await page.getByLabel('Stundengrenze pro Monat').fill('10');
    await page.getByRole('button', { name: 'Speichern' }).click();
    await expect(page.getByText('Gespeichert.')).toBeVisible();
    await page.getByRole('button', { name: 'Zurück' }).click();
    await expect(memberRow(page, 'Tom Sander')).toContainText('max. 10 h/Monat');
  });

  test('P-E1 Ungültige Stundengrenze wird abgelehnt', async ({ page }) => {
    await memberRow(page, 'Tom Sander').click();
    await page.getByLabel('Stundengrenze pro Monat').fill('-3');
    await page.getByRole('button', { name: 'Speichern' }).click();
    await expect(page.getByText('Eine Zahl zwischen 1 und 744.')).toBeVisible();
  });

  test('P-N2 Letzter Chef kann sich nicht herabstufen oder sperren', async ({ page }) => {
    await memberRow(page, 'Jana Wilke \\(du\\)').click();
    await page.getByRole('radio', { name: 'Planer' }).click();
    await page.getByRole('button', { name: 'Speichern' }).click();
    await expect(page.getByText('Es muss mindestens ein aktiver Chef bleiben.', { exact: false })).toBeVisible();
    await page.getByRole('button', { name: 'Sperren' }).click();
    await expect(page.getByText('Es muss mindestens ein aktiver Chef bleiben.', { exact: false })).toBeVisible();
  });

  test('P-H4 Gesperrte Person wird nicht mehr vorgeschlagen', async ({ page }) => {
    await memberRow(page, 'Paul Brandt').click();
    await page.getByRole('button', { name: 'Sperren' }).click();
    await expect(page.getByText('Gesperrt.')).toBeVisible();
    await page.getByRole('button', { name: 'Zurück' }).click();
    await expect(page.getByText('GESPERRT · 1')).toBeVisible();
    await openTab(page, 'Plan');
    await page.getByRole('button', { name: 'Zuweisen: Frühschicht' }).nth(2).click();
    await expect(candidateRow(page, 'Lena Kraus').or(page.getByText('Schon in dieser Schicht')).first()).toBeVisible();
    await expect(candidateRow(page, 'Paul Brandt')).toHaveCount(0);
  });

  test('P-H5 Entfernen: weg aus dem Team, vergangene Schichten bleiben im Plan', async ({ page }) => {
    await memberRow(page, 'Sofia Reyes').click();
    await page.getByRole('button', { name: 'Aus dem Team entfernen' }).click();
    await page.getByRole('button', { name: 'Entfernen' }).click();
    await expect(page).toHaveURL(/\/personal$/);
    await expect(page.getByText('5 aktiv')).toBeVisible();
    await expect(memberRow(page, 'Sofia Reyes')).toHaveCount(0);
    await openTab(page, 'Plan');
    await expect(chip(page, 'Sofia Reyes').first()).toBeVisible();
  });
});

test('P-E2 Statistik-Knopf reagiert beim ersten Tipp auch auf 390 px (BUG-013)', async ({ page }) => {
  await loginAs(page, 'chef');
  await openTab(page, 'Personal');
  await expect(page.getByText('6 aktiv')).toBeVisible();
  const before = await page.getByRole('button', { name: 'Statistik', exact: true }).boundingBox();
  await page.getByRole('button', { name: 'Statistik', exact: true }).focus();
  const after = await page.getByRole('button', { name: 'Statistik', exact: true }).boundingBox();
  expect(after).toEqual(before);
  await page.getByRole('button', { name: 'Statistik', exact: true }).click();
  await expect(page).toHaveURL(/\/statistik$/);
});
