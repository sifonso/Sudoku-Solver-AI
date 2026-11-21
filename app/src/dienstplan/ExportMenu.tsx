// Export-Knopf mit Auswahl Excel/PDF. Erzeugt die Datei erst beim Antippen.
import { Download, FileSpreadsheet, FileText } from 'lucide-react-native';
import { useState } from 'react';
import { ActionSheet, Banner, IconButton } from '../ui';
import { PDF_MIME, XLSX_MIME, saveFile, toPdf, toXlsx, type Sheet } from './export';

export function ExportMenu({ label, fileBase, sheets }: { label: string; fileBase: string; sheets: () => Sheet[] | null }) {
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
  const run = async (kind: 'xlsx' | 'pdf') => {
    const sh = sheets();
    if (!sh) return;
    try {
      const r = kind === 'xlsx'
        ? await saveFile(`${fileBase}.xlsx`, toXlsx(sh), XLSX_MIME)
        : await saveFile(`${fileBase}.pdf`, toPdf(sh, fileBase), PDF_MIME);
      void r;
      setMsg(null);
    } catch {
      setMsg({ tone: 'danger', text: 'Export fehlgeschlagen. Bitte noch einmal versuchen.' });
    }
  };
  return (
    <>
      <IconButton icon={Download} label={label} tone="soft" onPress={() => { setMsg(null); setOpen(true); }} />
      <ActionSheet visible={open} title={label} onClose={() => setOpen(false)} items={[
        { label: 'Als Excel (.xlsx)', icon: FileSpreadsheet, onPress: () => run('xlsx') },
        { label: 'Als PDF', icon: FileText, onPress: () => run('pdf') },
      ]} />
      {msg ? <Banner tone={msg.tone} title={msg.text} /> : null}
    </>
  );
}
