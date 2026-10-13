import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Text, View } from 'react-native';
import { useStore } from '../../store';
import { Button, colors, Empty, Loading, Page, styles } from '../../ui';
import { BrandLogo } from '../../components/Brand';

/** Отображает профиль покупателя и переходы к личным данным и заказам. */
export default function AccountScreen() {
  const store = useStore();
  return (
    <Page>
      <BrandLogo size={128} />
      {store.authLoading ? (
        <Loading />
      ) : store.session && store.authError ? (
        <Empty
          title="Не удалось открыть аккаунт"
          error={store.authError}
          onRetry={() => {
            void store.refresh();
          }}
        />
      ) : store.user ? (
        <>
          <View style={styles.card}>
            <View style={styles.row}>
              <View
                style={{
                  width: 58,
                  height: 58,
                  borderRadius: 29,
                  backgroundColor: colors.pale,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons
                  name="person-outline"
                  color={colors.accent}
                  size={28}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text testID="account-name" style={styles.heading}>
                  {store.user.firstName || store.user.username}
                </Text>
                <Text style={styles.muted}>{store.user.email}</Text>
              </View>
            </View>
            <Text style={styles.muted}>Рады видеть вас и ваших питомцев.</Text>
          </View>
          <Button
            testID="account-profile"
            onPress={() => router.push('/profile')}
          >
            Контакты и адрес доставки
          </Button>
          <Button
            secondary
            testID="account-orders"
            onPress={() => router.push('/orders')}
          >
            Мои заказы
          </Button>
          <Button
            secondary
            testID="account-signout"
            disabled={store.busy}
            onPress={() => {
              void store.logout().catch(store.report);
            }}
          >
            Выйти из аккаунта
          </Button>
        </>
      ) : (
        <>
          <Text style={styles.title}>Ваш уголок{'\n'}в «Лапках»</Text>
          <Empty
            title="Войдите в аккаунт"
            description="Сохраняйте корзину, оформляйте покупки и следите за заказами."
            action="Войти"
            onAction={() => router.push('/login')}
          />
        </>
      )}
      <View style={[styles.card, { marginTop: 10 }]}>
        <Text style={styles.heading}>Магазин на вашем компьютере</Text>
        <Text style={styles.muted}>
          Если каталог не открывается, проверьте адрес подключения.
        </Text>
        <Button
          secondary
          disabled={store.busy}
          testID="account-connection"
          onPress={() => router.push('/connection')}
        >
          Подключение
        </Button>
      </View>
    </Page>
  );
}
