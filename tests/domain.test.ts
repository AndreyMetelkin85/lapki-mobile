import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  guestSchema,
  mergeSelections,
  paymentInputSchema,
  profileSchema,
  totalOf,
  userSchema,
} from '../src/domain.ts';

const id = '10000000-0000-4000-8000-000000000001';
test('mixed guest/server merge adds products and preserves one instance of the pet', () => {
  const petId = '20000000-0000-4000-8000-000000000001';
  assert.deepEqual(
    mergeSelections(
      [
        { id, kind: 'product', quantity: 2 },
        { id: petId, kind: 'pet', quantity: 1 },
      ],
      [
        { id, kind: 'product', quantity: 3 },
        { id: petId, kind: 'pet', quantity: 1 },
      ],
    ),
    [
      { id, kind: 'product', quantity: 5 },
      { id: petId, kind: 'pet', quantity: 1 },
    ],
  );
});
test('amounts use exact kopecks for mixed quantities', () => {
  assert.equal(
    totalOf([
      { price: 0.1, quantity: 3 },
      { price: 0.2, quantity: 2 },
    ]),
    0.7,
  );
});
test('corrupted guest storage cannot turn into an API command', () => {
  assert.equal(
    guestSchema.safeParse([{ id: 'wrong', kind: 'product', quantity: -1 }])
      .success,
    false,
  );
});
test('profile preserves API house field and normalizes phone without accepting missing postal code', () => {
  const input = {
    firstName: ' Анна ',
    lastName: 'Иванова',
    phone: '+7 (900) 123-45-67',
    address: {
      city: 'Москва',
      street: 'Лесная',
      house: '12',
      apartment: '',
      postalCode: '123456',
    },
  };
  const result = profileSchema.parse(input);
  assert.equal(result.firstName, 'Анна');
  assert.equal(result.phone, '+79001234567');
  assert.equal(result.address.house, '12');
  assert.equal(result.address.apartment, null);
  assert.equal(
    profileSchema.safeParse({
      ...input,
      address: { ...input.address, postalCode: '' },
    }).success,
    false,
  );
});
test('payment validates expiry boundary and supports only existing simulator cards', () => {
  const schema = paymentInputSchema(new Date('2026-10-09T00:00:00Z'));
  const card = {
    cardNumber: '4242 4242 4242 4242',
    expiryMonth: '10',
    expiryYear: '2026',
    cvv: '123',
    cardholderName: 'TEST USER',
  };
  assert.equal(schema.parse(card).cardNumber, '4242424242424242');
  assert.equal(schema.safeParse({ ...card, expiryMonth: '9' }).success, false);
  assert.equal(
    schema.safeParse({ ...card, cardNumber: '4111111111111111' }).success,
    false,
  );
  assert.equal(schema.safeParse({ ...card, cvv: '' }).success, false);
});
test('user decoder strips fields that must not reach mobile state', () => {
  const result = userSchema.parse({
    id,
    username: 'buyer',
    email: 'buyer@example.com',
    userStatus: 'ACTIVE',
    role: 'USER',
    password: 'secret',
  });
  assert.equal('password' in result, false);
});
