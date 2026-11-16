import { ApiError } from '../data/api';

/** Ein Satz für den Nutzer pro Fehlercode. Unbekanntes wird nicht verschwiegen, aber auch nicht technisch. */
export function errorText(e: unknown): string {
  const code = e instanceof ApiError ? e.code : null;
  switch (code) {
    case 'forbidden': return 'Dafür fehlen dir die Rechte.';
    case 'last_chef': return 'Es muss mindestens ein aktiver Chef bleiben. Ernenne zuerst jemand anderen zum Chef.';
    case 'initials_taken': return 'Dieses Kürzel hat schon jemand im Team.';
    case 'member_limit_reached': return 'In der Testphase sind höchstens 10 Personen möglich.';
    case 'absence_overlap': return 'Für diesen Zeitraum gibt es schon eine Abwesenheit.';
    case 'vacation_blocked': return 'In diesem Zeitraum ist eine Urlaubssperre. Bitte einen anderen Zeitraum wählen oder mit dem Chef sprechen.';
    case 'already_decided': return 'Darüber wurde schon entschieden.';
    case 'swap_not_open': return 'Dieses Angebot ist nicht mehr offen.';
    case 'not_an_applicant': return 'Diese Person hat sich nicht beworben.';
    case 'invalid_entry': return 'Bitte alle Pflichtfelder ausfüllen und Zahlen als Zahl eingeben.';
    case 'no_double_booking': return 'Diese Person ist zu der Zeit schon eingeteilt.';
    case 'not_found': return 'Das gibt es nicht mehr. Bitte die Ansicht neu laden.';
    case 'rate_limited': return 'Zu viele Versuche. Bitte in ein paar Minuten noch einmal.';
    case 'not_authenticated': return 'Bitte neu anmelden.';
    default: return 'Das hat nicht geklappt. Bitte prüfe die Verbindung und versuche es noch einmal.';
  }
}
