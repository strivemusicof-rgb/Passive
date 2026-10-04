/**
 * Square land grid. Each plot is ~33 m × ~33 m. Rows are fixed latitude bands;
 * the longitude width of a cell depends on its row so plots stay roughly
 * square at any latitude. Pure math, used by both server and app.
 */

/** Height of one row in degrees of latitude (~33 m). */
export const CELL_LAT = 0.0003;

export type Cell = { row: number; col: number };
export type CellBounds = { south: number; north: number; west: number; east: number };

function lngStep(row: number): number {
  const centerLat = (row + 0.5) * CELL_LAT;
  // Clamp near the poles so cells never become absurdly wide.
  const cos = Math.max(Math.cos((centerLat * Math.PI) / 180), 0.05);
  return CELL_LAT / cos;
}

export function cellAt(lat: number, lng: number): Cell {
  const row = Math.floor(lat / CELL_LAT);
  return { row, col: Math.floor(lng / lngStep(row)) };
}

export function cellBounds({ row, col }: Cell): CellBounds {
  const step = lngStep(row);
  return {
    south: row * CELL_LAT,
    north: (row + 1) * CELL_LAT,
    west: col * step,
    east: (col + 1) * step,
  };
}

export function cellKey({ row, col }: Cell): string {
  return `${row}:${col}`;
}

/** All cells overlapping a bounding box (capped to protect the client). */
export function cellsInBox(b: CellBounds, max = 2000): Cell[] {
  const cells: Cell[] = [];
  const r0 = Math.floor(b.south / CELL_LAT);
  const r1 = Math.floor(b.north / CELL_LAT);
  for (let row = r0; row <= r1; row++) {
    const step = lngStep(row);
    for (let col = Math.floor(b.west / step); col <= Math.floor(b.east / step); col++) {
      cells.push({ row, col });
      if (cells.length >= max) return cells;
    }
  }
  return cells;
}
