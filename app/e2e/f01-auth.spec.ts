// F01 Firma registriert sich (S01) und Anmeldung (S02).
import { DEMO, expect, openTab, signOut, test } from './fixtures';

test.describe('F01 Registrierung und Anmeldung', () => {
  test('F01-H1 Demo-Chef landet im Plan, Mitarbeiterin bei ihren Schichten', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/login$/);
    await page.getByRole('button', { name: DEMO.chef }).click();
    await expect(page).toHaveURL(/\/plan$/);
    await expect(page.getByText('Café Morgenrot', { exact: false }).first()).toBeVisible();
  });

  test('F01-H2 neuer Betrieb wird angelegt und hat Standard-Schichttypen', async ({ page }) => {
    await page.goto('/registrieren');
    await page.getByLabel('Name des Betriebs').fill('Bäckerei Sonnenschein');
    await page.getByLabel('Dein Name').fill('Ali Demir');
    await page.getByLabel('E-Mail').fill('ali@test.de');
    await page.getByLabel('Passwort').fill('geheim123');
    await page.getByRole('checkbox').click();
    await page.getByRole('button', { name: 'Betrieb anlegen' }).click();
    await expect(page).toHaveURL(/\/plan$/);
    await expect(page.getByText('Frühschicht').first()).toBeVisible();
    await expect(page.getByText('Spätschicht').first()).toBeVisible();
  });

  test('F01-E1 leeres Formular zeigt alle Fehler und schickt nichts ab', async ({ page }) => {
    await page.goto('/registrieren');
    await page.getByRole('button', { name: 'Betrieb anlegen' }).click();
    for (const msg of ['Bitte den Namen deines Betriebs eingeben.', 'Bitte deinen Namen eingeben.',
      'Bitte eine gültige E-Mail-Adresse eingeben.', 'Mindestens 8 Zeichen.', 'Bitte AGB und Datenschutz bestätigen.']) {
      await expect(page.getByText(msg).first()).toBeVisible();
    }
    await expect(page).toHaveURL(/\/registrieren$/);
  });

  test('F01-E2 Umlaute, ß und Emoji ergeben eine gültige Firmenadresse', async ({ page }) => {
    await page.goto('/registrieren');
    await page.getByLabel('Name des Betriebs').fill('Grüße & Söhne 🍞 Café');
    await expect(page.getByLabel('Firmenadresse')).toHaveValue('gruesse-soehne-cafe');
  });

  test('F01-E3 60 Zeichen langer Betriebsname bricht das Layout nicht', async ({ page }) => {
    const name = 'Gasthaus zur langen Bezeichnung mit sehr vielen Zeichen GmbH';
    expect(name.length).toBeGreaterThanOrEqual(60);
    await page.goto('/registrieren');
    await page.getByLabel('Name des Betriebs').fill(name);
    await page.getByLabel('Dein Name').fill('Lange Name');
    await page.getByLabel('E-Mail').fill('lang@test.de');
    await page.getByLabel('Passwort').fill('geheim123');
    await page.getByRole('checkbox').click();
    await page.getByRole('button', { name: 'Betrieb anlegen' }).click();
    await expect(page).toHaveURL(/\/plan$/);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test('F01-E4 Doppelklick auf "Betrieb anlegen" legt nur einen Betrieb an', async ({ page }) => {
    await page.goto('/registrieren');
    await page.getByLabel('Name des Betriebs').fill('Doppelklick Bistro');
    await page.getByLabel('Dein Name').fill('Dana Doppel');
    await page.getByLabel('E-Mail').fill('dana@test.de');
    await page.getByLabel('Passwort').fill('geheim123');
    await page.getByRole('checkbox').click();
    await page.getByRole('button', { name: 'Betrieb anlegen' }).dblclick();
    await expect(page).toHaveURL(/\/plan$/);
    await expect(page.getByRole('alert')).toHaveCount(0);
  });

  test('F01-N1 schon vergebene E-Mail wird gemeldet', async ({ page }) => {
    await page.goto('/registrieren');
    await page.getByLabel('Name des Betriebs').fill('Zweitbetrieb');
    await page.getByLabel('Dein Name').fill('Jana Wilke');
    await page.getByLabel('E-Mail').fill('chef@demo.de');
    await page.getByLabel('Passwort').fill('geheim123');
    await page.getByRole('checkbox').click();
    await page.getByRole('button', { name: 'Betrieb anlegen' }).click();
    await expect(page.getByText('Mit dieser E-Mail gibt es schon ein Konto.', { exact: false })).toBeVisible();
  });

  test('F01-N2 schon vergebene Firmenadresse wird gemeldet', async ({ page }) => {
    await page.goto('/registrieren');
    await page.getByLabel('Name des Betriebs').fill('Café Morgenrot');
    await page.getByLabel('Dein Name').fill('Neu Person');
    await page.getByLabel('E-Mail').fill('neu@test.de');
    await page.getByLabel('Passwort').fill('geheim123');
    await page.getByRole('checkbox').click();
    await page.getByRole('button', { name: 'Betrieb anlegen' }).click();
    await expect(page.getByText('Diese Firmenadresse ist vergeben.', { exact: false })).toBeVisible();
  });

  test('S02-N1 falsches Passwort', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('E-Mail').fill('chef@demo.de');
    await page.getByLabel('Passwort').fill('falsch');
    await page.getByRole('button', { name: 'Anmelden' }).click();
    await expect(page.getByText('E-Mail oder Passwort stimmen nicht', { exact: false })).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });

  test('S02-E1 Anmeldung nur mit Tastatur', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('button', { name: 'Anmelden' })).toBeVisible();
    await page.keyboard.press('Tab');
    await expect(page.getByLabel('E-Mail')).toBeFocused();
    await page.keyboard.type('mira@demo.de');
    await page.keyboard.press('Tab');
    await expect(page.getByLabel('Passwort')).toBeFocused();
    await page.keyboard.type('demo1234');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/meine$/);
  });

  test('S02-E2 Geschützte Seite ohne Login führt zur Anmeldung', async ({ page }) => {
    await page.goto('/plan');
    await expect(page).toHaveURL(/\/login$/);
  });

  test('F01-H4 Einladungscode: Chef lädt ein, neue Person registriert sich mit Code und landet im Betrieb', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: DEMO.chef }).click();
    await expect(page.getByText('Frühschicht').first()).toBeVisible();
    await openTab(page, 'Personal');
    await page.getByRole('button', { name: 'Einladen' }).click();
    await page.getByLabel('Name', { exact: true }).fill('Nora Neu');
    await page.getByLabel('E-Mail').fill('nora@test.de');
    await page.getByRole('button', { name: 'Einladung senden' }).click();
    const code = await page.getByText(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/).innerText();
    await page.getByRole('button', { name: 'Zum Team' }).click();
    await signOut(page);

    await page.getByRole('link', { name: 'Firma registrieren' }).click();
    await page.getByRole('radio', { name: 'Mit Einladungscode' }).click();
    await expect(page.getByRole('heading', { name: 'Team beitreten' })).toBeVisible();
    await page.getByLabel('Einladungscode').fill(code.toLowerCase().replace('-', ''));
    await page.getByLabel('E-Mail').filter({ visible: true }).fill('nora@test.de');
    await page.getByLabel('Passwort').filter({ visible: true }).fill('geheim123');
    await page.getByRole('checkbox').filter({ visible: true }).click();
    await page.getByRole('button', { name: 'Konto anlegen und beitreten' }).click();
    await expect(page).toHaveURL(/\/meine$/);
    await expect(page.getByText('Hallo Nora')).toBeVisible();
    await expect(page.getByText('Café Morgenrot').first()).toBeVisible();
  });

  test('F01-N3 ungültiger Einladungscode wird abgelehnt', async ({ page }) => {
    await page.goto('/registrieren');
    await page.getByRole('radio', { name: 'Mit Einladungscode' }).click();
    await page.getByLabel('Einladungscode').fill('ABCD-EFGH');
    await page.getByLabel('E-Mail').fill('falsch@test.de');
    await page.getByLabel('Passwort').fill('geheim123');
    await page.getByRole('checkbox').click();
    await page.getByRole('button', { name: 'Konto anlegen und beitreten' }).click();
    await expect(page.getByText('gehört noch zu keinem Betrieb', { exact: false })).toBeVisible();
    await page.getByLabel('Einladungscode').fill('ABCD-EFGH');
    await page.getByRole('button', { name: 'Beitreten' }).click();
    await expect(page.getByText('Dieser Einladungscode ist ungültig, abgelaufen oder schon benutzt.')).toBeVisible();
  });
});
