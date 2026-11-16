// axe-Prüfung (WCAG 2.1 A/AA) auf jedem gebauten Screen.
import { memberRow, axe, expect, loginAs, openTab, test } from './fixtures';

test.describe('Barrierefreiheit (axe)', () => {
  test('A11Y-S02 Anmeldung', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('button', { name: 'Anmelden' })).toBeVisible();
    expect(await axe(page)).toEqual([]);
  });

  test('A11Y-S01 Registrierung mit Fehlern', async ({ page }) => {
    await page.goto('/registrieren');
    await page.getByRole('button', { name: 'Betrieb anlegen' }).click();
    expect(await axe(page)).toEqual([]);
  });

  test('A11Y-S03 Plan', async ({ page }) => {
    await loginAs(page, 'chef');
    await expect(page.getByText('Frühschicht').first()).toBeVisible();
    expect(await axe(page)).toEqual([]);
  });

  test('A11Y-S05 Zuweisen', async ({ page }) => {
    await loginAs(page, 'chef');
    await page.getByRole('button', { name: 'Zuweisen: Frühschicht' }).first().click();
    await expect(page.getByText('Schon in dieser Schicht').first()).toBeVisible();
    expect(await axe(page)).toEqual([]);
  });

  test('A11Y-S21 Meine Schichten', async ({ page }) => {
    await loginAs(page, 'mira');
    await expect(page.getByText(/Schichten ·/)).toBeVisible();
    expect(await axe(page)).toEqual([]);
  });

  test('A11Y-S25 Mitteilungen und Mehr', async ({ page }) => {
    await loginAs(page, 'mira');
    await page.getByRole('button', { name: /^Benachrichtigungen/ }).click();
    await expect(page.getByText('Keine Mitteilungen')).toBeVisible();
    expect(await axe(page)).toEqual([]);
    await page.getByRole('button', { name: 'Zurück' }).click();
    await openTab(page, 'Mehr');
    expect(await axe(page)).toEqual([]);
  });
});

test.describe('Barrierefreiheit (axe) M2', () => {
  test('A11Y-S07 Personal und S08 Einladen/Bearbeiten', async ({ page }) => {
    await loginAs(page, 'chef');
    await openTab(page, 'Personal');
    await expect(page.getByText('6 aktiv')).toBeVisible();
    expect(await axe(page)).toEqual([]);
    await page.getByRole('button', { name: 'Einladen' }).click();
    await page.getByRole('button', { name: 'Einladung senden' }).click();
    expect(await axe(page)).toEqual([]);
    await page.getByRole('button', { name: 'Zurück' }).click();
    await memberRow(page, 'Tom Sander').click();
    await expect(page.getByLabel('Stundengrenze pro Monat')).toBeVisible();
    expect(await axe(page)).toEqual([]);
  });
});
