// F02 Chef plant eine Woche (S03, S05), F03 Zuweisung ändern (S04).
import { candidateRow, chip, expect, loginAs, test } from './fixtures';

test.describe('F02/F03 Planen', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'chef');
  });

  test('F02-H1 Woche zeigt 7 Tage, heute markiert, Unterbesetzung als Text', async ({ page }) => {
    await expect(page.getByText(/· Heute/).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /drucken$/ })).toHaveCount(7);
    await expect(page.getByText(/\d\/\d · fehlt/i).first()).toBeVisible();
  });

  test('F02-H2 Mira am Mittwoch früh einteilen, mit Hinweisen', async ({ page }) => {
    await page.getByRole('button', { name: 'Zuweisen: Frühschicht' }).nth(2).click();
    await expect(page).toHaveURL(/\/zuweisen\?/);
    const mira = candidateRow(page, 'Mira Okafor');
    await expect(mira).toContainText('Ruhezeit unter 11 h');
    // Der Monatshinweis (40 h) hängt davon ab, wie viele Demo-Schichten der Woche im laufenden Monat liegen
    if (new Date().getDate() <= 22) await expect(mira).toContainText('von 40 h im Monat');
    await mira.click();
    await expect(page).toHaveURL(/\/plan$/);
    await expect(chip(page, 'Mira Okafor')).toHaveCount(4);
  });

  test('F02-E1 schon Eingeteilte sind markiert und nicht wählbar', async ({ page }) => {
    await page.getByRole('button', { name: 'Zuweisen: Frühschicht' }).first().click();
    await expect(page.getByText('Schon in dieser Schicht')).toHaveCount(2);
    await expect(candidateRow(page, 'Lena Kraus')).toHaveCount(0);
  });

  test('F02-E2 Doppelklick auf eine Person teilt sie nur einmal ein', async ({ page }) => {
    await page.getByRole('button', { name: 'Zuweisen: Frühschicht' }).nth(2).click();
    await candidateRow(page, 'Paul Brandt').dblclick();
    await expect(page).toHaveURL(/\/plan$/);
    // Paul hat im Seed 3 Schichten in dieser Woche; jetzt genau eine mehr.
    await expect(chip(page, 'Paul Brandt')).toHaveCount(4);
  });

  test('F02-E3 Zurück mitten im Zuweisen ändert nichts', async ({ page }) => {
    const all = page.getByRole('button', { name: /(Vollzeit|Teilzeit|Aushilfe)$/ });
    const before = await all.count();
    expect(before).toBeGreaterThan(0);
    await page.getByRole('button', { name: 'Zuweisen: Spätschicht' }).first().click();
    await expect(page).toHaveURL(/\/zuweisen\?/);
    await page.goBack();
    await expect(page).toHaveURL(/\/plan$/);
    await expect(all).toHaveCount(before);
  });

  test('F02-E4 Wochenwechsel vor und zurück', async ({ page }) => {
    const thisWeek = page.getByRole('button', { name: 'Diese Woche' });
    await expect(thisWeek).toBeDisabled();
    const title = await page.getByRole('heading').first().innerText();
    await page.getByRole('button', { name: 'Nächste Woche' }).click();
    await expect(page.getByRole('heading').first()).not.toHaveText(title);
    await expect(thisWeek).toBeEnabled();
    await thisWeek.click();
    await expect(page.getByRole('heading').first()).toHaveText(title);
  });

  test('F03-H1 Zuweisung über das Aktionsmenü löschen', async ({ page }) => {
    const lena = chip(page, 'Lena Kraus');
    const n = await lena.count();
    expect(n).toBeGreaterThan(0);
    await lena.first().click();
    await page.getByRole('button', { name: 'Zuweisung löschen' }).click();
    await expect(page.getByText(/ist nicht mehr in der/)).toBeVisible();
    await expect(lena).toHaveCount(n - 1);
  });
});

test.describe('F02 Layout', () => {
  test('F02-E5 alle Tagesspalten gleich breit, keine waagrechte Scrollleiste', async ({ page }) => {
    await loginAs(page, 'chef');
    await expect(page.getByRole('button', { name: /drucken$/ })).toHaveCount(7);
    const boxes = await page.getByRole('button', { name: /drucken$/ }).evaluateAll((els) =>
      els.map((e) => {
        let n: HTMLElement | null = e as HTMLElement;
        for (let i = 0; i < 4 && n; i++) n = n.parentElement;
        return Math.round(n?.getBoundingClientRect().width ?? 0);
      }));
    expect(new Set(boxes).size).toBe(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  });
});
