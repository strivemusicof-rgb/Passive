// Cosmetic items: they change how things look and nothing else (no income,
// no coins). Bought with gems or coins earned in the game. Shared so the app
// can draw previews and the server checks prices from the same list.
//
// type: plotSkin (tile colour on the map), plotFlag (emoji on the tile),
//       nameColor (player name colour), avatarFrame (ring around the avatar)
// value: colour (skins, names, frames) or emoji (flags); accent: 2nd colour.

export const COSMETIC_TYPES = ['plotSkin', 'plotFlag', 'nameColor', 'avatarFrame'];

export const COSMETICS = [
  // Plot skins
  { id: 'skin_emerald', type: 'plotSkin', value: '#10B981', coins: 3000 },
  { id: 'skin_ice', type: 'plotSkin', value: '#7DD3FC', coins: 3000 },
  { id: 'skin_lava', type: 'plotSkin', value: '#FF6B35', gems: 25 },
  { id: 'skin_neon', type: 'plotSkin', value: '#FF4FD8', gems: 25 },
  { id: 'skin_night', type: 'plotSkin', value: '#6366F1', gems: 30 },
  { id: 'skin_gold', type: 'plotSkin', value: '#F6C453', gems: 60 },

  // Plot flags
  { id: 'flag_lv', type: 'plotFlag', value: '🇱🇻', coins: 1000 },
  { id: 'flag_ee', type: 'plotFlag', value: '🇪🇪', coins: 1000 },
  { id: 'flag_lt', type: 'plotFlag', value: '🇱🇹', coins: 1000 },
  { id: 'flag_ua', type: 'plotFlag', value: '🇺🇦', coins: 1000 },
  { id: 'flag_eu', type: 'plotFlag', value: '🇪🇺', coins: 1000 },
  { id: 'flag_checkered', type: 'plotFlag', value: '🏁', gems: 15 },
  { id: 'flag_pirate', type: 'plotFlag', value: '🏴‍☠️', gems: 20 },
  { id: 'flag_crown', type: 'plotFlag', value: '👑', gems: 40 },

  // Name colours
  { id: 'name_sky', type: 'nameColor', value: '#60A5FA', coins: 5000 },
  { id: 'name_mint', type: 'nameColor', value: '#5EEAD4', coins: 5000 },
  { id: 'name_rose', type: 'nameColor', value: '#F472B6', gems: 20 },
  { id: 'name_violet', type: 'nameColor', value: '#A78BFA', gems: 25 },
  { id: 'name_gold', type: 'nameColor', value: '#F6C453', gems: 50 },

  // Avatar frames
  { id: 'frame_silver', type: 'avatarFrame', value: '#CBD5E1', coins: 4000 },
  { id: 'frame_neon', type: 'avatarFrame', value: '#34D399', accent: '#A7F3D0', gems: 25 },
  { id: 'frame_ice', type: 'avatarFrame', value: '#7DD3FC', accent: '#E0F2FE', gems: 30 },
  { id: 'frame_fire', type: 'avatarFrame', value: '#FB923C', accent: '#F43F5E', gems: 40 },
  { id: 'frame_royal', type: 'avatarFrame', value: '#A78BFA', accent: '#F6C453', gems: 60 },
];

const BY_ID = new Map(COSMETICS.map((c) => [c.id, c]));

/** The item with this id (and type, if given), or undefined. */
export function cosmetic(id, type) {
  const item = id ? BY_ID.get(id) : undefined;
  return item && (!type || item.type === type) ? item : undefined;
}
