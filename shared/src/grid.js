// Square land grid. Each plot is ~33 m × ~33 m. Rows are fixed latitude bands.
// Cells get wider in degrees of longitude towards the poles so they stay
// roughly square in metres. The width is the same for a whole zone of rows
// (~100 km tall), so columns line up into a neat grid inside a zone.
//
// Plain JavaScript (types in grid.d.ts) so the server can run it directly with
// Node and the app can bundle it with Metro, with no build step.

/** Height of one row in degrees of latitude (~33 m). */
export const CELL_LAT = 0.0003;

const EARTH_RADIUS_M = 6371000;

/** Rows per zone (0.9° of latitude). Riga, Jūrmala and Vilnius sit inside one zone each. */
export const ZONE_ROWS = 3000;

function lngStep(row) {
  const zone = Math.floor(row / ZONE_ROWS);
  const centerLat = (zone + 0.5) * ZONE_ROWS * CELL_LAT;
  // Clamp near the poles so cells never become absurdly wide.
  const cos = Math.max(Math.cos((centerLat * Math.PI) / 180), 0.05);
  return CELL_LAT / cos;
}

export function cellAt(lat, lng) {
  const row = Math.floor(lat / CELL_LAT);
  return { row, col: Math.floor(lng / lngStep(row)) };
}

export function cellBounds({ row, col }) {
  const step = lngStep(row);
  return { south: row * CELL_LAT, north: (row + 1) * CELL_LAT, west: col * step, east: (col + 1) * step };
}

export function cellCenter(cell) {
  const b = cellBounds(cell);
  return { lat: (b.south + b.north) / 2, lng: (b.west + b.east) / 2 };
}

export function cellKey({ row, col }) {
  return `${row}_${col}`;
}

export function parseCellKey(key) {
  const m = /^(-?\d+)_(-?\d+)$/.exec(key);
  return m ? { row: Number(m[1]), col: Number(m[2]) } : null;
}

/** The 8 surrounding cells (same-row neighbours plus the rows above and below). */
export function neighbours(cell) {
  const out = [];
  const { lat, lng } = cellCenter(cell);
  for (const dRow of [-1, 0, 1]) {
    for (const dLng of [-1, 0, 1]) {
      if (dRow === 0 && dLng === 0) continue;
      const lat2 = lat + dRow * CELL_LAT;
      const row = cell.row + dRow;
      out.push(cellAt(lat2, lng + dLng * lngStep(row)));
    }
  }
  return out;
}

/** All cells overlapping a bounding box, up to `max`. */
export function cellsInBox(b, max = 2000) {
  const cells = [];
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

/** Great-circle distance in metres. */
export function distanceM(a, b) {
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}
