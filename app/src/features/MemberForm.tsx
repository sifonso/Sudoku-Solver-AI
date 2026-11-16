import { StyleSheet, View } from 'react-native';
import type { Employment, Role } from '../domain/types';
import { ChoiceChips, TextField } from '../ui';

export type MemberDraft = {
  displayName: string;
  initials: string;
  role: Role;
  employmentType: Employment;
  monthlyHoursLimit: string; // Eingabefeld, leer = keine Grenze
};

export const initialsOf = (name: string) =>
  name.trim().split(/\s+/).filter(Boolean).map((w) => w[0]!.toUpperCase()).join('').slice(0, 3);

export function validateDraft(d: MemberDraft) {
  const limit = d.monthlyHoursLimit.trim().replace(',', '.');
  return {
    displayName: d.displayName.trim().length < 2 ? 'Bitte den Namen eingeben.' : d.displayName.length > 80 ? 'Höchstens 80 Zeichen.' : undefined,
    initials: !/^[A-Za-zÄÖÜäöü0-9]{1,4}$/.test(d.initials.trim()) ? '1 bis 4 Buchstaben oder Ziffern.' : undefined,
    monthlyHoursLimit: limit && !(Number(limit) > 0 && Number(limit) <= 744) ? 'Eine Zahl zwischen 1 und 744.' : undefined,
  };
}

export const parseLimit = (s: string) => {
  const v = s.trim().replace(',', '.');
  return v ? Number(v) : null;
};

const ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: 'mitarbeiter', label: 'Mitarbeiter' },
  { value: 'planer', label: 'Planer' },
  { value: 'aufgaben_manager', label: 'Aufgaben' },
  { value: 'chef', label: 'Chef' },
];
const TYPE_OPTIONS: { value: Employment; label: string }[] = [
  { value: 'vollzeit', label: 'Vollzeit' },
  { value: 'teilzeit', label: 'Teilzeit' },
  { value: 'aushilfe', label: 'Aushilfe' },
];

/** Gemeinsame Felder für Einladen (S08 neu) und Bearbeiten (S08). */
export function MemberFields({ draft, onChange, errors, onNameChange, showLimit = true }: {
  showLimit?: boolean;
  draft: MemberDraft;
  onChange: (d: MemberDraft) => void;
  errors: ReturnType<typeof validateDraft> | null;
  onNameChange?: (name: string) => void;
}) {
  return (
    <View style={styles.fields}>
      <TextField label="Name" value={draft.displayName} error={errors?.displayName} autoComplete="name"
        onChangeText={(v) => (onNameChange ? onNameChange(v) : onChange({ ...draft, displayName: v }))} />
      <TextField label="Kürzel" value={draft.initials} error={errors?.initials} autoCapitalize="characters" maxLength={4}
        hint="Steht im Plan auf dem Kärtchen." onChangeText={(v) => onChange({ ...draft, initials: v.toUpperCase() })} />
      <ChoiceChips label="Rolle" options={ROLE_OPTIONS} value={draft.role} onChange={(role) => onChange({ ...draft, role })} />
      <ChoiceChips label="Beschäftigung" options={TYPE_OPTIONS} value={draft.employmentType}
        onChange={(employmentType) => onChange({ ...draft, employmentType })} />
      {showLimit ? <TextField label="Stundengrenze pro Monat" value={draft.monthlyHoursLimit} error={errors?.monthlyHoursLimit}
        keyboardType="decimal-pad" placeholder="keine"
        hint="Zum Beispiel für Minijobs. Beim Einplanen erscheint ein Hinweis, wenn die Grenze überschritten wird."
        onChangeText={(v) => onChange({ ...draft, monthlyHoursLimit: v })} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({ fields: { gap: 16 } });
