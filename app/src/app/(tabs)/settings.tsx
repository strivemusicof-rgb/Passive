import { LANGUAGES, type HealthResponse } from '@landrush/shared';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { C, R, S } from '@/constants/theme';
import { LANGUAGE_NAMES } from '@/i18n';
import { api } from '@/lib/api';
import { appleIdentityToken, useAppleAvailable } from '@/lib/apple';
import { useAuth } from '@/lib/auth';
import { errorMessage } from '@/lib/error-message';

type ServerState = { kind: 'checking' } | { kind: 'ok'; health: HealthResponse } | { kind: 'down' };

/** Settings: account, language and server status. */
export default function SettingsRoute() {
  const { t, i18n } = useTranslation();
  const auth = useAuth();
  const appleAvailable = useAppleAvailable();
  const [server, setServer] = useState<ServerState>({ kind: 'checking' });
  const [error, setError] = useState<string | null>(null);

  const setLanguage = (lng: (typeof LANGUAGES)[number]) => {
    i18n.changeLanguage(lng);
    auth.updateProfile({ language: lng }).catch(() => {});
  };

  const saveWithApple = async () => {
    setError(null);
    try {
      const token = await appleIdentityToken();
      if (token) await auth.signInApple(token);
    } catch (e) {
      setError(errorMessage(t, e));
    }
  };

  const signOut = async () => {
    await auth.signOut();
    router.replace('/login');
  };

  const confirmDelete = () =>
    Alert.alert(t('account.deleteTitle'), t('account.deleteBody'), [
      { text: t('account.cancel'), style: 'cancel' },
      {
        text: t('account.delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await auth.deleteAccount();
            router.replace('/login');
          } catch (e) {
            setError(errorMessage(t, e));
          }
        },
      },
    ]);

  const user = auth.user;

  useEffect(() => {
    api
      .health()
      .then((health) => setServer({ kind: 'ok', health }))
      .catch(() => setServer({ kind: 'down' }));
  }, []);

  return (
    <Screen tabs>
      <Text variant="h1">{t('profile.settings')}</Text>
      {user && (
        <Card style={styles.card}>
          <Text variant="bodyBold">{t('account.title')}</Text>
          <Text>{user.displayName}</Text>
          <Text variant="small" color={C.textSecondary}>
            {user.isGuest
              ? t('account.guest')
              : user.hasApple
                ? t('account.signedInApple')
                : t('account.signedInEmail')}
          </Text>
          {user.isGuest && appleAvailable && (
            <>
              <Text variant="small" color={C.textSecondary}>
                {t('account.guestHint')}
              </Text>
              <Button
                variant="light"
                title={t('account.saveProgress')}
                icon={<Ionicons name="logo-apple" size={20} color="#000" />}
                onPress={saveWithApple}
              />
            </>
          )}
          {error && (
            <Text variant="small" color={C.danger}>
              {error}
            </Text>
          )}
          <Button variant="outline" title={t('account.signOut')} onPress={signOut} />
          <Pressable onPress={confirmDelete} hitSlop={8}>
            <Text variant="small" color={C.danger} center>
              {t('account.delete')}
            </Text>
          </Pressable>
        </Card>
      )}
      <Card style={styles.card}>
        <Text variant="bodyBold">{t('profile.language')}</Text>
        <View style={styles.row}>
          {LANGUAGES.map((lng) => {
            const active = i18n.language === lng;
            return (
              <Pressable
                key={lng}
                onPress={() => setLanguage(lng)}
                style={[styles.chip, active && styles.chipActive]}>
                <Text variant="small" color={active ? C.text : C.textSecondary}>
                  {LANGUAGE_NAMES[lng]}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Card>
      <Card style={styles.card}>
        <Text variant="bodyBold">{t('profile.server')}</Text>
        <Text variant="small" color={server.kind === 'down' ? C.danger : C.textSecondary}>
          {server.kind === 'checking' && t('profile.checking')}
          {server.kind === 'ok' && t('profile.serverOk', { version: server.health.version })}
          {server.kind === 'down' && t('profile.serverDown')}
        </Text>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { padding: S.lg, gap: S.md },
  row: { flexDirection: 'row', gap: S.sm, flexWrap: 'wrap' },
  chip: {
    paddingHorizontal: 14,
    height: 34,
    justifyContent: 'center',
    borderRadius: R.pill,
    borderWidth: 1,
    borderColor: C.cardBorder,
    backgroundColor: C.bg,
  },
  chipActive: { borderColor: C.green, backgroundColor: C.greenSoft },
});
