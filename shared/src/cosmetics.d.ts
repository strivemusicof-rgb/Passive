export type CosmeticType = 'plotSkin' | 'plotFlag' | 'nameColor' | 'avatarFrame';

export interface Cosmetic {
  id: string;
  type: CosmeticType;
  /** Colour (#hex) for skins, names and frames; emoji for flags. */
  value: string;
  /** Second colour (frames). */
  accent?: string;
  /** Price: gems or coins (exactly one is set). */
  gems?: number;
  coins?: number;
}

export declare const COSMETIC_TYPES: readonly CosmeticType[];
export declare const COSMETICS: readonly Cosmetic[];
export declare function cosmetic(id: string | null | undefined, type?: CosmeticType): Cosmetic | undefined;
