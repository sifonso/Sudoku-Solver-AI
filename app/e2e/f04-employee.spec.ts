// F04 Mitarbeiter sieht seinen Plan (S21), Mitteilungen (S25), Rollen.
import { candidateRow, expect, loginAs, signOut, test } from './fixtures';

test.describe('F04 Mitarbeiter-Sicht', () => {
  test('F04-H1 Chef teilt Mira ein, Mira sieht Schicht und Mitteilung', async ({ page }) => {
    await loginAs(page, 'chef');
    await page.getByRole('button', { name: 'Zuweisen: Frühschicht' }).nth(2).click();
    await candidateRow(page, 'Mira Okafor').click();
    await expect(page).toHaveURL(/\/plan$/);
    await signOut(page);

    await page.getByRole('button', { name: 'Mitarbeiterin (Mira Okafor)' }).click();
    await expect(page).toHaveURL(/\/meine$/);
    await expect(page.getByText('Neue Schicht')).toBeVisible();
    await expect(page.getByRole('button', { name: /Benachrichtigungen, 1 ungelesen/ })).toBeVisible();
    await page.getByRole('button', { name: /Benachrichtigungen, 1 ungelesen/ }).click();
    await expect(page.getByLabel(/^Neu: Neue Schicht/)).toContainText(/Frühschicht am Mi/);
    // Nach kurzer Zeit gelten sichtbare Mitteilungen als gelesen
    await expect(page.getByRole('button', { name: 'Benachrichtigungen', exact: true })).toBeVisible({ timeout: 5000 });
  });

  test('F04-H2 Mira sieht nur ihre Reiter', async ({ page }) => {
    await loginAs(page, 'mira');
    for (const t of ['Schichten', 'Schnell', 'Tausch', 'Mehr']) {
      await expect(page.getByRole('tab', { name: new RegExp(t) })).toBeVisible();
    }
    for (const t of ['Plan', 'Personal', 'Aufgaben']) {
      await expect(page.getByRole('tab', { name: new RegExp(`^${t}`) })).toHaveCount(0);
    }
  });

  test('F04-E1 Schichten-Liste zeigt Stunden und Kollegen', async ({ page }) => {
    await loginAs(page, 'mira');
    await expect(page.getByText(/\d+ Schichten · \d+(\.\d)? h/)).toBeVisible();
    await expect(page.getByText(/^Mit /).first()).toBeVisible();
  });
});
