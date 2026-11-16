import { ClipboardCheck, Coffee, Droplets, Package, ShieldCheck, Sparkles, Thermometer, Truck, type LucideIcon } from 'lucide-react-native';
import type { QuickIcon, QuickPair } from '../domain/types';
import type { PatternKind } from '../ui';

export const QUICK_ICONS: Record<QuickIcon, { icon: LucideIcon; label: string }> = {
  thermometer: { icon: Thermometer, label: 'Temperatur' },
  package: { icon: Package, label: 'Bestand' },
  sparkles: { icon: Sparkles, label: 'Reinigung' },
  clipboard: { icon: ClipboardCheck, label: 'Checkliste' },
  coffee: { icon: Coffee, label: 'Kaffee' },
  droplets: { icon: Droplets, label: 'Wasser' },
  truck: { icon: Truck, label: 'Lieferung' },
  shield: { icon: ShieldCheck, label: 'Sicherheit' },
};

export const PAIR_LABEL: Record<QuickPair, string> = {
  lavender: 'Lavendel',
  orange: 'Orange',
  burgundy: 'Burgund',
  moos: 'Moos',
};

/** Jedes Farbpaar hat sein Muster, damit Kacheln auch ohne Farbwahrnehmung unterscheidbar bleiben. */
export const PAIR_PATTERN: Record<QuickPair, PatternKind> = {
  lavender: 'pfeile',
  orange: 'zacken',
  burgundy: 'zacken',
  moos: 'streifen',
};
