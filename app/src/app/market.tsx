import { useTranslation } from 'react-i18next';

import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';

export default function MarketScreen() {
  const { t } = useTranslation();
  return (
    <Screen title={t('market.title')}>
      <ThemedText themeColor="textSecondary">{t('market.empty')}</ThemedText>
    </Screen>
  );
}
