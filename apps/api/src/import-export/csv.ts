export type CsvRow = Record<string, string>;

export function parseCsv(input: string): CsvRow[] {
  const text = String(input || '')
    .replace(/^\uFEFF/, '')
    .trim();
  if (!text) return [];

  const rows: string[][] = [];
  let current = '';
  let row: string[] = [];
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      quoted = !quoted;
      continue;
    }

    if (char === ',' && !quoted) {
      row.push(current.trim());
      current = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && next === '\n') index += 1;
      row.push(current.trim());
      rows.push(row);
      row = [];
      current = '';
      continue;
    }

    current += char;
  }

  row.push(current.trim());
  rows.push(row);

  const [headers = [], ...dataRows] = rows.filter((item) => item.some(Boolean));
  const normalizedHeaders = headers.map((header) => header.trim());

  return dataRows.map((dataRow) =>
    Object.fromEntries(
      normalizedHeaders.map((header, index) => [header, dataRow[index] || '']),
    ),
  );
}

export function toCsv(rows: Array<Record<string, unknown>>, headers: string[]) {
  const escape = (value: unknown) => {
    const text = value === null || value === undefined ? '' : String(value);
    if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
    return text;
  };

  return [
    headers.join(','),
    ...rows.map((row) =>
      headers.map((header) => escape(row[header])).join(','),
    ),
  ].join('\n');
}
