import { ApiError } from '../data/api';

/** Ein Satz für den Nutzer pro Fehlercode. Unbekanntes wird nicht verschwiegen, aber auch nicht technisch. */
export function errorText(e: unknown): string {
  const code = e instanceof ApiError ? e.code : null;
  switch (code) {
    case 'forbidden': return 'Dafür fehlen dir die Rechte.';
    case 'last_chef': return 'Es muss mindestens ein aktiver Chef bleiben. Ernenne zuerst jemand anderen zum Chef.';
    case 'initials_taken': return 'Dieses Kürzel hat schon jemand im Team.';
    case 'member_limit_reached': return 'In der Testphase sind höchstens 10 Personen möglich.';
    case 'no_double_booking': return 'Diese Person ist zu der Zeit schon eingeteilt.';
    case 'not_found': return 'Das gibt es nicht mehr. Bitte die Ansicht neu laden.';
    case 'rate_limited': return 'Zu viele Versuche. Bitte in ein paar Minuten noch einmal.';
    case 'not_authenticated': return 'Bitte neu anmelden.';
    default: return 'Das hat nicht geklappt. Bitte prüfe die Verbindung und versuche es noch einmal.';
  }
}
