import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Pressable, StyleSheet } from 'react-native';

import { Button } from '@/components/ui/button';
import { Header } from '@/components/ui/header';
import { Input } from '@/components/ui/input';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { C, S } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { errorMessage } from '@/lib/error-message';

import { goAfterSignIn } from './login';

/** Email login / sign-up. */
export default function EmailRoute() {
  const { t } = useTranslation();
  const auth = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('register');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid = /^\S+@\S+\.\S+$/.test(email.trim()) && password.length >= 8;

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await auth.signInEmail(email.trim(), password, mode);
      goAfterSignIn(mode === 'register');
    } catch (e) {
      setError(errorMessage(t, e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior="padding">
      <Screen>
        <Header title={mode === 'login' ? t('email.titleLogin') : t('email.titleRegister')} close />
        <Input
          label={t('email.email')}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          textContentType="emailAddress"
        />
        <Input
          label={t('email.password')}
          hint={mode === 'register' ? t('email.passwordHint') : undefined}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          textContentType={mode === 'login' ? 'password' : 'newPassword'}
          onSubmitEditing={() => valid && submit()}
        />
        {error && (
          <Text variant="small" color={C.danger}>
            {error}
          </Text>
        )}
        <Button
          title={mode === 'login' ? t('email.submitLogin') : t('email.submitRegister')}
          onPress={submit}
          disabled={!valid || busy}
          style={styles.submit}
        />
        <Pressable onPress={() => setMode(mode === 'login' ? 'register' : 'login')} hitSlop={8}>
          <Text variant="small" color={C.green} center>
            {mode === 'login' ? t('email.switchToRegister') : t('email.switchToLogin')}
          </Text>
        </Pressable>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: C.bg },
  submit: { marginTop: S.sm },
});
