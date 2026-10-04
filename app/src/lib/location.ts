import * as Location from 'expo-location';

/** Riga centre: used when the player doesn't share their location. */
export const DEFAULT_POSITION = { lat: 56.9496, lng: 24.1052 };

/** Current position, or null if permission is denied or it takes too long. */
export async function currentPosition(timeoutMs = 8000): Promise<{ lat: number; lng: number } | null> {
  try {
    const { granted } = await Location.requestForegroundPermissionsAsync();
    if (!granted) return null;
    const last = await Location.getLastKnownPositionAsync({ maxAge: 5 * 60_000 });
    const pos =
      last ??
      (await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
      ]));
    return pos ? { lat: pos.coords.latitude, lng: pos.coords.longitude } : null;
  } catch {
    return null;
  }
}

/** "Riga, Latvia" for a point, using the phone's built-in geocoder (free). */
export async function placeName(lat: number, lng: number): Promise<string | null> {
  try {
    const [a] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
    if (!a) return null;
    return [a.city ?? a.subregion ?? a.region, a.country].filter(Boolean).join(', ') || null;
  } catch {
    return null;
  }
}
