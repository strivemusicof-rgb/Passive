import type { PlotDto } from '@landrush/shared';
import { useEffect, useState } from 'react';

import { api } from './api';
import { placeName } from './location';

/** Loads one plot (by "row_col" key) plus a readable place name for it. */
export function usePlot(key: string) {
  const [plot, setPlot] = useState<PlotDto | null>(null);
  const [place, setPlace] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .plot(key)
      .then(async (p) => {
        if (cancelled) return;
        setPlot(p);
        const name = await placeName(p.lat, p.lng);
        if (!cancelled) setPlace(name);
      })
      .catch((e) => !cancelled && setError(e));
    return () => {
      cancelled = true;
    };
  }, [key]);

  return { plot, setPlot, place, error };
}
