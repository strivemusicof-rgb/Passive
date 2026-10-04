import { cellAt, cellBounds, cellCenter, distanceM, neighbours } from '@landrush/shared/grid';

const RIGA = cellAt(56.9496, 24.1052);

describe('plot grid', () => {
  it('lines columns up between rows (no brick pattern)', () => {
    for (const dRow of [1, 5, 50]) {
      const below = cellBounds(RIGA);
      const above = cellBounds({ row: RIGA.row + dRow, col: RIGA.col });
      expect(above.west).toBeCloseTo(below.west, 12);
    }
  });

  it('keeps plots roughly square (~33 m)', () => {
    const b = cellBounds(RIGA);
    const width = distanceM({ lat: b.south, lng: b.west }, { lat: b.south, lng: b.east });
    const height = distanceM({ lat: b.south, lng: b.west }, { lat: b.north, lng: b.west });
    expect(height).toBeGreaterThan(32);
    expect(height).toBeLessThan(35);
    expect(width / height).toBeGreaterThan(0.95);
    expect(width / height).toBeLessThan(1.05);
  });

  it('finds the cell back from its centre and has 8 distinct neighbours', () => {
    const c = cellCenter(RIGA);
    expect(cellAt(c.lat, c.lng)).toEqual(RIGA);
    const keys = new Set(neighbours(RIGA).map((n) => `${n.row}_${n.col}`));
    expect(keys.size).toBe(8);
    expect(neighbours(RIGA)).toContainEqual({ row: RIGA.row + 1, col: RIGA.col });
  });
});
