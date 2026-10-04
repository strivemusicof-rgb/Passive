import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CityBackground } from '@/components/art/backgrounds';
import { Logo } from '@/components/art/logo';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { C, S } from '@/constants/theme';

/** 2. Login. Real auth arrives in M1; for now every option starts the tutorial. */
export default function LoginRoute() {
  const { t } = useTranslation();
  const start = () => router.replace('/tutorial');

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
          <Button variant="light" title={t('login.apple')} icon={<Ionicons name="logo-apple" size={20} color="#000" />} onPress={start} />
          <Button variant="outline" title={t('login.email')} icon={<Ionicons name="mail" size={18} color={C.text} />} onPress={start} />
          <Button variant="outline" title={t('login.guest')} icon={<Ionicons name="person" size={18} color={C.text} />} onPress={start} />
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
