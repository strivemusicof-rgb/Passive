/**
 * Example data for screens whose server parts come later:
 * Marketplace (M5) and Leaderboard (M6).
 */
import type { Rarity } from '@landrush/shared';

import type { BuildingKind } from '@/components/art/plot-art';

export type Listing = {
  id: number;
  rarity: Rarity;
  building: BuildingKind;
  incomePerDay: number;
  city: string;
  price: number;
  seller: string;
};

export const listings: Listing[] = [
  { id: 4721, rarity: 'rare', building: 'house', incomePerDay: 12, city: 'Riga, Latvia', price: 4500, seller: 'BalticBaron' },
  { id: 5012, rarity: 'uncommon', building: 'office', incomePerDay: 8, city: 'Jurmala, Latvia', price: 2800, seller: 'MapMaster' },
  { id: 6210, rarity: 'epic', building: 'tower', incomePerDay: 25, city: 'Tallinn, Estonia', price: 8900, seller: 'GeoTycoon' },
  { id: 7033, rarity: 'common', building: 'empty', incomePerDay: 5, city: 'Vilnius, Lithuania', price: 1200, seller: 'CityLord' },
  { id: 7118, rarity: 'uncommon', building: 'house', incomePerDay: 7, city: 'Riga, Latvia', price: 2300, seller: 'PlotHunter' },
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
