import { z } from 'zod';
import { ApiError, isUncertain } from './errors.ts';
import type {
  Cart,
  CartLine,
  Delivery,
  Order,
  Payment,
  PaymentInput,
  Selection,
} from './domain';

export const checkoutPendingSchema = z.object({
  draftKey: z.string().uuid(),
  placeKey: z.string().uuid(),
  cartVersion: z.number().int().positive(),
  draftId: z.string().uuid().optional(),
  version: z.number().int().optional(),
});
export const paymentPendingSchema = z.object({
  key: z.string().uuid(),
  previousPaymentIds: z.array(z.string().uuid()),
});
export type CheckoutPending = z.infer<typeof checkoutPendingSchema>;
export type PaymentPending = z.infer<typeof paymentPendingSchema>;
type Services = {
  cart: () => Promise<Cart>;
  saveCart: (version: number, lines: Selection, key?: string) => Promise<Cart>;
  createDraft: (cartVersion: number, key: string) => Promise<Order>;
  order: (id: string) => Promise<Order>;
  place: (id: string, version: number, key: string) => Promise<Order>;
  profile: (value: Delivery) => Promise<unknown>;
  payments: (id: string) => Promise<Payment[]>;
  pay: (id: string, value: PaymentInput, key: string) => Promise<unknown>;
};
export type OperationStore<T> = {
  read: () => Promise<T | null>;
  write: (value: T) => Promise<void>;
  clear: () => Promise<void>;
};

/** Проверяет состав, количество и показанные цены перед подтверждением корзины. */
export function sameCart(displayed: CartLine[], actual: CartLine[]): boolean {
  return (
    displayed.length === actual.length &&
    actual.every((line) =>
      displayed.some(
        (v) =>
          v.kind === line.kind &&
          v.id === line.id &&
          v.quantity === line.quantity &&
          v.price === line.price,
      ),
    )
  );
}

/** Оформляет заказ и восстанавливает принятую операцию по сохранённым ключам. */
export async function checkout(
  services: Services,
  store: OperationStore<CheckoutPending>,
  newKey: () => string,
  displayed: CartLine[],
  delivery: Delivery,
): Promise<Order> {
  let pending = await store.read();
  await services.profile(delivery);
  if (!pending) {
    const fresh = await services.cart();
    if (!sameCart(displayed, fresh.lines))
      throw new ApiError('PRICE_CHANGED', 409);
    if (!fresh.lines.length || fresh.lines.some((line) => !line.available))
      throw new ApiError('PRODUCT_UNAVAILABLE', 409);
    const quoted = await services.saveCart(
      fresh.version,
      fresh.lines,
      newKey(),
    );
    pending = {
      draftKey: newKey(),
      placeKey: newKey(),
      cartVersion: quoted.version,
    };
    await store.write(pending);
  }
  try {
    let order = pending.draftId
      ? await services.order(pending.draftId)
      : await services.createDraft(pending.cartVersion, pending.draftKey);
    pending = {
      ...pending,
      draftId: order.id,
      version: pending.version ?? order.version,
    };
    await store.write(pending);
    if (order.status === 'draft') {
      try {
        order = await services.place(
          order.id,
          pending.version!,
          pending.placeKey,
        );
      } catch (error) {
        if (!isUncertain(error)) throw error;
        const current = await services.order(order.id).catch(() => null);
        if (!current || current.status === 'draft')
          throw new ApiError('CHECKOUT_STATUS_UNKNOWN', 0);
        order = current;
      }
    }
    if (['cancelled', 'expired'].includes(order.status)) {
      await store.clear();
      throw new ApiError('INVALID_STATUS_TRANSITION', 409);
    }
    await store.clear();
    return order;
  } catch (error) {
    if (isUncertain(error)) throw new ApiError('CHECKOUT_STATUS_UNKNOWN', 0);
    // Подтверждённый отказ не повторяем бесконечно с тем же устаревшим телом.
    await store.clear();
    throw error;
  }
}

/** Сверяет сохранённую попытку с сервером без повторной передачи карты. */
export async function inspectPayment(
  services: Services,
  id: string,
  pending: PaymentPending,
): Promise<{
  order: Order;
  outcome: 'success' | 'declined' | 'unknown';
  failureCode?: string;
}> {
  const order = await services.order(id);
  if (['PAID', 'REFUNDED'].includes(order.paymentStatus))
    return { order, outcome: 'success' };
  const attempts = await services.payments(id);
  const accepted = attempts.filter(
    (p) => !pending.previousPaymentIds.includes(p.id),
  );
  if (accepted.some((p) => p.status === 'DECLINED'))
    return {
      order,
      outcome: 'declined',
      failureCode:
        accepted.find((p) => p.status === 'DECLINED')?.failureCode ??
        'PAYMENT_DECLINED',
    };
  return { order, outcome: 'unknown' };
}

/** Оплачивает с постоянным ключом попытки, сохраняя только безопасные метаданные. */
export async function pay(
  services: Services,
  store: OperationStore<PaymentPending>,
  newKey: () => string,
  id: string,
  input: PaymentInput,
): Promise<Order> {
  let pending = await store.read();
  if (pending) {
    const existing = await inspectPayment(services, id, pending);
    if (existing.outcome === 'success') {
      await store.clear();
      return existing.order;
    }
    if (existing.outcome === 'declined') {
      await store.clear();
      throw new ApiError(existing.failureCode ?? 'PAYMENT_DECLINED', 402);
    }
  } else {
    pending = {
      key: newKey(),
      previousPaymentIds: (await services.payments(id)).map((p) => p.id),
    };
    await store.write(pending);
  }
  try {
    await services.pay(id, input, pending.key);
    const order = await services.order(id);
    if (order.paymentStatus !== 'PAID')
      throw new ApiError('PAYMENT_STATUS_UNKNOWN', 0);
    await store.clear();
    return order;
  } catch (error) {
    if (isUncertain(error)) throw new ApiError('PAYMENT_STATUS_UNKNOWN', 0);
    // Другие реквизиты не должны превращать невыясненную попытку в новую оплату.
    if (!(error instanceof ApiError && error.code === 'IDEMPOTENCY_KEY_REUSED'))
      await store.clear();
    throw error;
  }
}
