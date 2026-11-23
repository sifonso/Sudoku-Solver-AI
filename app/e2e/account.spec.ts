// Konto: Abmelden, Konto löschen (Apple-Pflicht).
import { expect, loginAs, openTab, signOut, test, demoLogin } from './fixtures';

test.describe('Konto', () => {
  test('ACC-H1 Abmelden führt zur Anmeldung, Zurück führt nicht zurück in die App', async ({ page }) => {
    await loginAs(page, 'chef');
    await signOut(page);
    await page.goBack();
    await expect(page).toHaveURL(/\/login$/);
  });

  test('ACC-H2 einziger Chef: zweite Bestätigung, dann Konto und Betrieb weg', async ({ page }) => {
    await page.goto('/registrieren');
    await page.getByLabel('Name der Abteilung').fill('Testladen');
    await page.getByLabel('Dein Name').fill('Kim Test');
    await page.getByLabel('E-Mail').fill('kim@test.de');
    await page.getByLabel('Passwort').fill('geheim123');
    await page.getByRole('checkbox').click();
    await page.getByRole('button', { name: 'Abteilung anlegen' }).click();
    await expect(page).toHaveURL(/\/monat$/);
    await openTab(page, 'Mehr');
    await page.getByRole('button', { name: 'Konto löschen' }).click();
    await page.getByRole('button', { name: 'Endgültig löschen' }).click();
    await expect(page.getByText('Damit wird auch Testladen gelöscht')).toBeVisible();
    await page.getByRole('button', { name: 'Konto und Betrieb löschen' }).click();
    await expect(page).toHaveURL(/\/login$/);
    await page.getByLabel('E-Mail').fill('kim@test.de');
    await page.getByLabel('Passwort').fill('geheim123');
    await page.getByRole('button', { name: 'Anmelden' }).click();
    await expect(page.getByText('E-Mail oder Passwort stimmen nicht', { exact: false })).toBeVisible();
  });

  test('ACC-E1 Löschen abbrechen lässt alles, wie es war', async ({ page }) => {
    await loginAs(page, 'mira');
    await openTab(page, 'Mehr');
    await page.getByRole('button', { name: 'Konto löschen' }).click();
    await page.getByRole('button', { name: 'Abbrechen' }).click();
    await expect(page.getByRole('button', { name: 'Konto löschen' })).toBeVisible();
    await signOut(page);
    await demoLogin(page, 'mira');
    await expect(page).toHaveURL(/\/meine$/);
  });
});
