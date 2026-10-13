import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StoreProvider, useStore } from '../store';
import { colors, Overlays } from '../ui';
import { BrandSplash } from '../components/Brand';

void SplashScreen.preventAutoHideAsync().catch(() => undefined);
SplashScreen.setOptions({ fade: true, duration: 180 });

const client = new QueryClient({
  defaultOptions: {
    queries: { retry: false, staleTime: 20000, refetchOnWindowFocus: true },
    mutations: { retry: false },
  },
});

/** Подключает нативный стек Android и общие состояния магазина. */
function Navigation() {
  const store = useStore();
  useEffect(() => {
    if (store.ready) SplashScreen.hide();
  }, [store.ready]);
  if (!store.ready) return <BrandSplash />;
  return (
    <>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.ink,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ title: 'Вход в аккаунт' }} />
        <Stack.Screen name="item/[id]" options={{ title: 'Карточка' }} />
        <Stack.Screen
          name="profile"
          options={{ title: 'Контакты и доставка' }}
        />
        <Stack.Screen
          name="checkout"
          options={{ title: 'Оформление заказа' }}
        />
        <Stack.Screen name="orders/index" options={{ title: 'Мои заказы' }} />
        <Stack.Screen name="orders/[id]" options={{ title: 'Заказ' }} />
        <Stack.Screen
          name="connection"
          options={{ title: 'Подключение к магазину' }}
        />
      </Stack>
      <Overlays />
      <StatusBar style="dark" />
    </>
  );
}

/** Создаёт провайдеры API-кеша и мобильных хранилищ. */
export default function RootLayout() {
  return (
    <QueryClientProvider client={client}>
      <StoreProvider>
        <Navigation />
      </StoreProvider>
    </QueryClientProvider>
  );
}
