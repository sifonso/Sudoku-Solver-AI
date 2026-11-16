import AxeBuilder from '@axe-core/playwright';
import { test as base, expect, type Page } from '@playwright/test';
export type { Page };

// Jeder Test schlägt fehl bei Konsolenfehlern, Seitenfehlern oder 5xx-Antworten.
export const test = base.extend<{ guard: void }>({
  guard: [
    async ({ page }, use) => {
      const problems: string[] = [];
      page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
      page.on('console', (m) => {
        if (m.type() === 'error') problems.push(`console: ${m.text().slice(0, 300)}`);
      });
      page.on('response', (r) => {
        if (r.status() >= 500) problems.push(`${r.status()} ${r.url()}`);
      });
      await use();
      expect(problems, 'Konsolen- oder Serverfehler').toEqual([]);
    },
    { auto: true },
  ],
});
export { expect };

export const DEMO = {
  chef: 'Chef (Jana Wilke)',
  mira: 'Mitarbeiterin (Mira Okafor)',
};

/** Anmeldung über die Demo-Knöpfe. Demodaten leben im Speicher: kein page.goto() danach, sonst ist alles zurückgesetzt. */
export async function loginAs(page: Page, who: keyof typeof DEMO) {
  await page.goto('/login');
  await page.getByRole('button', { name: DEMO[who] }).click();
  await expect(page).toHaveURL(who === 'chef' ? /\/plan$/ : /\/meine$/);
  // Erst weiter, wenn die Daten da sind (Demo-Latenz ~180 ms pro Abfrage)
  await expect(page.getByText(who === 'chef' ? 'Frühschicht' : /Schichten ·/).first()).toBeVisible();
}

/** Mitarbeiter-Kärtchen im Plan. Der Name ergibt sich aus dem sichtbaren Inhalt (Kürzel, Name, Art). */
export function chip(page: Page, name: string) {
  return page.getByRole('button', { name: new RegExp(`${name}.*(Vollzeit|Teilzeit|Aushilfe|Ruhezeit)`) });
}

/** Navigation innerhalb der App ohne Neuladen (Demodaten bleiben erhalten). */
export async function openTab(page: Page, label: string) {
  await page.getByRole('tab', { name: new RegExp(label) }).click();
}

export async function signOut(page: Page) {
  await openTab(page, 'Mehr');
  await page.getByRole('button', { name: 'Abmelden' }).click();
  await expect(page).toHaveURL(/\/login$/);
}

/** Zeile in der Zuweisungsliste (S05). Der Plan liegt im DOM darunter, daher über den Zeilentext eingrenzen. */
export function candidateRow(page: Page, name: string) {
  return page.getByRole('button').filter({ hasText: name }).filter({ hasText: /passt|Hinweis|belegt/ });
}

/** axe-Prüfung, Ergebnis kompakt für Fehlermeldungen. */
export async function axe(page: Page) {
  const r = await new AxeBuilder({ page: page as unknown as ConstructorParameters<typeof AxeBuilder>[0]['page'] }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  return r.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.length}× ${v.help}`);
}

/** Zeile in der Personal-Liste (S07): Name gefolgt von „Rolle · Beschäftigung“. */
export function memberRow(page: Page, name: string) {
  return page.getByRole('button', { name: new RegExp(`${name}.*(Mitarbeiter|Planer|Aufgaben|Chef) ·`) });
}
