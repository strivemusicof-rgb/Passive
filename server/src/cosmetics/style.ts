import type { PlayerRef, UserStyle } from '@landrush/shared';
import { cosmetic } from '@landrush/shared/cosmetics';

/** Columns needed to show a player with their cosmetics. */
export const playerSelect = { id: true, displayName: true, nameColor: true, avatarFrame: true } as const;

type StyledUser = { nameColor: string | null; avatarFrame: string | null };

export function userStyle(u: StyledUser): UserStyle {
  const frame = cosmetic(u.avatarFrame, 'avatarFrame');
  return {
    nameColor: cosmetic(u.nameColor, 'nameColor')?.value ?? null,
    frame: frame ? { color: frame.value, accent: frame.accent ?? null } : null,
  };
}

export function playerRef(u: StyledUser & { id: string; displayName: string }): PlayerRef {
  return { id: u.id, displayName: u.displayName, style: userStyle(u) };
}

/** A plot's skin and flag, resolved for the map. */
export function plotLook(p: { skin: string | null; flag: string | null }) {
  const skin = cosmetic(p.skin, 'plotSkin');
  const flag = cosmetic(p.flag, 'plotFlag');
  return {
    skin: skin ? { id: skin.id, color: skin.value } : null,
    flag: flag ? { id: flag.id, emoji: flag.value } : null,
  };
}
