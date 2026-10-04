import * as AppleAuthentication from 'expo-apple-authentication';
import { useEffect, useState } from 'react';

/** Asks iOS for an Apple identity token; null if the player cancelled. */
export async function appleIdentityToken(): Promise<string | null> {
  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [AppleAuthentication.AppleAuthenticationScope.EMAIL],
    });
    return credential.identityToken;
  } catch (e) {
    if ((e as { code?: string }).code === 'ERR_REQUEST_CANCELED') return null;
    throw e;
  }
}

/** Sign in with Apple exists on iOS 13+ only (not in the web preview). */
export function useAppleAvailable() {
  const [available, setAvailable] = useState(false);
  useEffect(() => {
    AppleAuthentication.isAvailableAsync()
      .then(setAvailable)
      .catch(() => setAvailable(false));
  }, []);
  return available;
}
