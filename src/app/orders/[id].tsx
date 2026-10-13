import { useCallback, useState } from 'react';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Alert, Text, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api';
import { PaymentForm } from '../../components/PaymentForm';
import { orderLabels, paymentLabels, type Order } from '../../domain';
import { useStore } from '../../store';
import { operationStore } from '../../storage';
import { checkoutPendingSchema } from '../../operations';
import { Button, Empty, Loading, money, Page, Photo, styles } from '../../ui';

/** Показывает состав, доставку, платежи и допустимые действия покупателя. */
export default function OrderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>(),
    store = useStore(),
    client = useQueryClient();
  const [busy, setBusy] = useState(false);
  const userId = store.user?.id;
  const key = ['order', store.user?.id, store.server, id];
  const query = useQuery({
    queryKey: key,
    queryFn: () => api.order(id),
    enabled: !!store.user,
  });
  const payments = useQuery({
    queryKey: ['payments', store.user?.id, store.server, id],
    queryFn: () => api.payments(id),
    enabled: !!store.user,
  });
  const refetch = query.refetch;
  useFocusEffect(
    useCallback(() => {
      if (userId && id) void refetch();
    }, [userId, id, refetch]),
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
  if (query.isPending)
    return (
      <Page>
        <Loading />
      </Page>
    );
  if (!query.data)
    return (
      <Page>
        <Empty
          title="Заказ недоступен"
          error={query.error}
          onRetry={() => {
            void query.refetch();
          }}
        />
      </Page>
    );
  const order = query.data;
  const update = (value: Order) => client.setQueryData(key, value);
  const cancel = () =>
    Alert.alert(
      'Отменить заказ?',
      order.paymentStatus === 'PAID'
        ? 'Тестовая оплата будет возвращена.'
        : 'Резерв будет снят.',
      [
        { text: 'Оставить', style: 'cancel' },
        {
          text: 'Отменить заказ',
          style: 'destructive',
          onPress: () => {
            setBusy(true);
            void api
              .cancel(order.id, order.version)
              .then(async () => {
                await store.refresh();
                store.notify('Заказ отменён');
              })
              .catch(store.report)
              .finally(() => setBusy(false));
          },
        },
      ],
    );
  return (
    <Page>
      <Text style={styles.title}>
        Заказ №{'\n'}
        {order.id.slice(0, 8)}
      </Text>
      <View style={styles.row}>
        <View style={styles.pill}>
          <Text testID="order-status" style={styles.text}>
            {orderLabels[order.status]}
          </Text>
        </View>
        <Text testID="order-payment-status" style={styles.text}>
          {paymentLabels[order.paymentStatus]}
        </Text>
      </View>
      {order.paymentStatus === 'UNPAID' && order.paymentExpiresAt && (
        <Text style={styles.muted}>
          Оплатите до{' '}
          {new Date(order.paymentExpiresAt).toLocaleTimeString('ru-RU', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </Text>
      )}
      <View style={styles.card}>
        {order.lines.map((line) => (
          <View key={line.itemId} style={styles.row}>
            <Photo
              image={line.images[0]}
              thumb
              style={{ width: 62, height: 62 }}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.text}>{line.name}</Text>
              <Text style={styles.muted}>Количество: {line.quantity}</Text>
            </View>
            <Text style={styles.text}>
              {money((line.price ?? 0) * line.quantity)}
            </Text>
          </View>
        ))}
        <View style={styles.divider} />
        <View style={styles.between}>
          <Text style={styles.heading}>Итого</Text>
          <Text testID="order-total" style={styles.price}>
            {money(order.total)}
          </Text>
        </View>
      </View>
      {order.delivery && (
        <View style={styles.card}>
          <Text style={styles.heading}>Доставка</Text>
          <Text style={styles.text}>
            {order.delivery.firstName} {order.delivery.lastName}
          </Text>
          <Text style={styles.text}>{order.delivery.phone}</Text>
          <Text style={styles.muted}>
            {order.delivery.address.city}, {order.delivery.address.street}, дом{' '}
            {order.delivery.address.house}
            {order.delivery.address.apartment
              ? `, кв. ${order.delivery.address.apartment}`
              : ''}
            , {order.delivery.address.postalCode}
          </Text>
        </View>
      )}
      {order.status === 'draft' && (
        <Button
          onPress={() =>
            router.push({
              pathname: '/checkout',
              params: { draftId: order.id },
            })
          }
        >
          Продолжить оформление
        </Button>
      )}
      {order.paymentStatus === 'UNPAID' && (
        <PaymentForm key={order.id} order={order} updated={update} />
      )}
      {payments.data && payments.data.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.heading}>История оплаты</Text>
          {payments.data.map((payment) => (
            <View key={payment.id} style={styles.between}>
              <Text style={[styles.muted, { flex: 1 }]}>
                {payment.status === 'SUCCEEDED'
                  ? 'Оплачено'
                  : payment.status === 'REFUNDED'
                    ? 'Возврат'
                    : 'Отказ'}{' '}
                · •••• {payment.cardLast4}
              </Text>
              <Text style={styles.text}>{money(payment.amount)}</Text>
            </View>
          ))}
        </View>
      )}
      {order.status === 'draft' && (
        <Button
          secondary
          disabled={busy}
          onPress={() =>
            Alert.alert(
              'Удалить черновик?',
              'Он будет удалён из истории заказов.',
              [
                { text: 'Оставить', style: 'cancel' },
                {
                  text: 'Удалить',
                  style: 'destructive',
                  onPress: () => {
                    setBusy(true);
                    void (async () => {
                      await api.deleteDraft(order.id);
                      const pending = operationStore(
                        'checkout',
                        userId!,
                        checkoutPendingSchema,
                      );
                      if ((await pending.read())?.draftId === order.id)
                        await pending.clear();
                      router.replace('/orders');
                      await store.refresh();
                    })()
                      .catch(store.report)
                      .finally(() => setBusy(false));
                  },
                },
              ],
            )
          }
        >
          Удалить черновик
        </Button>
      )}
      {['placed', 'approved'].includes(order.status) && (
        <Button danger testID="order-cancel" loading={busy} onPress={cancel}>
          Отменить заказ
        </Button>
      )}
      <Button
        secondary
        loading={query.isFetching}
        onPress={() => {
          void query.refetch();
          void payments.refetch();
        }}
      >
        Обновить статус
      </Button>
    </Page>
  );
}
