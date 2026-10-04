import { StyleSheet, useWindowDimensions } from 'react-native';
import Svg, { Circle, Defs, G, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';

/** Deterministic pseudo-random numbers so the art is stable between renders. */
function rand(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/** Night-side Earth with glowing city lights (splash screen). */
export function EarthBackground() {
  const { width: w, height: h } = useWindowDimensions();
  const r = w * 1.25;
  const cx = w * 0.5;
  const cy = h * 0.45 + r;
  const next = rand(7);
  // City lights clustered around "Europe" (centre of the visible disc).
  const lights = Array.from({ length: 420 }, () => {
    const a = (next() - 0.5) * 1.2;
    const d = r * (0.72 + next() * 0.28);
    const x = cx + Math.sin(a) * d * (0.35 + next() * 0.5);
    const y = cy - Math.cos(a * 0.6) * d;
    return { x, y, s: next() * 1.2 + 0.3, o: 0.35 + next() * 0.65 };
  });
  return (
    <Svg style={StyleSheet.absoluteFill} width={w} height={h}>
      <Defs>
        <LinearGradient id="space" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#02060A" />
          <Stop offset="1" stopColor="#061424" />
        </LinearGradient>
        <RadialGradient id="earth" cx="50%" cy="20%" r="60%">
          <Stop offset="0" stopColor="#0E2A4A" />
          <Stop offset="1" stopColor="#030B16" />
        </RadialGradient>
        <RadialGradient id="pin" cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor="#FFC94A" stopOpacity={0.9} />
          <Stop offset="1" stopColor="#FFC94A" stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect width={w} height={h} fill="url(#space)" />
      {Array.from({ length: 60 }, (_, i) => (
        <Circle key={`s${i}`} cx={next() * w} cy={next() * h * 0.45} r={next() * 0.9 + 0.2} fill="#fff" opacity={0.6} />
      ))}
      <Circle cx={cx} cy={cy} r={r + 6} fill="#2E8BFF" opacity={0.18} />
      <Circle cx={cx} cy={cy} r={r + 2} fill="#59A8FF" opacity={0.35} />
      <Circle cx={cx} cy={cy} r={r} fill="url(#earth)" />
      <G>
        {lights.map((l, i) => (
          <Circle key={i} cx={l.x} cy={l.y} r={l.s} fill="#FFC66B" opacity={l.o} />
        ))}
      </G>
      <Circle cx={w * 0.58} cy={h * 0.6} r={40} fill="url(#pin)" />
    </Svg>
  );
}

/** Night city skyline with lit windows (login screen). */
export function CityBackground() {
  const { width: w, height: h } = useWindowDimensions();
  const next = rand(11);
  const layers = [
    { color: '#0F2A22', base: h * 0.62, min: 0.08, max: 0.26, n: 14 },
    { color: '#0A1F19', base: h * 0.66, min: 0.1, max: 0.36, n: 11 },
  ];
  return (
    <Svg style={StyleSheet.absoluteFill} width={w} height={h}>
      <Defs>
        <LinearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#123A2C" />
          <Stop offset="0.55" stopColor="#0B2019" />
          <Stop offset="1" stopColor="#060B09" />
        </LinearGradient>
        <LinearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0.45" stopColor="#060B09" stopOpacity={0} />
          <Stop offset="0.7" stopColor="#060B09" stopOpacity={1} />
        </LinearGradient>
      </Defs>
      <Rect width={w} height={h} fill="url(#sky)" />
      {layers.map((layer, li) => {
        const bw = w / layer.n;
        return (
          <G key={li}>
            {Array.from({ length: layer.n + 1 }, (_, i) => {
              const bh = h * (layer.min + next() * (layer.max - layer.min));
              const x = i * bw - next() * bw * 0.4;
              const width = bw * (0.7 + next() * 0.5);
              const windows = [];
              for (let wy = layer.base - bh + 8; wy < layer.base - 4; wy += 7) {
                for (let wx = x + 4; wx < x + width - 4; wx += 6) {
                  if (next() > 0.62) windows.push(<Rect key={`${wx}-${wy}`} x={wx} y={wy} width={2.2} height={3} fill="#FFD27A" opacity={0.75} />);
                }
              }
              return (
                <G key={i}>
                  <Rect x={x} y={layer.base - bh} width={width} height={bh + h} fill={layer.color} />
                  {li === 1 ? windows : null}
                </G>
              );
            })}
          </G>
        );
      })}
      <Rect width={w} height={h} fill="url(#fade)" />
    </Svg>
  );
}
