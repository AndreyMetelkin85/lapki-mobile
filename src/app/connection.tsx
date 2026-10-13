import { useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { router } from 'expo-router';
import { normalizeApiUrl } from '../api';
import { useStore } from '../store';
import { Button, Field, Page, styles } from '../ui';

/** Настраивает адрес локального магазина без пересборки Android-приложения. */
export default function ConnectionScreen() {
  const store = useStore();
  const [url, setUrl] = useState(store.server),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  async function save() {
    if (busy || store.busy) return;
    let next: string;
    try {
      next = normalizeApiUrl(url);
    } catch {
      setError(
        'Введите http:// или https:// адрес, заканчивающийся на /api/v3',
      );
      return;
    }
    setBusy(true);
    setError('');
    try {
      await store.setServer(next);
      store.notify('Адрес магазина сохранён');
      router.replace('/');
    } catch (e) {
      store.report(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Page>
      <Text style={styles.title}>Ваш магазин</Text>
      <Text style={styles.muted}>
        Приложение подключается к магазину, запущенному на вашем компьютере.
      </Text>
      <View style={styles.card}>
        <Field
          testID="connection-url"
          label="Адрес API"
          value={url}
          onChangeText={setUrl}
          autoCapitalize="none"
          keyboardType="url"
          error={error}
          editable={!busy}
          placeholder="http://10.0.2.2:8080/api/v3"
        />
        <Button
          loading={busy}
          disabled={store.busy}
          onPress={() =>
            store.session && url !== store.server
              ? Alert.alert(
                  'Сменить магазин?',
                  'При смене адреса нужно будет войти заново.',
                  [
                    { text: 'Отмена', style: 'cancel' },
                    {
                      text: 'Сменить',
                      onPress: () => {
                        void save();
                      },
                    },
                  ],
                )
              : void save()
          }
        >
          Сохранить адрес
        </Button>
      </View>
      <Text style={styles.muted}>
        Для стандартного Android-эмулятора адрес компьютера — 10.0.2.2. Для
        телефона укажите адрес компьютера в вашей сети или используйте
        USB-подключение.
      </Text>
    </Page>
  );
}
