import { Alert } from 'react-native';

/** Yes/no question. Resolves true when the player taps `ok`. */
export function confirm(title: string, message: string, ok: string, cancel: string): Promise<boolean> {
  return new Promise((resolve) =>
    Alert.alert(title, message, [
      { text: cancel, style: 'cancel', onPress: () => resolve(false) },
      { text: ok, onPress: () => resolve(true) },
    ], { cancelable: true, onDismiss: () => resolve(false) }),
  );
}
