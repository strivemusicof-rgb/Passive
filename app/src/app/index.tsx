import { router } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';

import { EarthBackground } from '@/components/art/backgrounds';
import { Logo } from '@/components/art/logo';
import { Text } from '@/components/ui/text';
import { C, S } from '@/constants/theme';
import { useAuth } from '@/lib/auth';

/** 1. Splash / loading: restores the saved login, then goes to the map or login. */
export default function SplashRoute() {
  const { t } = useTranslation();
  const [progress, setProgress] = useState(0.1);

  const { status } = useAuth();
  const [minTimeDone, setMinTimeDone] = useState(false);

  useEffect(() => {
    SplashScreen.hideAsync();
    const timer = setInterval(() => setProgress((p) => Math.min(1, p + 0.06)), 80);
    const done = setTimeout(() => setMinTimeDone(true), 1500);
    return () => {
      clearInterval(timer);
      clearTimeout(done);
    };
  }, []);

  // Leave once the saved login has been checked and the logo has been seen.
  useEffect(() => {
    if (!minTimeDone || status === 'loading') return;
    router.replace(status === 'signedIn' ? '/map' : '/login');
  }, [minTimeDone, status]);

  return (
    <View style={styles.root}>
      <EarthBackground />
      <SafeAreaView style={styles.safe}>
        <View style={styles.logo}>
          <Logo />
        </View>
        <View style={styles.pin}>
          <Ionicons name="location" size={40} color="#FFC94A" />
        </View>
        <View style={styles.bottom}>
          <Text variant="small" color="#DCE4F0" center>
            {t('splash.loading')}
          </Text>
          <View style={styles.track}>
            <LinearGradient
              colors={['#1E6BFF', '#5BB4FF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.fill, { width: `${progress * 100}%` }]}
            />
          </View>
          <Text variant="tiny" color={C.textMuted} center style={styles.version}>
            v{Constants.expoConfig?.version ?? '0.1.0'}
          </Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#02060A' },
  safe: { flex: 1, justifyContent: 'space-between' },
  logo: { marginTop: 70, alignItems: 'center' },
  pin: { position: 'absolute', left: '53%', top: '57%' },
  bottom: { paddingHorizontal: 48, paddingBottom: S.xl, gap: S.md },
  track: { height: 12, borderRadius: 6, backgroundColor: '#14233A', borderWidth: 1, borderColor: '#2B4468', overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 6 },
  version: { marginTop: S.xl },
});
