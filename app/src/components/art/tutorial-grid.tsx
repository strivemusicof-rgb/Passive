import Svg, { Defs, Ellipse, G, Polygon, RadialGradient, Stop } from 'react-native-svg';

import { box } from './iso';

/** Dark isometric city block with one glowing free plot in the middle. */
export function TutorialGrid({ width = 320 }: { width?: number }) {
  const N = 2; // tiles from centre in each direction
  const gap = 56;
  const tiles = [];
  for (let s = -2 * N; s <= 2 * N; s++) {
    // draw back-to-front so nearer tiles overlap farther ones
    for (let i = -N; i <= N; i++) {
      const j = s - i;
      if (j < -N || j > N) continue;
      const cx = i * gap;
      const cy = j * gap;
      const centre = i === 0 && j === 0;
      const t = box(cx - 25, cy - 25, cx + 25, cy + 25, -5, 0);
      const h = centre ? 0 : ((i * 7 + j * 13 + 40) % 5) * 7;
      const b = h > 0 ? box(cx - 14, cy - 14, cx + 12, cy + 12, 0, h) : null;
      tiles.push(
        <G key={`${i},${j}`}>
          <Polygon points={t.left} fill={centre ? '#1B7A2E' : '#1A1F22'} />
          <Polygon points={t.right} fill={centre ? '#146024' : '#141819'} />
          <Polygon
            points={t.top}
            fill={centre ? '#3FD958' : '#2B3235'}
            fillOpacity={centre ? 0.55 : 1}
            stroke={centre ? '#8CFF9C' : '#3A4246'}
            strokeWidth={centre ? 2.5 : 0.8}
          />
          {b && (
            <G>
              <Polygon points={b.left} fill="#3B4347" />
              <Polygon points={b.right} fill="#2E3538" />
              <Polygon points={b.top} fill="#4C5559" />
            </G>
          )}
        </G>,
      );
    }
  }
  return (
    <Svg width={width} height={(width * 250) / 270} viewBox="-85 -80 270 250">
      <Defs>
        <RadialGradient id="glow" cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor="#3FD958" stopOpacity={0.6} />
          <Stop offset="1" stopColor="#3FD958" stopOpacity={0} />
        </RadialGradient>
      </Defs>
      {tiles}
      <Ellipse cx={50} cy={52} rx={70} ry={38} fill="url(#glow)" />
      <Ellipse cx={50} cy={52} rx={12} ry={6} fill="none" stroke="#B6FFC0" strokeWidth={2} />
    </Svg>
  );
}
