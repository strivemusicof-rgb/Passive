import { useId } from 'react';
import Svg, { Circle, Defs, Ellipse, G, Line, LinearGradient, Polygon, Stop } from 'react-native-svg';

import { box, iso, poly, seg, type P3 } from './iso';

export type BuildingKind = 'empty' | 'house' | 'office' | 'hotel' | 'tower';

/** Building level (0–4) → art kind. */
export const BUILDING_BY_LEVEL: BuildingKind[] = ['empty', 'house', 'office', 'hotel', 'tower'];

type Props = { kind: BuildingKind; size?: number; glow?: boolean };

/** Isometric grass plot with an optional building on it. */
export function PlotArt({ kind, size = 56, glow }: Props) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  // Tall buildings need headroom: shift the tile down inside the viewBox.
  const top = kind === 'tower' ? -38 : kind === 'hotel' ? -22 : kind === 'office' ? -14 : 0;
  return (
    <Svg width={size} height={size} viewBox={`0 ${top} 100 ${100 - top * 0.35}`}>
      <Defs>
        <LinearGradient id={`g${id}`} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#6FCF4A" />
          <Stop offset="1" stopColor="#2E8A2A" />
        </LinearGradient>
        <LinearGradient id={`w${id}`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#9AD7FF" />
          <Stop offset="1" stopColor="#2F6FB5" />
        </LinearGradient>
      </Defs>
      <Tile fill={`url(#g${id})`} glow={glow} />
      {kind === 'empty' && <EmptyDecor />}
      {kind === 'house' && <House />}
      {kind === 'office' && <Office glass={`url(#w${id})`} />}
      {kind === 'hotel' && <Hotel />}
      {kind === 'tower' && <Tower glass={`url(#w${id})`} />}
    </Svg>
  );
}

function Tile({ fill, glow }: { fill: string; glow?: boolean }) {
  const t = box(-25, -25, 25, 25, -7, 0);
  return (
    <G>
      <Polygon points={t.left} fill="#6B4A2B" />
      <Polygon points={t.right} fill="#553A22" />
      <Polygon points={t.top} fill={fill} stroke={glow ? '#7CFF8E' : '#8FE07A'} strokeWidth={glow ? 2 : 0.6} />
      {/* path / border */}
      <Polygon points={box(-21, -21, 21, 21, 0, 0.3).top} fill="none" stroke="#C9E8A6" strokeOpacity={0.35} strokeWidth={0.6} />
    </G>
  );
}

function Tree({ at, r = 4 }: { at: P3; r?: number }) {
  const [x, y] = iso(at);
  return (
    <G>
      <Ellipse cx={x} cy={y + 1} rx={r * 0.9} ry={r * 0.4} fill="#1F5E1D" opacity={0.5} />
      <Line x1={x} y1={y} x2={x} y2={y - r} stroke="#5A3B1E" strokeWidth={1.4} />
      <Circle cx={x} cy={y - r - 1} r={r} fill="#2F9A35" />
      <Circle cx={x - r * 0.3} cy={y - r - 2} r={r * 0.55} fill="#4CC24A" />
    </G>
  );
}

function Shrubs() {
  return (
    <>
      <Tree at={[-20, -6, 0]} r={3.5} />
      <Tree at={[18, 18, 0]} r={3.5} />
      <Tree at={[-6, 20, 0]} r={3} />
    </>
  );
}

function EmptyDecor() {
  return (
    <>
      <Tree at={[-18, -18, 0]} r={3.2} />
      <Tree at={[18, -14, 0]} r={3.6} />
      <Tree at={[16, 18, 0]} r={3.2} />
      <Tree at={[-18, 14, 0]} r={3} />
    </>
  );
}

function House() {
  const walls = box(-12, -10, 12, 10, 0, 12);
  const back: P3[] = [[-13, -11, 12], [13, -11, 12], [13, 0, 21], [-13, 0, 21]];
  const front: P3[] = [[-13, 11, 12], [13, 11, 12], [13, 0, 21], [-13, 0, 21]];
  const gable: P3[] = [[12, -10, 12], [12, 10, 12], [12, 0, 20]];
  return (
    <G>
      <Shrubs />
      <Polygon points={walls.left} fill="#F1E3C6" />
      <Polygon points={walls.right} fill="#D8C6A2" />
      <Polygon points={poly(back)} fill="#A9322A" />
      <Polygon points={poly(front)} fill="#D9473A" />
      <Polygon points={poly(gable)} fill="#E7D3AE" />
      {/* door + windows */}
      <Polygon points={poly([[-2, 10, 0], [3, 10, 0], [3, 10, 7], [-2, 10, 7]])} fill="#6B3E1F" />
      <Polygon points={poly([[-9, 10, 5], [-5, 10, 5], [-5, 10, 9], [-9, 10, 9]])} fill="#7EC8F5" />
      <Polygon points={poly([[6, 10, 5], [10, 10, 5], [10, 10, 9], [6, 10, 9]])} fill="#7EC8F5" />
      <Polygon points={poly([[12, -6, 5], [12, -1, 5], [12, -1, 9], [12, -6, 9]])} fill="#7EC8F5" />
    </G>
  );
}

function Stripes({ x0, y0, x1, y1, z0, z1, step, color }: { x0: number; y0: number; x1: number; y1: number; z0: number; z1: number; step: number; color: string }) {
  const lines = [];
  for (let z = z0 + step; z < z1; z += step) {
    lines.push(<Line key={`l${z}`} {...seg([x0, y1, z], [x1, y1, z])} stroke={color} strokeWidth={0.7} />);
    lines.push(<Line key={`r${z}`} {...seg([x1, y0, z], [x1, y1, z])} stroke={color} strokeWidth={0.7} />);
  }
  return <>{lines}</>;
}

function Office({ glass }: { glass: string }) {
  const b = box(-13, -11, 13, 11, 0, 30);
  const roof = box(-6, -5, 4, 4, 30, 33);
  return (
    <G>
      <Shrubs />
      <Polygon points={b.left} fill={glass} />
      <Polygon points={b.right} fill="#2A5E99" />
      <Polygon points={b.top} fill="#C7D3DE" />
      <Stripes x0={-13} y0={-11} x1={13} y1={11} z0={0} z1={30} step={4} color="#DDEFFF" />
      <Polygon points={roof.left} fill="#9AA7B3" />
      <Polygon points={roof.right} fill="#7B8894" />
      <Polygon points={roof.top} fill="#D6DEE6" />
    </G>
  );
}

function Hotel() {
  const main = box(-12, -12, 10, 6, 0, 44);
  const annex = box(-14, 6, 14, 14, 0, 10);
  return (
    <G>
      <Tree at={[18, 18, 0]} r={3.5} />
      <Polygon points={main.left} fill="#E9E2D6" />
      <Polygon points={main.right} fill="#BDB3A3" />
      <Polygon points={main.top} fill="#F5EFE5" />
      <Stripes x0={-12} y0={-12} x1={10} y1={6} z0={0} z1={44} step={4} color="#5F8FB8" />
      <Polygon points={annex.left} fill="#D7CBB8" />
      <Polygon points={annex.right} fill="#B3A68F" />
      <Polygon points={annex.top} fill="#4E7C4A" />
      <Polygon points={poly([[-4, 14, 2], [4, 14, 2], [4, 14, 7], [-4, 14, 7]])} fill="#F6C453" />
    </G>
  );
}

function Tower({ glass }: { glass: string }) {
  const base = box(-12, -12, 12, 12, 0, 6);
  const shaft = box(-9, -9, 9, 9, 6, 62);
  const crown = box(-5, -5, 5, 5, 62, 70);
  const [sx, sy] = iso([0, 0, 70]);
  return (
    <G>
      <Tree at={[19, 16, 0]} r={3.2} />
      <Tree at={[-19, 14, 0]} r={3} />
      <Polygon points={base.left} fill="#8C99A6" />
      <Polygon points={base.right} fill="#6E7B88" />
      <Polygon points={shaft.left} fill={glass} />
      <Polygon points={shaft.right} fill="#24548C" />
      <Stripes x0={-9} y0={-9} x1={9} y1={9} z0={6} z1={62} step={4} color="#CFE7FF" />
      <Polygon points={crown.left} fill="#B8C6D4" />
      <Polygon points={crown.right} fill="#8E9DAD" />
      <Polygon points={crown.top} fill="#DCE5EE" />
      <Line x1={sx} y1={sy} x2={sx} y2={sy - 10} stroke="#DCE5EE" strokeWidth={1} />
    </G>
  );
}
