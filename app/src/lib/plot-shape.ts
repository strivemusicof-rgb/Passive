import type { Rarity } from '@landrush/shared';
import { cellBounds, type Cell } from '@landrush/shared/grid';

import { RARITY_COLORS } from '@/constants/theme';

/** Map icon per building level (0 = empty land). */
export const BUILDING_ICONS = ['pine-tree', 'home-variant', 'office-building', 'domain', 'city-variant'] as const;

/** Tile colour on the map: the owner's skin, else the rarity colour. */
export const tileColor = (c: { skinColor?: string | null; rarity: Rarity | null }) =>
  c.skinColor ?? RARITY_COLORS[c.rarity ?? 'common'].map;

export type Coord = { latitude: number; longitude: number };

/**
 * A plot drawn as a rounded square, slightly smaller than its cell so
 * neighbouring plots show a thin gap (like tiles). Works in lat/lng: cells
 * are square in metres, so fractions of each side give round corners.
 */
export function roundedCell(cell: Cell, inset = 0.06, radius = 0.2, steps = 4): Coord[] {
  const b = cellBounds(cell);
  const w = b.east - b.west;
  const h = b.north - b.south;
  const west = b.west + w * inset;
  const east = b.east - w * inset;
  const south = b.south + h * inset;
  const north = b.north - h * inset;
  const rx = w * radius;
  const ry = h * radius;
  // Corner centres, walking anticlockwise from the south-west corner.
  const corners: [number, number, number][] = [
    [south + ry, west + rx, Math.PI], // SW: 180° → 270°
    [south + ry, east - rx, 1.5 * Math.PI], // SE: 270° → 360°
    [north - ry, east - rx, 0], // NE: 0° → 90°
    [north - ry, west + rx, 0.5 * Math.PI], // NW: 90° → 180°
  ];
  const out: Coord[] = [];
  for (const [lat, lng, start] of corners) {
    for (let i = 0; i <= steps; i++) {
      const a = start + (i / steps) * (Math.PI / 2);
      out.push({ latitude: lat + Math.sin(a) * ry, longitude: lng + Math.cos(a) * rx });
    }
  }
  return out;
}
