import { defineConfig } from '@playwright/test';

// E2E gegen den Web-Build im Demo-Modus (Datenschicht im Speicher, gleiche Regeln wie Supabase).
// Leere EXPO_PUBLIC_SUPABASE_*-Werte erzwingen den Demo-Modus, auch wenn .env.local existiert.
// Live-Tests gegen Supabase liegen in e2e/live und laufen nur mit gesetzten SB_*-Variablen.
const PORT = 8098;

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['json', { outputFile: 'e2e-results.json' }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'off',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command:
      'rm -rf dist-e2e && EXPO_PUBLIC_SUPABASE_URL= EXPO_PUBLIC_SUPABASE_ANON_KEY= EXPO_OFFLINE=1 EXPO_NO_TELEMETRY=1 CI=1 ' +
      `npx expo export -p web --output-dir dist-e2e && npx --yes serve@14.2.4 dist-e2e -l ${PORT} -s -n`,
    url: `http://localhost:${PORT}/login`,
    timeout: 300_000,
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    { name: 'phone', testIgnore: /live\//, use: { viewport: { width: 390, height: 844 } } },
    { name: 'desktop', testIgnore: /live\//, use: { viewport: { width: 1440, height: 900 } } },
    { name: 'live', testMatch: /live\/.*\.spec\.ts/ },
  ],
});
