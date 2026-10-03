/** Label for points without an area. */
export const NO_AREA = 'Tanpa area';

export interface AreaGroup<T> {
  key: string;
  name: string;
  items: T[];
}

/**
 * Groups rows by area, keeping the server order (already sorted by area, then
 * name). Returns null when no row has an area, so callers can show a flat list.
 */
export function groupByArea<T extends { area_id: number | null; area_name: string }>(rows: T[]): AreaGroup<T>[] | null {
  if (!rows.some((r) => r.area_id !== null || r.area_name)) return null;
  const groups = new Map<string, AreaGroup<T>>();
  for (const row of rows) {
    const key = row.area_id !== null ? String(row.area_id) : row.area_name || 'none';
    const group = groups.get(key) ?? { key, name: row.area_name || NO_AREA, items: [] };
    group.items.push(row);
    groups.set(key, group);
  }
  // Points without an area go last.
  return [...groups.values()].sort((a, b) => Number(a.key === 'none') - Number(b.key === 'none'));
}
