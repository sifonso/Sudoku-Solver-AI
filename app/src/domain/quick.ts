// Schnellaktionen: Eingaben prüfen (gleiche Regeln wie Trigger quick_entry_check) und Fälligkeit.
import { localDate, localTime } from './time.ts';
import type { QuickAction, QuickEntry, QuickField } from './types.ts';

export const parseNumber = (v: string) => {
  const t = v.trim().replace(',', '.');
  return t === '' || !/^-?\d+(\.\d+)?$/.test(t) ? null : Number(t);
};

export function checkEntry(fields: QuickField[], values: Record<string, string>) {
  const errors: Record<string, string> = {};
  const outOfRange: string[] = [];
  for (const f of fields) {
    const v = (values[f.key] ?? '').trim();
    if (f.required && !v) {
      errors[f.key] = 'Pflichtfeld';
      continue;
    }
    if (f.type === 'number' && v) {
      const n = parseNumber(v);
      if (n == null) errors[f.key] = 'Bitte eine Zahl eingeben.';
      else if ((f.min != null && n < f.min) || (f.max != null && n > f.max)) outOfRange.push(f.key);
    }
  }
  return { errors, outOfRange, ok: Object.keys(errors).length === 0 };
}

/**
 * Fällig: Es gibt heute eine Erinnerungszeit, die schon vorbei ist, und seit dieser Zeit noch keinen Eintrag.
 * Liefert die zuletzt verpasste Zeit oder null.
 */
export function dueSince(action: Pick<QuickAction, 'id' | 'reminderTimes'>, entries: Pick<QuickEntry, 'quickActionId' | 'recordedAt'>[], tz: string, now: Date = new Date()): string | null {
  const today = localDate(now.toISOString(), tz);
  const nowTime = localTime(now.toISOString(), tz);
  const passed = [...action.reminderTimes].sort().filter((t) => t <= nowTime);
  const last = passed[passed.length - 1];
  if (!last) return null;
  const doneAfter = entries.some((e) => e.quickActionId === action.id
    && localDate(e.recordedAt, tz) === today && localTime(e.recordedAt, tz) >= last);
  return doneAfter ? null : last;
}
