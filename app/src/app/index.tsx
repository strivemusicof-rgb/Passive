import { useTranslation } from 'react-i18next';

import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';

export default function MapScreen() {
  const { t } = useTranslation();
  return (
    <Screen title={t('map.title')}>
      <ThemedText themeColor="textSecondary">{t('map.comingSoon')}</ThemedText>
    </Screen>
  );
}
