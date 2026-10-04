import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CityBackground } from '@/components/art/backgrounds';
import { Logo } from '@/components/art/logo';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { C, S } from '@/constants/theme';
import { appleIdentityToken, useAppleAvailable } from '@/lib/apple';
import { useAuth } from '@/lib/auth';
import { errorMessage } from '@/lib/error-message';

/** After any sign-in: brand-new players see the tutorial, returning ones the map. */
export function goAfterSignIn(isNew: boolean) {
  router.replace(isNew ? '/tutorial' : '/map');
}

/** 2. Login: Apple, email or guest. */
export default function LoginRoute() {
  const { t } = useTranslation();
  const auth = useAuth();
  const appleAvailable = useAppleAvailable();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (auth.status === 'signedIn') goAfterSignIn(auth.isNewAccount);
  }, [auth.status, auth.isNewAccount]);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(errorMessage(t, e));
    } finally {
      setBusy(false);
    }
  };

  const apple = () =>
    run(async () => {
      const token = await appleIdentityToken();
      if (token) await auth.signInApple(token);
    });

  return (
    <View style={styles.root}>
      <CityBackground />
      <SafeAreaView style={styles.safe}>
        <View style={styles.logo}>
          <Logo />
        </View>
        <View style={styles.bottom}>
          <Text variant="h2" center>
            {t('login.welcome')}
          </Text>
          <Text color="#DCE4E0" center style={styles.tagline}>
            {t('login.tagline')}
          </Text>
          {appleAvailable && (
            <Button
              variant="light"
              title={t('login.apple')}
              icon={<Ionicons name="logo-apple" size={20} color="#000" />}
              onPress={apple}
              disabled={busy}
            />
          )}
          <Button
            variant="outline"
            title={t('login.email')}
            icon={<Ionicons name="mail" size={18} color={C.text} />}
            onPress={() => router.push('/email')}
            disabled={busy}
          />
          <Button
            variant="outline"
            title={t('login.guest')}
            icon={<Ionicons name="person" size={18} color={C.text} />}
            onPress={() => run(auth.signInGuest)}
            disabled={busy}
          />
          {busy && <ActivityIndicator color={C.green} />}
          {error && (
            <Text variant="small" color={C.danger} center>
              {error}
            </Text>
          )}
          <Text variant="tiny" color={C.textMuted} center style={styles.legal}>
            {t('login.legal')}
          </Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  safe: { flex: 1, justifyContent: 'space-between' },
  logo: { marginTop: 40, alignItems: 'center' },
  bottom: { paddingHorizontal: S.xxl, paddingBottom: S.md, gap: S.md },
  tagline: { marginBottom: S.lg, lineHeight: 22 },
  legal: { marginTop: S.md, lineHeight: 16, fontWeight: '500' },
});
