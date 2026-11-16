// F10 Monatsstatistik (S11/S12) mit CSV-Export.
import { axe, expect, loginAs, openTab, test, type Page } from './fixtures';

async function openStats(page: Page) {
  await loginAs(page, 'chef');
  await openTab(page, 'Personal');
  await page.getByRole('button', { name: 'Statistik' }).click();
  await expect(page.getByText(/\d+ Schichten · [\d,]+ h/).first()).toBeVisible();
}

test.describe('F10 Statistik', () => {
  test('F10-H1 Monat zeigt Summe und Zeilen pro Person', async ({ page }) => {
    await openStats(page);
    const month = new Intl.DateTimeFormat('de-DE', { month: 'long', year: 'numeric', timeZone: 'Europe/Berlin' }).format(new Date());
    await expect(page.getByRole('heading', { name: month })).toBeVisible();
    await expect(page.getByText('Mira Okafor').filter({ visible: true }).first()).toBeVisible();
    await expect(page.getByText('Lena Kraus').filter({ visible: true }).first()).toBeVisible();
  });

  test('F10-H2 CSV-Export: Datei, BOM, Semikolon, deutsche Spalten', async ({ page }) => {
    await openStats(page);
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Export (CSV)' }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/^schichten-\d{4}-\d{2}\.csv$/);
    const path = await download.path();
    const { readFileSync } = await import('node:fs');
    const text = readFileSync(path!, 'utf8');
    expect(text.charCodeAt(0)).toBe(0xfeff);
    expect(text).toContain('Monat;Name;Kürzel;Beschäftigung;Schichten;Stunden;Krankheitstage;Urlaubstage');
    expect(text).toMatch(/;Mira Okafor;MO;aushilfe;\d+;[\d,]+;\d+;\d+\r\n/);
    await expect(page.getByText('CSV-Datei heruntergeladen.')).toBeVisible();
  });

  test('F10-H3 Detail: Schichten einer Person, Monatsgrenze, Monatswechsel', async ({ page }) => {
    await openStats(page);
    await page.getByRole('button', { name: /Mira Okafor/ }).filter({ visible: true }).first().click();
    await expect(page.getByText(/^Grenze 40 h/)).toBeVisible();
    await expect(page.getByText(/· Frühschicht|· Spätschicht/).first()).toBeVisible();
    await page.getByRole('button', { name: 'Zurück', exact: true }).click();
    await page.getByRole('button', { name: 'Voriger Monat' }).click();
    await page.getByRole('button', { name: 'Nächster Monat' }).click();
    await page.getByRole('button', { name: 'Nächster Monat' }).click();
    await expect(page.getByText(/^\d+ Schichten · [\d,]+ h$/).first()).toBeVisible();
  });

  test('A11Y-S11/S12', async ({ page }) => {
    await openStats(page);
    expect(await axe(page)).toEqual([]);
    await page.getByRole('button', { name: /Mira Okafor/ }).filter({ visible: true }).first().click();
    await expect(page.getByText(/^Grenze 40 h/)).toBeVisible();
    expect(await axe(page)).toEqual([]);
  });
});
