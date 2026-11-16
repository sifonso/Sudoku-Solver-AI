// F05 Urlaub beantragen/genehmigen (S22, S10), F06 Krankmeldung und Ersatz (S23, S09).
import { DEMO, candidateRow, expect, loginAs, openTab, signOut, test } from './fixtures';

const year = new Date().getFullYear() + 1; // sicher in der Zukunft, keine Seed-Sperre
const de = (d: number, m: number, y = year) => `${String(d).padStart(2, '0')}.${String(m).padStart(2, '0')}.${y}`;

test.describe('F06 Krankmeldung', () => {
  test('F06-H1 Mira meldet sich krank, Chef sieht neutrale Mitteilung, Abwesenheit und Ersatzsuche', async ({ page }) => {
    await loginAs(page, 'mira');
    await page.getByRole('button', { name: 'Krank melden' }).click();
    await page.getByRole('radio', { name: 'Bis Sonntag' }).click();
    await page.getByRole('button', { name: 'Krankmeldung senden' }).click();
    await expect(page.getByText('Krankmeldung ist raus.')).toBeVisible();
    await page.getByRole('button', { name: 'Zu meinen Schichten' }).click();
    await signOut(page);

    await page.getByRole('button', { name: DEMO.chef }).click();
    await expect(page.getByText('Frühschicht').first()).toBeVisible();
    await expect(page.getByText(/Abwesend: Mira Okafor \(krank\)/).first()).toBeVisible();
    await page.getByRole('button', { name: /^Benachrichtigungen, 1 ungelesen/ }).click();
    // Mitteilung ohne Namen und ohne Grund (Push geht über Dritte)
    await expect(page.getByLabel(/^Neu: Neue Abwesenheit/)).toContainText('Bitte den Plan prüfen.');
    await expect(page.getByLabel(/^Neu: Neue Abwesenheit/)).not.toContainText(/Mira|krank/i);
    await page.getByRole('button', { name: 'Zurück', exact: true }).click();

    await openTab(page, 'Personal');
    await page.getByRole('button', { name: 'Krankmeldungen' }).click();
    await expect(page.getByText(/^Krank /).first()).toBeVisible();
    const replace = page.getByRole('button', { name: 'Ersatz finden' });
    if (await replace.count()) {
      await replace.first().click();
      await expect(page).toHaveURL(/\/zuweisen\?/);
      await expect(page.getByText(/Abwesend \(Urlaub oder krank\)/).first().or(page.getByText('Schon in dieser Schicht').first())).toBeVisible();
    }
  });

  test('F06-N1 doppelte Krankmeldung für denselben Tag wird abgelehnt', async ({ page }) => {
    await loginAs(page, 'mira');
    await page.getByRole('button', { name: 'Krank melden' }).click();
    await page.getByRole('button', { name: 'Krankmeldung senden' }).click();
    await expect(page.getByText('Krankmeldung ist raus.')).toBeVisible();
    await page.getByRole('button', { name: 'Zu meinen Schichten' }).click();
    await page.getByRole('button', { name: 'Krank melden' }).click();
    await page.getByRole('button', { name: 'Krankmeldung senden' }).click();
    await expect(page.getByText('Für diesen Zeitraum gibt es schon eine Abwesenheit.')).toBeVisible();
  });
});

test.describe('F05 Urlaub', () => {
  test('F05-H1 Antrag stellen, Chef genehmigt, Mira wird benachrichtigt', async ({ page }) => {
    await loginAs(page, 'mira');
    await page.getByRole('button', { name: 'Urlaub beantragen' }).click();
    await page.getByRole('textbox', { name: 'Von', exact: true }).fill(de(2, 3));
    await page.getByRole('textbox', { name: 'Bis', exact: true }).fill(de(6, 3));
    await expect(page.getByText(/^\d Arbeitstage/)).toBeVisible();
    await page.getByLabel('Kommentar (optional)').fill('Familienbesuch');
    await page.getByRole('button', { name: 'Urlaub beantragen' }).click();
    await expect(page.getByText('Antrag ist gestellt.')).toBeVisible();
    await expect(page.getByText('MEINE ANTRÄGE · 1')).toBeVisible();
    // BUG-005: Tage des Antrags im Folgejahr; Formular danach leer
    await expect(page.getByText(/^[1-9] Tage · Familienbesuch/)).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Von', exact: true })).toHaveValue('');
    await page.getByRole('button', { name: 'Zurück', exact: true }).click();
    await signOut(page);

    await page.getByRole('button', { name: DEMO.chef }).click();
    await openTab(page, 'Personal');
    await page.getByRole('button', { name: 'Urlaub' }).click();
    await expect(page.getByRole('tab', { name: 'Offen (2)' })).toBeVisible();
    await expect(page.getByText('„Familienbesuch“')).toBeVisible();
    await expect(page.getByText('„Hochzeit meiner Schwester“')).toBeVisible();
    const item = page.getByText('„Familienbesuch“').locator('xpath=..');
    await item.getByRole('button', { name: 'Genehmigen' }).click();
    await expect(page.getByRole('tab', { name: 'Offen (1)' })).toBeVisible();
    await page.getByRole('button', { name: 'Zurück', exact: true }).click();
    await signOut(page);

    await page.getByRole('button', { name: DEMO.mira }).click();
    await page.getByRole('button', { name: /^Benachrichtigungen, 1 ungelesen/ }).click();
    await expect(page.getByLabel(/^Neu: Urlaub genehmigt/)).toBeVisible();
  });

  test('F05-E1 ungültige Daten werden abgefangen', async ({ page }) => {
    await loginAs(page, 'mira');
    await page.getByRole('button', { name: 'Urlaub beantragen' }).click();
    await page.getByRole('textbox', { name: 'Von', exact: true }).fill(de(31, 2));
    await page.getByRole('textbox', { name: 'Bis', exact: true }).fill(de(1, 3));
    await page.getByRole('button', { name: 'Urlaub beantragen' }).click();
    await expect(page.getByText('Bitte ein gültiges Datum eingeben.')).toBeVisible();
    await page.getByRole('textbox', { name: 'Von', exact: true }).fill(de(10, 3));
    await page.getByRole('textbox', { name: 'Bis', exact: true }).fill(de(5, 3));
    await page.getByRole('button', { name: 'Urlaub beantragen' }).click();
    await expect(page.getByText('Das Ende liegt vor dem Beginn.')).toBeVisible();
  });

  test('F05-N1 Urlaubssperre: Hinweis und Knopf gesperrt', async ({ page }) => {
    await loginAs(page, 'chef');
    await openTab(page, 'Personal');
    await page.getByRole('button', { name: 'Urlaub' }).click();
    await page.getByRole('tab', { name: /Sperren/ }).click();
    await page.getByRole('textbox', { name: 'Von', exact: true }).fill(de(1, 7));
    await page.getByRole('textbox', { name: 'Bis', exact: true }).fill(de(15, 7));
    await page.getByLabel('Grund (optional)').fill('Sommerfest');
    await page.getByRole('button', { name: 'Sperre anlegen' }).click();
    await expect(page.getByText('Sommerfest')).toBeVisible();
    await page.getByRole('button', { name: 'Zurück', exact: true }).click();
    await signOut(page);

    await page.getByRole('button', { name: DEMO.mira }).click();
    await page.getByRole('button', { name: 'Urlaub beantragen' }).click();
    await page.getByRole('textbox', { name: 'Von', exact: true }).fill(de(10, 7));
    await page.getByRole('textbox', { name: 'Bis', exact: true }).fill(de(20, 7));
    await expect(page.getByText(/^Urlaubssperre /)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Urlaub beantragen' })).toBeDisabled();
  });

  test('F05-E2 Antrag zurückziehen', async ({ page }) => {
    await loginAs(page, 'mira');
    await page.getByRole('button', { name: 'Urlaub beantragen' }).click();
    await page.getByRole('textbox', { name: 'Von', exact: true }).fill(de(4, 5));
    await page.getByRole('textbox', { name: 'Bis', exact: true }).fill(de(8, 5));
    await page.getByRole('button', { name: 'Urlaub beantragen' }).click();
    await expect(page.getByText('Antrag ist gestellt.')).toBeVisible();
    await page.getByRole('button', { name: 'Zurückziehen' }).click();
    await expect(page.getByText('Zurückgezogen')).toBeVisible();
    // Gleicher Zeitraum geht danach wieder
    await page.getByRole('textbox', { name: 'Von', exact: true }).fill(de(4, 5));
    await page.getByRole('textbox', { name: 'Bis', exact: true }).fill(de(8, 5));
    await page.getByRole('button', { name: 'Urlaub beantragen' }).click();
    await expect(page.getByText('Antrag ist gestellt.')).toBeVisible();
  });

  test('F05-N2 überlappender Antrag wird abgelehnt', async ({ page }) => {
    await loginAs(page, 'mira');
    await page.getByRole('button', { name: 'Urlaub beantragen' }).click();
    await page.getByRole('textbox', { name: 'Von', exact: true }).fill(de(1, 6));
    await page.getByRole('textbox', { name: 'Bis', exact: true }).fill(de(5, 6));
    await page.getByRole('button', { name: 'Urlaub beantragen' }).click();
    await expect(page.getByText('Antrag ist gestellt.')).toBeVisible();
    await page.getByRole('textbox', { name: 'Von', exact: true }).fill(de(4, 6));
    await page.getByRole('textbox', { name: 'Bis', exact: true }).fill(de(9, 6));
    await page.getByRole('button', { name: 'Urlaub beantragen' }).click();
    await expect(page.getByText('Für diesen Zeitraum gibt es schon eine Abwesenheit.')).toBeVisible();
  });
});

test.describe('Barrierefreiheit Abwesenheiten', () => {
  test('A11Y-S22/S23/S10/S09', async ({ page }) => {
    const { axe } = await import('./fixtures');
    await loginAs(page, 'mira');
    await page.getByRole('button', { name: 'Krank melden' }).click();
    expect(await axe(page)).toEqual([]);
    await page.getByRole('button', { name: 'Zurück', exact: true }).click();
    await page.getByRole('button', { name: 'Urlaub beantragen' }).click();
    await expect(page.getByRole('textbox', { name: 'Von', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Urlaub beantragen' }).filter({ visible: true }).click();
    await expect(page.getByText('Bitte ein gültiges Datum eingeben.').first()).toBeVisible();
    expect(await axe(page)).toEqual([]);
    await page.getByRole('button', { name: 'Zurück', exact: true }).click();
    await signOut(page);
    await page.getByRole('button', { name: DEMO.chef }).click();
    await openTab(page, 'Personal');
    await page.getByRole('button', { name: 'Urlaub' }).click();
    await expect(page.getByText('„Hochzeit meiner Schwester“')).toBeVisible();
    expect(await axe(page)).toEqual([]);
    await page.getByRole('button', { name: 'Zurück', exact: true }).click();
    await page.getByRole('button', { name: 'Krankmeldungen' }).click();
    expect(await axe(page)).toEqual([]);
  });
});
void candidateRow;
