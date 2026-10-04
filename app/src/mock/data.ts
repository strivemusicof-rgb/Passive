/**
 * Mock data that mirrors the design mockup. Screens read from here until the
 * matching server endpoints exist (M1–M6); then each import is swapped for an
 * API call.
 */
import type { Rarity } from '@landrush/shared';

import type { BuildingKind } from '@/components/art/plot-art';

export type Plot = {
  id: number;
  rarity: Rarity;
  building: BuildingKind;
  level: number;
  incomePerDay: number;
  upgradeIncome: number;
  city: string;
  lat: number;
  lng: number;
  forSale: boolean;
};

export type Listing = {
  id: number;
  rarity: Rarity;
  building: BuildingKind;
  incomePerDay: number;
  city: string;
  price: number;
  seller: string;
};

export const me = {
  name: 'AlexR',
  level: 12,
  xp: 2450,
  xpNext: 5000,
  coins: 12450,
  gems: 320,
  plots: 43,
  districts: 3,
  achievements: 12,
  incomePerHour: 127,
};

export const myPlots: Plot[] = [
  { id: 8472, rarity: 'rare', building: 'house', level: 2, incomePerDay: 12, upgradeIncome: 8, city: 'Riga, Latvia', lat: 56.9496, lng: 24.1052, forSale: false },
  { id: 8473, rarity: 'common', building: 'empty', level: 0, incomePerDay: 3, upgradeIncome: 2, city: 'Riga, Latvia', lat: 56.9499, lng: 24.1058, forSale: false },
  { id: 8521, rarity: 'uncommon', building: 'office', level: 1, incomePerDay: 10, upgradeIncome: 6, city: 'Riga, Latvia', lat: 56.9512, lng: 24.1131, forSale: false },
  { id: 8630, rarity: 'epic', building: 'hotel', level: 1, incomePerDay: 30, upgradeIncome: 15, city: 'Riga, Latvia', lat: 56.9468, lng: 24.1107, forSale: false },
  { id: 8771, rarity: 'common', building: 'empty', level: 0, incomePerDay: 1, upgradeIncome: 2, city: 'Riga, Latvia', lat: 56.9531, lng: 24.0986, forSale: false },
  { id: 8790, rarity: 'legendary', building: 'tower', level: 1, incomePerDay: 100, upgradeIncome: 40, city: 'Riga, Latvia', lat: 56.9457, lng: 24.1189, forSale: false },
];

export const listings: Listing[] = [
  { id: 4721, rarity: 'rare', building: 'house', incomePerDay: 12, city: 'Riga, Latvia', price: 4500, seller: 'BalticBaron' },
  { id: 5012, rarity: 'uncommon', building: 'office', incomePerDay: 8, city: 'Jurmala, Latvia', price: 2800, seller: 'MapMaster' },
  { id: 6210, rarity: 'epic', building: 'tower', incomePerDay: 25, city: 'Tallinn, Estonia', price: 8900, seller: 'GeoTycoon' },
  { id: 7033, rarity: 'common', building: 'empty', incomePerDay: 5, city: 'Vilnius, Lithuania', price: 1200, seller: 'CityLord' },
  { id: 7118, rarity: 'uncommon', building: 'house', incomePerDay: 7, city: 'Riga, Latvia', price: 2300, seller: 'PlotHunter' },
];

export const buildingCatalogue: { kind: BuildingKind; incomePerDay: number; cost: number }[] = [
  { kind: 'empty', incomePerDay: 1, cost: 0 },
  { kind: 'house', incomePerDay: 3, cost: 1000 },
  { kind: 'office', incomePerDay: 10, cost: 5000 },
  { kind: 'hotel', incomePerDay: 30, cost: 25000 },
  { kind: 'tower', incomePerDay: 100, cost: 100000 },
];

export type Mission = {
  id: string;
  key: 'collect' | 'upgrade' | 'buyPlot' | 'watchAd' | 'login' | 'collect10' | 'sellPlot' | 'upgrade5';
  icon: 'cash' | 'arrow-up' | 'cart' | 'play' | 'calendar' | 'pricetag';
  progress: number;
  target: number;
  reward: number;
};

export const dailyMissions: Mission[] = [
  { id: 'd1', key: 'collect', icon: 'cash', progress: 0, target: 1, reward: 50 },
  { id: 'd2', key: 'upgrade', icon: 'arrow-up', progress: 0, target: 1, reward: 100 },
  { id: 'd3', key: 'buyPlot', icon: 'cart', progress: 0, target: 1, reward: 100 },
  { id: 'd4', key: 'watchAd', icon: 'play', progress: 0, target: 1, reward: 50 },
  { id: 'd5', key: 'login', icon: 'calendar', progress: 1, target: 1, reward: 50 },
];

export const weeklyMissions: Mission[] = [
  { id: 'w1', key: 'collect10', icon: 'cash', progress: 4, target: 10, reward: 500 },
  { id: 'w2', key: 'upgrade5', icon: 'arrow-up', progress: 2, target: 5, reward: 750 },
  { id: 'w3', key: 'sellPlot', icon: 'pricetag', progress: 0, target: 1, reward: 400 },
];

export const leaderboard = [
  { name: 'LandKing', plots: 482, income: 2450 },
  { name: 'BalticBaron', plots: 320, income: 1980 },
  { name: 'MapMaster', plots: 278, income: 1760 },
  { name: 'GeoTycoon', plots: 251, income: 1420 },
  { name: 'RigaRuler', plots: 199, income: 1210 },
  { name: 'LandQueen', plots: 184, income: 1005 },
  { name: 'NorthBuilder', plots: 160, income: 980 },
  { name: 'CityLord', plots: 142, income: 870 },
  { name: 'PlotHunter', plots: 130, income: 760 },
  { name: 'EuroLand', plots: 118, income: 690 },
];

export const MARKET_FEE = 0.05;

const RARITY_ROLL: Rarity[] = ['common', 'common', 'common', 'uncommon', 'uncommon', 'rare', 'epic', 'legendary'];

/** Plots around Riga centre shown on the map (mine + other players'). */
export const mapPlots = [
  ...myPlots.map((p) => ({ id: p.id, lat: p.lat, lng: p.lng, rarity: p.rarity, mine: true })),
  ...Array.from({ length: 28 }, (_, i) => {
    const a = i * 2.39996;
    const d = 0.0012 + (i % 7) * 0.0009;
    return {
      id: 9000 + i,
      lat: 56.9496 + Math.sin(a) * d,
      lng: 24.1052 + Math.cos(a) * d * 1.8,
      rarity: RARITY_ROLL[(i * 5) % RARITY_ROLL.length],
      mine: false,
    };
  }),
];

/** Look up any plot shown in the UI (owned, listed or on the map). */
export function findPlot(id: number): Plot & { mine: boolean } {
  const own = myPlots.find((p) => p.id === id);
  if (own) return { ...own, mine: true };
  const listed = listings.find((l) => l.id === id);
  const onMap = mapPlots.find((p) => p.id === id);
  return {
    id,
    rarity: listed?.rarity ?? onMap?.rarity ?? 'common',
    building: listed?.building ?? 'empty',
    level: 1,
    incomePerDay: listed?.incomePerDay ?? 3,
    upgradeIncome: 2,
    city: listed?.city ?? 'Riga, Latvia',
    lat: onMap?.lat ?? 56.9496,
    lng: onMap?.lng ?? 24.1052,
    forSale: !!listed,
    mine: false,
  };
}
