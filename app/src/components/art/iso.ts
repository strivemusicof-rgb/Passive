/**
 * Tiny isometric helper for the vector art. A tile spans x,y ∈ [-25, 25] and
 * is drawn inside a 100×100 viewBox; z goes up.
 */
export type P3 = [x: number, y: number, z: number];

export function iso([x, y, z]: P3): [number, number] {
  return [50 + (x - y) * 0.9, 52 + (x + y) * 0.45 - z];
}

export function poly(points: P3[]): string {
  return points.map((p) => iso(p).map((n) => n.toFixed(2)).join(',')).join(' ');
}

export type BoxFaces = { top: string; left: string; right: string };

/** Visible faces of an axis-aligned box (viewer looks from +x/+y). */
export function box(x0: number, y0: number, x1: number, y1: number, z0: number, z1: number): BoxFaces {
  return {
    top: poly([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]]),
    left: poly([[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]]),
    right: poly([[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]]),
  };
}

/** Line segment between two 3D points, as SVG coordinates. */
export function seg(a: P3, b: P3) {
  const [x1, y1] = iso(a);
  const [x2, y2] = iso(b);
  return { x1, y1, x2, y2 };
}
