import { LANGUAGES, type HealthResponse } from '@landrush/shared';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { LANGUAGE_NAMES } from '@/i18n';
import { api } from '@/lib/api';

type ServerState = { kind: 'checking' } | { kind: 'ok'; health: HealthResponse } | { kind: 'down' };

export default function ProfileScreen() {
  const { t, i18n } = useTranslation();
  const [server, setServer] = useState<ServerState>({ kind: 'checking' });

  useEffect(() => {
    api
      .health()
      .then((health) => setServer({ kind: 'ok', health }))
      .catch(() => setServer({ kind: 'down' }));
  }, []);

  return (
    <Screen title={t('profile.title')}>
      <ThemedText type="smallBold">{t('profile.language')}</ThemedText>
      <View style={styles.row}>
        {LANGUAGES.map((lng) => (
          <Pressable key={lng} onPress={() => i18n.changeLanguage(lng)}>
            <ThemedView
              type={i18n.language === lng ? 'backgroundSelected' : 'backgroundElement'}
              style={styles.chip}>
              <ThemedText type="small">{LANGUAGE_NAMES[lng]}</ThemedText>
            </ThemedView>
          </Pressable>
        ))}
      </View>

      <ThemedText type="smallBold">{t('profile.server')}</ThemedText>
      <ThemedText themeColor="textSecondary">
        {server.kind === 'checking' && t('profile.checking')}
        {server.kind === 'ok' && t('profile.serverOk', { version: server.health.version })}
        {server.kind === 'down' && t('profile.serverDown')}
      </ThemedText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: Spacing.two, flexWrap: 'wrap' },
  chip: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, borderRadius: Spacing.four },
});
