import { useEffect } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Text, View } from 'react-native';
import { api, newKey } from '../api';
import { ProfileForm } from '../components/ProfileForm';
import { profileOf, totalOf, type Order } from '../domain';
import { ApiError } from '../errors';
import { checkout, checkoutPendingSchema } from '../operations';
import { operationStore } from '../storage';
import { useStore } from '../store';
import { Button, Empty, Loading, money, Page, styles } from '../ui';

/** Подтверждает адрес и восстанавливает незавершённое оформление. */
export default function CheckoutScreen() {
  const store = useStore();
  const { draftId } = useLocalSearchParams<{ draftId?: string }>();
  const userId = store.user?.id;
  const state = useQuery({
    queryKey: ['checkout-state', store.server, userId, draftId],
    enabled: !!userId,
    queryFn: async () => {
      const storage = operationStore(
        'checkout',
        userId!,
        checkoutPendingSchema,
      );
      let saved = await storage.read();
      if (draftId && saved && saved.draftId !== draftId)
        throw new ApiError('CHECKOUT_STATUS_UNKNOWN', 409);
      const id = saved?.draftId ?? draftId;
      let draft: Order | null = null;
      if (id) {
        try {
          draft = await api.order(id);
        } catch (error) {
          if (
            error instanceof ApiError &&
            error.status === 404 &&
            saved?.draftId
          ) {
            await storage.clear();
            return { draft: null, pending: false };
          }
          throw error;
        }
        if (draft.status !== 'draft') await storage.clear();
        else if (!saved) {
          const cart = await api.cart();
          saved = {
            draftKey: newKey(),
            placeKey: newKey(),
            cartVersion: cart.version,
            draftId: draft.id,
            version: draft.version,
          };
          await storage.write(saved);
        }
      }
      return { draft, pending: !!saved };
    },
  });
  const draft = state.data?.draft;
  const pending = state.data?.pending ?? false;
  useEffect(() => {
    if (draft && draft.status !== 'draft')
      router.replace({ pathname: '/orders/[id]', params: { id: draft.id } });
  }, [draft]);
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
          title="Войдите для оформления"
          action="Войти"
          onAction={() =>
            router.replace({ pathname: '/login', params: { next: 'checkout' } })
          }
        />
      </Page>
    );
  if (state.isPending)
    return (
      <Page>
        <Loading />
      </Page>
    );
  if (state.error)
    return (
      <Page>
        <Empty
          title="Не удалось восстановить оформление"
          error={state.error}
          onRetry={() => {
            void state.refetch();
          }}
          action="Мои заказы"
          onAction={() => router.replace('/orders')}
        />
      </Page>
    );
  if (store.mergePending)
    return (
      <Page>
        <Empty
          title="Объедините корзину"
          description="Завершите добавление гостевых позиций в аккаунт."
          action="В корзину"
          onAction={() => router.replace('/(tabs)/cart')}
        />
      </Page>
    );
  if (store.cartError && !draft && !pending)
    return (
      <Page>
        <Empty
          title="Корзина недоступна"
          error={store.cartError}
          onRetry={() => {
            void store.refresh();
          }}
        />
      </Page>
    );
  if (!draft && !pending && !store.lines.length)
    return (
      <Page>
        <Empty
          title="Корзина пуста"
          action="В каталог"
          onAction={() => router.replace('/')}
        />
      </Page>
    );
  const lines =
    draft?.lines ?? store.lines.map((line) => ({ ...line, itemId: line.id }));
  const unavailable =
    !draft && !pending && store.lines.some((line) => !line.available);
  return (
    <Page>
      <Text style={styles.title}>Почти у вас</Text>
      <Text style={styles.muted}>Проверьте состав и адрес доставки.</Text>
      <View style={styles.card}>
        <Text style={styles.heading}>Ваш заказ</Text>
        {lines.map((line) => (
          <View key={line.itemId} style={styles.between}>
            <Text style={[styles.text, { flex: 1 }]}>
              {line.name} × {line.quantity}
            </Text>
            <Text style={styles.text}>
              {money((line.price ?? 0) * line.quantity)}
            </Text>
          </View>
        ))}
        <View style={styles.divider} />
        <View style={styles.between}>
          <Text style={styles.heading}>Итого</Text>
          <Text testID="checkout-total" style={styles.price}>
            {money(totalOf(lines))}
          </Text>
        </View>
        <Text style={styles.muted}>
          После оформления резерв действует 15 минут.
        </Text>
      </View>
      {pending && (
        <Text style={styles.muted}>
          Оформление уже начато. Повтор продолжит сохранённую операцию и не
          создаст второй заказ.
        </Text>
      )}
      {unavailable ? (
        <Empty
          title="В корзине есть недоступные позиции"
          action="Исправить корзину"
          onAction={() => router.replace('/(tabs)/cart')}
        />
      ) : (
        <ProfileForm
          key={store.user.id}
          initial={profileOf(store.user)}
          prefix="checkout"
          label={pending ? 'Продолжить оформление' : 'Оформить заказ'}
          disabled={store.busy}
          submit={async (delivery) => {
            try {
              const order = await checkout(
                api,
                operationStore('checkout', userId!, checkoutPendingSchema),
                newKey,
                store.lines,
                delivery,
              );
              router.replace({
                pathname: '/orders/[id]',
                params: { id: order.id },
              });
              await store.refresh();
            } catch (error) {
              await state.refetch();
              await store.refresh();
              throw error;
            }
          }}
        />
      )}
      <Button secondary onPress={() => router.navigate('/(tabs)/cart')}>
        Вернуться в корзину
      </Button>
    </Page>
  );
}
