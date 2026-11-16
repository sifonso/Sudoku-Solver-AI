import { useEffect, useState } from 'react';
import { formatDate, parseGermanDate } from '../domain/time';
import { TextField } from '../ui';

/**
 * Datumseingabe TT.MM.JJJJ. Gibt ISO-Datum oder null (leer/ungültig) nach außen.
 * Bewusst ein Textfeld: funktioniert gleich auf iOS, Android und Web, auch mit Tastatur und Screenreader.
 */
export function DateField({ label, value, onChange, error, hint }: {
  label: string; value: string | null; onChange: (iso: string | null) => void; error?: string; hint?: string;
}) {
  const [text, setText] = useState(value ? formatDate(value) : '');
  useEffect(() => {
    // Von außen gesetzte Werte übernehmen, ohne laufende Eingabe zu überschreiben
    if (value && parseGermanDate(text) !== value) setText(formatDate(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <TextField
      label={label}
      value={text}
      placeholder="TT.MM.JJJJ"
      keyboardType="numbers-and-punctuation"
      error={error}
      hint={hint ?? 'Format TT.MM.JJJJ'}
      onChangeText={(t) => {
        setText(t);
        onChange(parseGermanDate(t));
      }}
    />
  );
}
