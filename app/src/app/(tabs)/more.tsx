import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Card } from '@/components/ui/card';
import { MenuRow } from '@/components/ui/menu-row';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';

export default function MoreRoute() {
  const { t } = useTranslation();
  return (
    <Screen tabs>
      <Text variant="h1">{t('more.title')}</Text>
      <Card>
        <MenuRow icon="clipboard-outline" label={t('more.missions')} onPress={() => router.push('/missions')} />
        <MenuRow icon="storefront-outline" label={t('more.marketplace')} onPress={() => router.push('/marketplace')} />
        <MenuRow icon="trophy-outline" label={t('more.leaderboard')} onPress={() => router.push('/leaderboard')} />
        <MenuRow icon="person-outline" label={t('more.profile')} onPress={() => router.push('/profile')} />
        <MenuRow icon="settings-outline" label={t('more.settings')} onPress={() => router.push('/settings')} last />
      </Card>
    </Screen>
  );
}
