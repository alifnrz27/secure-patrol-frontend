export type CsvValue = string | number | boolean | null | undefined;

function escapeCell(value: CsvValue): string {
  if (value === null || value === undefined) return '';
  let text = String(value);
  // Prevent spreadsheet formula injection from user-entered text.
  if (/^[=+\-@\t\r]/.test(text) && typeof value === 'string') text = `'${text}`;
  if (/[",\n\r;]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function toCsv(headers: string[], rows: CsvValue[][]): string {
  const lines = [headers, ...rows].map((row) => row.map(escapeCell).join(','));
  return lines.join('\r\n');
}

/** Downloads CSV as UTF-8 with BOM so Excel detects the encoding. */
export function downloadCsv(filename: string, csv: string): void {
  downloadBlob(filename, new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' }));
}

export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
