import { useTranslation } from 'react-i18next';

import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';

export default function LandsScreen() {
  const { t } = useTranslation();
  return (
    <Screen title={t('lands.title')}>
      <ThemedText themeColor="textSecondary">{t('lands.empty')}</ThemedText>
    </Screen>
  );
}
