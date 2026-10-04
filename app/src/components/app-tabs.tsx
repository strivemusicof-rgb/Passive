import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useTranslation } from 'react-i18next';
import { useColorScheme } from 'react-native';

import { Colors } from '@/constants/theme';

export default function AppTabs() {
  const { t } = useTranslation();
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'unspecified' ? 'light' : scheme];

  return (
    <NativeTabs
      backgroundColor={colors.background}
      indicatorColor={colors.backgroundElement}
      labelStyle={{ selected: { color: colors.text } }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>{t('tabs.map')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="map.fill" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="lands">
        <NativeTabs.Trigger.Label>{t('tabs.lands')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="square.grid.3x3.fill" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="market">
        <NativeTabs.Trigger.Label>{t('tabs.market')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="cart.fill" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="profile">
        <NativeTabs.Trigger.Label>{t('tabs.profile')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="person.crop.circle.fill" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
