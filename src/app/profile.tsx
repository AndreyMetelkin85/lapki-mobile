import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Text } from 'react-native';
import { api } from '../api';
import { ProfileForm } from '../components/ProfileForm';
import { profileOf } from '../domain';
import { useStore } from '../store';
import { Empty, Loading, Page, styles } from '../ui';

/** Сохраняет контакты покупателя в существующем API профиля. */
export default function ProfileScreen() {
  const store = useStore(),
    client = useQueryClient();
  if (store.authLoading)
    return (
      <Page>
        <Loading />
      </Page>
    );
  if (!store.user)
    return (
      <Page>
        <Empty
          title="Нужно войти"
          action="Войти"
          onAction={() => router.replace('/login')}
        />
      </Page>
    );
  return (
    <Page>
      <Text style={styles.title}>Для вашей{'\n'}следующей покупки</Text>
      <ProfileForm
        key={store.user.id}
        initial={profileOf(store.user)}
        submit={async (value) => {
          const updated = await api.profile(value);
          client.setQueryData(['me', store.session], updated);
          store.notify('Контакты сохранены');
        }}
      />
    </Page>
  );
}
