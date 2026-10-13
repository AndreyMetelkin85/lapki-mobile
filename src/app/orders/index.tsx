import { useCallback } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api';
import { orderLabels, paymentLabels } from '../../domain';
import { useStore } from '../../store';
import { Empty, Loading, money, Page, styles } from '../../ui';

/** Показывает собственные заказы покупателя с серверными состояниями оплаты. */
export default function OrdersScreen() {
  const store = useStore();
  const userId = store.user?.id;
  const query = useQuery({
    queryKey: ['orders', store.user?.id, store.server],
    queryFn: api.orders,
    enabled: !!store.user,
  });
  const refetch = query.refetch;
  useFocusEffect(
    useCallback(() => {
      if (userId) void refetch();
    }, [userId, refetch]),
  );
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
      <Text style={styles.title}>Ваши покупки</Text>
      {query.isPending ? (
        <Loading />
      ) : query.error ? (
        <Empty
          title="Не удалось загрузить заказы"
          error={query.error}
          onRetry={() => {
            void query.refetch();
          }}
        />
      ) : !query.data.length ? (
        <Empty
          title="Заказов пока нет"
          description="Выберите что-нибудь для вашего друга."
          action="В каталог"
          onAction={() => router.navigate('/')}
        />
      ) : (
        [...query.data]
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
          .map((order) => (
            <Pressable
              key={order.id}
              testID="order-card"
              accessibilityRole="button"
              accessibilityLabel={`Заказ ${order.id.slice(0, 8)}`}
              style={styles.card}
              onPress={() =>
                router.push({
                  pathname: '/orders/[id]',
                  params: { id: order.id },
                })
              }
            >
              <View style={styles.between}>
                <Text style={styles.heading}>№ {order.id.slice(0, 8)}</Text>
                <Text style={styles.price}>
                  {order.total == null
                    ? 'После оформления'
                    : money(order.total)}
                </Text>
              </View>
              <Text style={styles.muted}>
                {new Date(order.createdAt).toLocaleString('ru-RU')}
              </Text>
              <View style={styles.row}>
                <View style={styles.pill}>
                  <Text style={styles.text}>{orderLabels[order.status]}</Text>
                </View>
                <Text style={styles.muted}>
                  {paymentLabels[order.paymentStatus]}
                </Text>
              </View>
              <Text style={styles.muted}>
                {order.lines
                  .map((line) => `${line.name} × ${line.quantity}`)
                  .join(' · ')}
              </Text>
            </Pressable>
          ))
      )}
    </Page>
  );
}
