// F07 Schichttausch (S24): anbieten, übernehmen, auswählen, freigeben/ablehnen.
import { DEMO, axe, expect, loginAs, openTab, signOut, test, type Page, demoLogin } from './fixtures';

async function openSwapAsChef(page: Page) {
  await openTab(page, 'Mehr');
  await page.getByRole('button', { name: /^Schichttausch \(Wochenplan\)/ }).click();
  await expect(page.getByText('Angebote von Kollegen')).toBeVisible();
}

async function miraOffersFirstShift(page: Page) {
  await loginAs(page, 'mira');
  await openTab(page, 'Schichttausch');
  await expect(page.getByText('MEINE ANGEBOTE · 0')).toBeVisible();
  await page.getByRole('button', { name: 'Anbieten' }).first().click();
  await expect(page.getByText('MEINE ANGEBOTE · 1')).toBeVisible();
  await expect(page.getByText('Offen', { exact: true }).first()).toBeVisible();
  await signOut(page);
}

test.describe('F07 Schichttausch', () => {
  test('F07-E0 Chef erreicht Tausch, Schnellaktionen und eigene Schichten über "Mehr" (BUG-008)', async ({ page }) => {
    await loginAs(page, 'chef');
    await openSwapAsChef(page);
    await openTab(page, 'Mehr');
    await page.getByRole('button', { name: /^Meine Schichten \(Wochenplan\)/ }).click();
    await expect(page.getByText(/Nächste 14 Tage/i)).toBeVisible();
    await openTab(page, 'Mehr');
    await page.getByRole('button', { name: /^Schnellaktionen S16/ }).click();
    await expect(page).toHaveURL(/\/schnell$/);
    // Ausgeblendete Reiter bleiben ausgeblendet
    await expect(page.getByRole('tab', { name: /^Schnell/ })).toHaveCount(0);
  });

  test('F07-H1 Mira meldet sich auf Lenas Angebot', async ({ page }) => {
    await loginAs(page, 'mira');
    await openTab(page, 'Schichttausch');
    await expect(page.getByText('Angeboten von Lena Kraus')).toBeVisible();
    await page.getByRole('button', { name: 'Ich übernehme' }).click();
    await expect(page.getByText('Du hast dich gemeldet')).toBeVisible();
  });

  test('F07-H2 anbieten → übernehmen → auswählen → freigeben, Plan ist aktualisiert', async ({ page }) => {
    await miraOffersFirstShift(page);

    await demoLogin(page, 'chef');
    await expect(page.getByText('Frühschicht').first()).toBeVisible();
    await openSwapAsChef(page);
    const offer = page.getByText('Angeboten von Mira Okafor').locator('xpath=..');
    await offer.getByRole('button', { name: 'Ich übernehme' }).click();
    await expect(offer.getByText('Du hast dich gemeldet')).toBeVisible();
    await signOut(page);

    await demoLogin(page, 'mira');
    await expect(page).toHaveURL(/\/meine$/);
    await page.getByRole('button', { name: /^Benachrichtigungen, 1 ungelesen/ }).click();
    await expect(page.getByLabel(/^Neu: Bewerbung auf deinen Tausch/)).toContainText('Jana Wilke');
    await page.getByRole('button', { name: 'Zurück', exact: true }).click();
    await openTab(page, 'Schichttausch');
    await page.getByRole('button', { name: 'Jana Wilke wählen' }).click();
    await expect(page.getByText('Der Tausch wartet jetzt auf die Freigabe', { exact: false })).toBeVisible();
    await expect(page.getByText('Wartet auf Freigabe', { exact: true })).toBeVisible();
    await signOut(page);

    await demoLogin(page, 'chef');
    await expect(page.getByText('Frühschicht').first()).toBeVisible();
    await openSwapAsChef(page);
    await expect(page.getByText('ZUR FREIGABE · 1')).toBeVisible();
    await expect(page.getByText('Mira Okafor → Jana Wilke')).toBeVisible();
    await expect(page.getByText(/Keine Hinweise|Hinweise zu Jana Wilke/).first()).toBeVisible();
    await page.getByRole('button', { name: 'Freigeben' }).click();
    await expect(page.getByText('Getauscht.')).toBeVisible();
    await expect(page.getByText('ZUR FREIGABE · 1')).toHaveCount(0);
  });

  test('F07-N1 Planer lehnt ab, Mira behält die Schicht', async ({ page }) => {
    await miraOffersFirstShift(page);
    await demoLogin(page, 'chef');
    await expect(page.getByText('Frühschicht').first()).toBeVisible();
    await openSwapAsChef(page);
    const offer = page.getByText('Angeboten von Mira Okafor').locator('xpath=..');
    await offer.getByRole('button', { name: 'Ich übernehme' }).click();
    await expect(offer.getByText('Du hast dich gemeldet')).toBeVisible();
    await signOut(page);
    await demoLogin(page, 'mira');
    await openTab(page, 'Schichttausch');
    await page.getByRole('button', { name: 'Jana Wilke wählen' }).click();
    await expect(page.getByText('Wartet auf Freigabe', { exact: true })).toBeVisible();
    await signOut(page);
    await demoLogin(page, 'chef');
    await expect(page.getByText('Frühschicht').first()).toBeVisible();
    await openSwapAsChef(page);
    await page.getByRole('button', { name: 'Ablehnen' }).click();
    await expect(page.getByText('ZUR FREIGABE · 1')).toHaveCount(0);
    await signOut(page);
    await demoLogin(page, 'mira');
    await openTab(page, 'Schichttausch');
    await expect(page.getByText('Abgelehnt')).toBeVisible();
  });

  test('F07-E1 angebotene Schicht taucht nicht noch einmal unter "Anbieten" auf', async ({ page }) => {
    await loginAs(page, 'mira');
    await openTab(page, 'Schichttausch');
    await expect(page.getByRole('button', { name: 'Anbieten' }).first()).toBeVisible();
    const before = await page.getByRole('button', { name: 'Anbieten' }).count();
    expect(before).toBeGreaterThan(0);
    await page.getByRole('button', { name: 'Anbieten' }).first().click();
    await expect(page.getByText('MEINE ANGEBOTE · 1')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Anbieten' })).toHaveCount(before - 1);
  });

  test('A11Y-S24 Tausch', async ({ page }) => {
    await loginAs(page, 'mira');
    await openTab(page, 'Schichttausch');
    await expect(page.getByText('Angeboten von Lena Kraus')).toBeVisible();
    expect(await axe(page)).toEqual([]);
  });
});
