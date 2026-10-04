import { LANGUAGES, type HealthResponse } from '@landrush/shared';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { C, R, S } from '@/constants/theme';
import { LANGUAGE_NAMES } from '@/i18n';
import { api } from '@/lib/api';

type ServerState = { kind: 'checking' } | { kind: 'ok'; health: HealthResponse } | { kind: 'down' };

/** Settings: language and server status. */
export default function SettingsRoute() {
  const { t, i18n } = useTranslation();
  const [server, setServer] = useState<ServerState>({ kind: 'checking' });

  useEffect(() => {
    api
      .health()
      .then((health) => setServer({ kind: 'ok', health }))
      .catch(() => setServer({ kind: 'down' }));
  }, []);

  return (
    <Screen tabs>
      <Text variant="h1">{t('profile.settings')}</Text>
      <Card style={styles.card}>
        <Text variant="bodyBold">{t('profile.language')}</Text>
        <View style={styles.row}>
          {LANGUAGES.map((lng) => {
            const active = i18n.language === lng;
            return (
              <Pressable key={lng} onPress={() => i18n.changeLanguage(lng)} style={[styles.chip, active && styles.chipActive]}>
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
  chip: { paddingHorizontal: 14, height: 34, justifyContent: 'center', borderRadius: R.pill, borderWidth: 1, borderColor: C.cardBorder, backgroundColor: C.bg },
  chipActive: { borderColor: C.green, backgroundColor: C.greenSoft },
});
