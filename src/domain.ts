import { z } from 'zod';

// Контракты покупателя согласованы с lapki-frontend и /api/v3.
const id = z.string().uuid();
const moneyValue = z
  .union([z.number(), z.string().regex(/^\d+(?:\.\d+)?$/)])
  .transform(Number)
  .refine(Number.isFinite);
export const imageSchema = z.object({
  mediaId: id,
  alt: z.string(),
  isCover: z.boolean(),
  position: z.number(),
  imageUrl: z.string(),
  thumbUrl: z.string(),
});
const common = z.object({
  id,
  kind: z.enum(['product', 'pet']),
  name: z.string(),
  description: z.string(),
  categoryId: id.nullable(),
  price: moneyValue.nullable(),
  currency: z.literal('RUB'),
  publicationStatus: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']),
  version: z.number(),
  images: z.array(imageSchema),
});
export const productSchema = common.extend({
  kind: z.literal('product'),
  sku: z.string().nullable(),
  brand: z.string(),
  productType: z.string().nullable(),
  animalTypes: z.array(z.string()),
  feedForm: z.string(),
  lifeStages: z.array(z.string()),
  netWeightGrams: z.number().nullable(),
  ingredients: z.string(),
  stock: z.number(),
  reserved: z.number(),
  availableQuantity: z.number(),
});
export const petSchema = common.extend({
  kind: z.literal('pet'),
  animalType: z.string().nullable(),
  breed: z.string(),
  sex: z.string(),
  birthDate: z.string().nullable(),
  status: z.enum(['available', 'pending', 'reserved', 'sold']),
  photoUrls: z.array(z.string()),
});
export const itemSchema = z.discriminatedUnion('kind', [
  productSchema,
  petSchema,
]);
export const pageSchema = z.object({
  items: z.array(itemSchema),
  page: z.number(),
  pageSize: z.number(),
  total: z.number(),
});
export const categorySchema = z.object({
  id,
  name: z.string(),
  kind: z.enum(['product', 'pet']),
  active: z.boolean(),
  archived: z.boolean(),
  version: z.number(),
});
export const addressSchema = z.object({
  city: z.string(),
  street: z.string(),
  house: z.string(),
  apartment: z.string().nullish(),
  postalCode: z.string(),
});
export const userSchema = z.object({
  id,
  username: z.string(),
  email: z.string(),
  firstName: z.string().nullish(),
  lastName: z.string().nullish(),
  phone: z.string().nullish(),
  address: addressSchema.nullish(),
  userStatus: z.enum(['ACTIVE', 'PENDING', 'BLOCKED']),
  role: z.enum(['USER', 'ADMIN']),
});
export const lineSchema = z.object({
  id,
  kind: z.enum(['product', 'pet']),
  quantity: z.number().int().positive(),
  name: z.string(),
  price: moneyValue.nullable(),
  quotedPrice: moneyValue.nullable(),
  available: z.boolean(),
  reason: z.string().nullable(),
  priceChanged: z.boolean(),
  images: z.array(imageSchema),
});
export const cartSchema = z.object({
  version: z.number().int(),
  lines: z.array(lineSchema),
});
export const deliverySchema = z.object({
  firstName: z.string(),
  lastName: z.string(),
  phone: z.string(),
  address: addressSchema,
});
export const orderSchema = z.object({
  id,
  userId: id,
  version: z.number(),
  status: z.enum([
    'draft',
    'placed',
    'approved',
    'shipped',
    'delivered',
    'cancelled',
    'expired',
  ]),
  paymentStatus: z.enum([
    'NOT_STARTED',
    'NOT_REQUIRED',
    'UNPAID',
    'PAID',
    'REFUNDED',
    'EXPIRED',
  ]),
  total: moneyValue.nullable(),
  createdAt: z.string(),
  paymentExpiresAt: z.string().nullish(),
  delivery: deliverySchema.nullable(),
  lines: z.array(
    z.object({
      itemId: id,
      kind: z.enum(['product', 'pet']),
      name: z.string(),
      quantity: z.number(),
      price: moneyValue.nullable(),
      images: z.array(imageSchema),
    }),
  ),
});
export const paymentSchema = z.object({
  id,
  orderId: id,
  amount: moneyValue,
  status: z.enum(['SUCCEEDED', 'DECLINED', 'REFUNDED']),
  cardLast4: z.string(),
  failureCode: z.string().nullish(),
  createdAt: z.string(),
});
export const guestSchema = z.array(
  z.object({
    id,
    kind: z.enum(['product', 'pet']),
    quantity: z.number().int().positive().max(1000000),
  }),
);
export type Item = z.infer<typeof itemSchema>;
export type Category = z.infer<typeof categorySchema>;
export type User = z.infer<typeof userSchema>;
export type Cart = z.infer<typeof cartSchema>;
export type CartLine = z.infer<typeof lineSchema>;
export type Order = z.infer<typeof orderSchema>;
export type Payment = z.infer<typeof paymentSchema>;
export type ImageRef = z.infer<typeof imageSchema>;
export type Selection = z.infer<typeof guestSchema>;
export type Delivery = z.infer<typeof deliverySchema>;
export const loginSchema = z.object({
  email: z.string().trim().email('Введите корректный email'),
  password: z
    .string()
    .min(6, 'Минимум 6 символов')
    .max(100, 'Не более 100 символов'),
});
const required = (label: string, max: number) =>
  z
    .string()
    .trim()
    .min(1, `Заполните ${label}`)
    .max(max, `Не более ${max} символов`);
export const profileSchema = z.object({
  firstName: required('имя', 50),
  lastName: required('фамилию', 50),
  phone: z
    .string()
    .transform((v) => v.replace(/[\s()-]/g, ''))
    .refine((v) => /^\+7\d{10}$/.test(v), 'Введите +7 и 10 цифр номера'),
  address: z.object({
    city: required('город', 100),
    street: required('улицу', 150),
    house: required('дом', 30),
    apartment: z
      .string()
      .trim()
      .max(30)
      .transform((value) => value || null),
    postalCode: z.string().regex(/^\d{6}$/, 'Индекс должен состоять из 6 цифр'),
  }),
});
export const demoCards = [
  '4242424242424242',
  '4000000000000002',
  '4000000000009995',
] as const;

/** Проверяет тестовые реквизиты и срок действия карты относительно переданной даты. */
export function paymentInputSchema(now = new Date()) {
  return z
    .object({
      cardNumber: z
        .string()
        .transform((v) => v.replace(/\s/g, ''))
        .refine(
          (v) => (demoCards as readonly string[]).includes(v),
          'Выберите тестовую карту из списка',
        ),
      expiryMonth: z.coerce
        .number()
        .int()
        .min(1, 'Месяц от 1 до 12')
        .max(12, 'Месяц от 1 до 12'),
      expiryYear: z.coerce
        .number()
        .int()
        .min(now.getUTCFullYear(), 'Срок действия истёк')
        .max(2200, 'Проверьте год'),
      cvv: z.string().regex(/^\d{3,4}$/, 'Введите 3 или 4 цифры'),
      cardholderName: required('имя владельца', 100),
    })
    .superRefine((v, ctx) => {
      if (
        v.expiryYear === now.getUTCFullYear() &&
        v.expiryMonth < now.getUTCMonth() + 1
      )
        ctx.addIssue({
          code: 'custom',
          path: ['expiryMonth'],
          message: 'Срок действия истёк',
        });
    });
}
export type PaymentInput = z.infer<ReturnType<typeof paymentInputSchema>>;

/** Объединяет позиции; одинаковый питомец остаётся в единственном экземпляре. */
export function mergeSelections(
  account: Selection,
  guest: Selection,
): Selection {
  const values = new Map<string, Selection[number]>();
  for (const line of [...account, ...guest]) {
    const key = `${line.kind}:${line.id}`;
    const quantity =
      line.kind === 'pet'
        ? 1
        : (values.get(key)?.quantity ?? 0) + line.quantity;
    values.set(key, { ...line, quantity });
  }
  return [...values.values()];
}

/** Считает рубли через целые копейки, не накапливая ошибку дробных чисел. */
export function totalOf(
  lines: { price: number | null; quantity: number }[],
): number {
  return (
    lines.reduce(
      (sum, line) => sum + Math.round((line.price ?? 0) * 100) * line.quantity,
      0,
    ) / 100
  );
}

/** Допускает в витрину опубликованные карточки с заполненными данными и фото. */
export function isCatalogCardComplete(item: Item): boolean {
  if (
    item.publicationStatus !== 'PUBLISHED' ||
    !item.name.trim() ||
    !item.description.trim() ||
    !item.categoryId ||
    item.price == null ||
    item.price <= 0 ||
    !item.images.length
  )
    return false;

  if (item.kind === 'pet') return !!item.animalType?.trim();

  if (!item.sku?.trim() || !item.productType || !item.animalTypes.length)
    return false;

  return (
    item.productType !== 'FEED' ||
    (!!item.brand.trim() &&
      !!item.feedForm.trim() &&
      !!item.lifeStages.length &&
      item.netWeightGrams != null &&
      item.netWeightGrams > 0)
  );
}

/** Возвращает причину недоступности позиции для выбранного количества. */
export function availability(item: Item, quantity = 1): string | null {
  if (item.publicationStatus !== 'PUBLISHED' || item.price == null)
    return 'Недоступно';
  if (item.kind === 'pet')
    return item.status === 'available' && quantity === 1
      ? null
      : 'Питомец недоступен';
  return item.availableQuantity >= quantity ? null : 'Недостаточно в наличии';
}

/** Превращает выбранные позиции в строки гостевой корзины по свежему каталогу. */
export function guestLines(selection: Selection, items: Item[]): CartLine[] {
  return selection.map((line) => {
    const item = items.find((v) => v.id === line.id && v.kind === line.kind);
    const reason = item
      ? availability(item, line.quantity)
      : 'Позиция недоступна';
    return {
      ...line,
      name: item?.name ?? 'Недоступная позиция',
      price: item?.price ?? null,
      quotedPrice: item?.price ?? null,
      priceChanged: false,
      available: !reason,
      reason,
      images: item?.images ?? [],
    };
  });
}

/** Подготавливает поля формы, сохраняя вложенную структуру адреса API. */
export function profileOf(user: User): Delivery {
  return {
    firstName: user.firstName ?? '',
    lastName: user.lastName ?? '',
    phone: user.phone ?? '',
    address: {
      city: user.address?.city ?? '',
      street: user.address?.street ?? '',
      house: user.address?.house ?? '',
      apartment: user.address?.apartment ?? '',
      postalCode: user.address?.postalCode ?? '',
    },
  };
}
export const orderLabels: Record<Order['status'], string> = {
  draft: 'Черновик',
  placed: 'Оформлен',
  approved: 'Подтверждён',
  shipped: 'В пути',
  delivered: 'Доставлен',
  cancelled: 'Отменён',
  expired: 'Резерв истёк',
};
export const paymentLabels: Record<Order['paymentStatus'], string> = {
  NOT_STARTED: 'Не оформлен',
  NOT_REQUIRED: 'Оплата не требуется',
  UNPAID: 'Ожидает оплаты',
  PAID: 'Оплачен',
  REFUNDED: 'Возврат выполнен',
  EXPIRED: 'Время оплаты истекло',
};
