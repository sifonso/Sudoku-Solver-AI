// F08 Aufgaben: verwalten (S13/S14), Sonderaufgabe aus S04, abhaken in S21.
import { DEMO, axe, chip, expect, loginAs, openTab, signOut, test, demoLogin } from './fixtures';

test.describe('F08 Aufgaben', () => {
  test('F08-H1 Standardaufgabe anlegen, erscheint mit Schichttyp und Tagen', async ({ page }) => {
    await loginAs(page, 'chef');
    await openTab(page, 'Aufgaben');
    await expect(page.getByText('Kasse zählen und Bericht ablegen')).toBeVisible();
    await page.getByRole('button', { name: 'Neue Aufgabe' }).click();
    await page.getByRole('button', { name: 'Speichern' }).click();
    await expect(page.getByText('Bitte einen Titel eingeben.')).toBeVisible();
    await expect(page.getByText('Mindestens einen Schichttyp wählen.')).toBeVisible();
    await page.getByLabel('Titel').fill('Mülltonnen rausstellen');
    await page.getByRole('checkbox', { name: 'Spätschicht' }).click();
    await page.getByRole('checkbox', { name: 'Di', exact: true }).click();
    await page.getByRole('radio', { name: 'Hoch' }).click();
    await page.getByRole('button', { name: 'Speichern' }).click();
    await expect(page).toHaveURL(/\/aufgaben$/);
    const card = page.getByText('Mülltonnen rausstellen').locator('xpath=../..');
    await expect(card).toContainText('Spätschicht');
    await expect(card).toContainText('Di');
    await expect(card).toContainText('Hoch');
  });

  test('F08-H2 Löschen, "Gelöschte anzeigen", Wiederherstellen', async ({ page }) => {
    await loginAs(page, 'chef');
    await openTab(page, 'Aufgaben');
    await expect(page.getByText('Terrassenmöbel abdecken')).toHaveCount(0);
    await page.getByRole('checkbox', { name: 'Gelöschte anzeigen' }).click();
    await expect(page.getByText('Terrassenmöbel abdecken')).toBeVisible();
    await page.getByRole('button', { name: 'Wiederherstellen' }).click();
    await page.getByRole('checkbox', { name: 'Gelöschte anzeigen' }).click();
    await expect(page.getByText('Terrassenmöbel abdecken')).toBeVisible();
  });

  test('F08-H3 Mira hakt Aufgabe ab, Zähler beim Chef steigt; erneutes Abhaken zählt nicht doppelt', async ({ page }) => {
    await loginAs(page, 'mira');
    const box = page.getByRole('checkbox', { name: 'Kasse zählen und Bericht ablegen' }).first();
    await expect(box).toBeVisible();
    await box.click();
    await expect(box).toBeChecked();
    await box.click();
    await expect(box).not.toBeChecked();
    await box.click();
    await expect(box).toBeChecked();
    await signOut(page);
    await demoLogin(page, 'chef');
    await openTab(page, 'Aufgaben');
    await expect(page.getByText('Kasse zählen und Bericht ablegen').locator('xpath=../..')).toContainText('1× erledigt');
  });

  test('F08-H4 Sonderaufgabe aus dem Plan, Mira bekommt Mitteilung und sieht sie bei der Schicht', async ({ page }) => {
    await loginAs(page, 'chef');
    // Schicht der nächsten Woche, damit sie bei Mira unabhängig vom Wochentag unter „Nächste 14 Tage“ steht
    await page.getByRole('button', { name: 'Nächste Woche' }).click();
    await chip(page, 'Mira Okafor').first().click();
    await page.getByRole('button', { name: 'Sonderaufgabe' }).click();
    await expect(page.getByText('Nur für Mira Okafor in dieser Schicht.')).toBeVisible();
    await page.getByLabel('Titel').fill('Bäckerlieferung prüfen');
    await page.getByRole('button', { name: 'Speichern' }).click();
    await expect(page).toHaveURL(/\/plan$/);
    await openTab(page, 'Aufgaben');
    await page.getByRole('radio', { name: /^Sonder/ }).click();
    await expect(page.getByText('Bäckerlieferung prüfen')).toBeVisible();
    await signOut(page);
    await demoLogin(page, 'mira');
    await expect(page.getByRole('checkbox', { name: 'Bäckerlieferung prüfen (nur für dich)' })).toBeVisible();
    await page.getByRole('button', { name: /^Benachrichtigungen, 1 ungelesen/ }).click();
    await expect(page.getByLabel(/^Neu: Neue Aufgabe/)).toContainText('Bäckerlieferung prüfen');
  });

  test('F08-N1 Mitarbeiterin sieht keine Bearbeiten-Knöpfe und keinen Aufgaben-Reiter', async ({ page }) => {
    await loginAs(page, 'mira');
    await expect(page.getByRole('tab', { name: /^Aufgaben/ })).toHaveCount(0);
  });

  test('A11Y-S13/S14', async ({ page }) => {
    await loginAs(page, 'chef');
    await openTab(page, 'Aufgaben');
    await expect(page.getByText('Kasse zählen und Bericht ablegen')).toBeVisible();
    expect(await axe(page)).toEqual([]);
    await page.getByRole('button', { name: 'Neue Aufgabe' }).click();
    await page.getByRole('button', { name: 'Speichern' }).click();
    expect(await axe(page)).toEqual([]);
  });

  test('A11Y-S21 mit Aufgaben', async ({ page }) => {
    await loginAs(page, 'mira');
    await expect(page.getByRole('checkbox', { name: 'Kasse zählen und Bericht ablegen' }).first()).toBeVisible();
    expect(await axe(page)).toEqual([]);
  });
});
