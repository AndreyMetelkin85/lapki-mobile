import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';
import { loginSchema } from '../domain';
import { useStore } from '../store';
import { Button, Field, Page, styles } from '../ui';
import { BrandLogo } from '../components/Brand';

/** Выполняет вход готового аккаунта без регистрации и восстановления пароля. */
export default function LoginScreen() {
  const store = useStore(),
    params = useLocalSearchParams<{ next?: string }>();
  const [email, setEmail] = useState(''),
    [password, setPassword] = useState(''),
    [busy, setBusy] = useState(false),
    [errors, setErrors] = useState<Record<string, string>>({});
  async function submit() {
    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      setErrors(
        Object.fromEntries(
          parsed.error.issues.map((issue) => [issue.path[0], issue.message]),
        ),
      );
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      await store.login(parsed.data.email, parsed.data.password);
      setPassword('');
      router.replace(
        params.next === 'checkout' ? '/checkout' : '/(tabs)/account',
      );
    } catch (error) {
      store.report(error);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Page>
      <BrandLogo />
      <Text style={styles.title}>С возвращением</Text>
      <Text style={styles.muted}>
        Войдите, чтобы ваша корзина и покупки всегда были под рукой.
      </Text>
      <View style={styles.card}>
        <Field
          testID="login-email"
          label="Электронная почта"
          placeholder="you@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          value={email}
          onChangeText={setEmail}
          error={errors.email}
          editable={!busy}
        />
        <Field
          testID="login-password"
          label="Пароль"
          secureTextEntry
          autoCapitalize="none"
          autoComplete="current-password"
          value={password}
          onChangeText={setPassword}
          error={errors.password}
          editable={!busy}
          returnKeyType="done"
          onSubmitEditing={() => {
            void submit();
          }}
        />
        <Button
          testID="login-submit"
          loading={busy}
          onPress={() => {
            void submit();
          }}
        >
          Войти
        </Button>
      </View>
    </Page>
  );
}
