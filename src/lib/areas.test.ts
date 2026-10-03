import { describe, expect, it } from 'vitest';
import { groupByArea } from './areas';

describe('groupByArea', () => {
  it('returns null when nothing has an area', () => {
    expect(groupByArea([{ area_id: null, area_name: '' }])).toBeNull();
  });

  it('groups in server order and puts points without an area last', () => {
    const rows = [
      { id: 1, area_id: null, area_name: '' },
      { id: 2, area_id: 5, area_name: 'Gedung A' },
      { id: 3, area_id: 5, area_name: 'Gedung A' },
      { id: 4, area_id: 7, area_name: 'Parkir' },
    ];
    expect(groupByArea(rows)!.map((g) => [g.name, g.items.map((i) => i.id)])).toEqual([
      ['Gedung A', [2, 3]],
      ['Parkir', [4]],
      ['Tanpa area', [1]],
    ]);
  });
});
