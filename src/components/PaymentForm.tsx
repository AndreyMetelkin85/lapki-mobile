import { useEffect, useMemo, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { api, newKey } from '../api';
import { demoCards, paymentInputSchema, type Order } from '../domain';
import { ApiError } from '../errors';
import { inspectPayment, pay, paymentPendingSchema } from '../operations';
import { operationStore } from '../storage';
import { useStore } from '../store';
import { Button, Chip, Field, money, styles } from '../ui';

/** Оплачивает заказ тестовой картой, не сохраняя реквизиты на устройстве. */
export function PaymentForm({
  order,
  updated,
}: {
  order: Order;
  updated: (order: Order) => void;
}) {
  const store = useStore();
  const userId = store.user!.id,
    server = store.server,
    report = store.report;
  const storage = useMemo(
    () =>
      operationStore(
        `payment.${order.id}`,
        userId,
        paymentPendingSchema,
        server,
      ),
    [order.id, userId, server],
  );
  const [values, setValues] = useState({
    cardNumber: '',
    expiryMonth: '',
    expiryYear: '',
    cvv: '',
    cardholderName: '',
  });
  const [busy, setBusy] = useState(false),
    [unknown, setUnknown] = useState(false),
    [errors, setErrors] = useState<Record<string, string>>({});
  const running = useRef(false);
  useEffect(() => {
    void storage
      .read()
      .then((p) => setUnknown(!!p))
      .catch(report);
  }, [storage, report]);
  async function submit() {
    if (running.current) return;
    const parsed = paymentInputSchema().safeParse(values);
    if (!parsed.success) {
      setErrors(
        Object.fromEntries(
          parsed.error.issues.map((issue) => [issue.path[0], issue.message]),
        ),
      );
      return;
    }
    running.current = true;
    setBusy(true);
    setErrors({});
    try {
      const paid = await pay(api, storage, newKey, order.id, parsed.data);
      updated(paid);
      setValues({
        cardNumber: '',
        expiryMonth: '',
        expiryYear: '',
        cvv: '',
        cardholderName: '',
      });
      setUnknown(false);
      store.notify('Заказ оплачен');
      await store.refresh();
    } catch (e) {
      try {
        setUnknown(!!(await storage.read()));
      } catch {
        setUnknown(true);
      }
      await store.refresh();
      store.report(e);
    } finally {
      running.current = false;
      setBusy(false);
    }
  }
  async function check() {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    try {
      const pending = await storage.read();
      if (!pending) {
        setUnknown(false);
        return;
      }
      const result = await inspectPayment(api, order.id, pending);
      updated(result.order);
      if (
        result.outcome !== 'unknown' ||
        result.order.paymentStatus !== 'UNPAID'
      ) {
        await storage.clear();
        setUnknown(false);
        if (result.outcome === 'declined')
          throw new ApiError(result.failureCode ?? 'PAYMENT_DECLINED', 402);
        store.notify('Статус оплаты обновлён');
      } else
        store.notify(
          'Результат пока не подтверждён. Можно повторить ту же попытку с прежними реквизитами.',
        );
    } catch (e) {
      store.report(e);
    } finally {
      running.current = false;
      setBusy(false);
    }
  }
  const field = (
    name: keyof typeof values,
    label: string,
    testID: string,
    numeric = false,
    secure = false,
  ) => (
    <Field
      label={label}
      testID={testID}
      value={values[name]}
      onChangeText={(v) => setValues({ ...values, [name]: v })}
      keyboardType={numeric ? 'number-pad' : 'default'}
      secureTextEntry={secure}
      autoCapitalize={numeric ? 'none' : 'characters'}
      autoComplete="off"
      editable={!busy}
      error={errors[name]}
      maxLength={
        name === 'cardNumber'
          ? 23
          : name === 'cvv' || name === 'expiryYear'
            ? 4
            : name === 'expiryMonth'
              ? 2
              : 100
      }
    />
  );
  return (
    <View style={styles.card}>
      <Text style={styles.heading}>Тестовая оплата</Text>
      <Text style={styles.muted}>Реального списания не будет.</Text>
      {unknown && (
        <>
          <Text style={styles.text}>
            Ответ предыдущей оплаты не получен. Проверьте результат. Для повтора
            используйте те же реквизиты: новая попытка не будет создана.
          </Text>
          <Button
            secondary
            testID="payment-recheck"
            loading={busy}
            onPress={() => {
              void check();
            }}
          >
            Проверить результат
          </Button>
        </>
      )}
      {field('cardNumber', 'Номер тестовой карты', 'payment-card', true)}
      <View style={styles.row}>
        {field('expiryMonth', 'Месяц', 'payment-expiry-month', true)}
        {field('expiryYear', 'Год', 'payment-expiry-year', true)}
      </View>
      {field('cvv', 'CVV/CVC', 'payment-cvv', true, true)}
      {field('cardholderName', 'Имя владельца', 'payment-cardholder')}
      <Button
        testID="payment-submit"
        loading={busy}
        onPress={() => {
          void submit();
        }}
      >
        {unknown ? 'Повторить ту же попытку' : `Оплатить ${money(order.total)}`}
      </Button>
      <Text style={styles.label}>Выберите учебный сценарий</Text>
      {demoCards.map((card, index) => (
        <Chip
          key={card}
          selected={values.cardNumber.replace(/\s/g, '') === card}
          onPress={() => setValues({ ...values, cardNumber: card })}
        >
          {['Успешная оплата', 'Отказ банка', 'Недостаточно средств'][index]}
        </Chip>
      ))}
      <Text style={styles.muted}>Тестовый срок: 12/2099, CVV: 123.</Text>
    </View>
  );
}
