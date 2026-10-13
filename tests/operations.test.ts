import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  checkout,
  pay,
  type CheckoutPending,
  type OperationStore,
  type PaymentPending,
} from '../src/operations.ts';
import { ApiError } from '../src/errors.ts';
import type { Cart, Delivery, Order, PaymentInput } from '../src/domain.ts';

const id = '10000000-0000-4000-8000-000000000001';
const cart: Cart = {
  version: 3,
  lines: [
    {
      id,
      kind: 'product',
      quantity: 2,
      name: 'Корм',
      price: 100,
      quotedPrice: 100,
      available: true,
      reason: null,
      priceChanged: false,
      images: [],
    },
  ],
};
const draft: Order = {
  id,
  userId: id,
  version: 1,
  status: 'draft',
  paymentStatus: 'NOT_STARTED',
  total: 200,
  createdAt: '2026-10-09T00:00:00Z',
  delivery: null,
  lines: [],
};
const placed: Order = {
  ...draft,
  status: 'placed',
  paymentStatus: 'UNPAID',
  version: 2,
};
const delivery: Delivery = {
  firstName: 'Анна',
  lastName: 'Иванова',
  phone: '+79001234567',
  address: {
    city: 'Москва',
    street: 'Лесная',
    house: '12',
    postalCode: '123456',
  },
};
const card: PaymentInput = {
  cardNumber: '4242424242424242',
  expiryMonth: 12,
  expiryYear: 2099,
  cvv: '123',
  cardholderName: 'TEST USER',
};
function memory<T>(): OperationStore<T> & { value: T | null } {
  return {
    value: null,
    async read() {
      return this.value;
    },
    async write(v) {
      this.value = v;
    },
    async clear() {
      this.value = null;
    },
  };
}
function services(): Parameters<typeof checkout>[0] {
  return {
    cart: async () => cart,
    saveCart: async () => ({ ...cart, version: 4 }),
    profile: async () => ({}),
    createDraft: async () => draft,
    order: async () => draft,
    place: async () => placed,
    payments: async () => [],
    pay: async () => ({}),
  };
}
let serial = 0;
const key = () =>
  `10000000-0000-4000-8000-${String(++serial).padStart(12, '0')}`;

test('price race is rejected before creating or placing any order', async () => {
  const api = services();
  let created = 0;
  api.createDraft = async () => {
    created++;
    return draft;
  };
  await assert.rejects(
    checkout(api, memory(), key, [{ ...cart.lines[0], price: 90 }], delivery),
    (e) => e instanceof ApiError && e.code === 'PRICE_CHANGED',
  );
  assert.equal(created, 0);
});
test('lost accepted draft is retried with the same key and original cart version', async () => {
  const storage = memory<CheckoutPending>(),
    api = services();
  const calls: [number, string][] = [];
  api.createDraft = async (version: number, token: string) => {
    calls.push([version, token]);
    if (calls.length === 1) throw new ApiError('SERVICE_UNAVAILABLE');
    return draft;
  };
  await assert.rejects(
    checkout(api, storage, key, cart.lines, delivery),
    (e) => e instanceof ApiError && e.code === 'CHECKOUT_STATUS_UNKNOWN',
  );
  const resumed = await checkout(api, storage, key, [], delivery);
  assert.equal(resumed.id, id);
  assert.deepEqual(calls[0], calls[1]);
  assert.equal(storage.value, null);
});
test('lost place response resolves by reading the accepted order without creating a second draft', async () => {
  const api = services(),
    storage = memory<CheckoutPending>();
  let created = 0;
  api.createDraft = async () => {
    created++;
    return draft;
  };
  api.place = async () => {
    throw new ApiError('SERVICE_UNAVAILABLE');
  };
  api.order = async () => placed;
  assert.equal(
    (await checkout(api, storage, key, cart.lines, delivery)).status,
    'placed',
  );
  assert.equal(created, 1);
  assert.equal(storage.value, null);
});
test('uncertain payment stores metadata only and accepted payment is not charged again', async () => {
  const api = services(),
    storage = memory<PaymentPending>();
  let charged = 0;
  api.order = async () => placed;
  api.pay = async () => {
    charged++;
    throw new ApiError('SERVICE_UNAVAILABLE');
  };
  await assert.rejects(
    pay(api, storage, key, id, card),
    (e) => e instanceof ApiError && e.code === 'PAYMENT_STATUS_UNKNOWN',
  );
  assert.deepEqual(Object.keys(storage.value!).sort(), [
    'key',
    'previousPaymentIds',
  ]);
  assert.equal(
    JSON.stringify(storage.value).includes('4242424242424242'),
    false,
  );
  api.order = async () => ({ ...placed, paymentStatus: 'PAID' });
  assert.equal((await pay(api, storage, key, id, card)).paymentStatus, 'PAID');
  assert.equal(charged, 1);
});
test('confirmed decline permits a new key, unlike a reused-key error', async () => {
  const api = services(),
    storage = memory<PaymentPending>();
  api.pay = async () => {
    throw new ApiError('PAYMENT_DECLINED', 402);
  };
  await assert.rejects(pay(api, storage, key, id, card));
  assert.equal(storage.value, null);
  api.pay = async () => {
    throw new ApiError('IDEMPOTENCY_KEY_REUSED', 409);
  };
  await assert.rejects(pay(api, storage, key, id, card));
  assert.ok(storage.value);
});
