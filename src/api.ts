import * as Crypto from 'expo-crypto';
import { z } from 'zod';
import {
  cartSchema,
  categorySchema,
  itemSchema,
  orderSchema,
  pageSchema,
  paymentSchema,
  userSchema,
  type Cart,
  type Delivery,
  type Item,
  type PaymentInput,
  type Selection,
} from './domain';
import { ApiError } from './errors';

export const defaultApiUrl =
  process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://10.0.2.2:8080/api/v3';
let baseUrl = defaultApiUrl;
let accessToken: string | null = null;
let onExpired: (() => void) | undefined;

/** Проверяет HTTP-адрес API и убирает завершающий слеш. */
export function normalizeApiUrl(value: string): string {
  const url = new URL(value.trim());
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname.replace(/\/$/, '') !== '/api/v3'
  )
    throw new Error('Введите адрес, заканчивающийся на /api/v3');
  return url.toString().replace(/\/$/, '');
}

/** Меняет адрес и текущую сессию; callback сообщает об истечении авторизации. */
export function configureApi(
  url: string,
  token: string | null,
  expired?: () => void,
): void {
  baseUrl = normalizeApiUrl(url);
  accessToken = token;
  onExpired = expired;
}
export const apiUrl = () => baseUrl;
export const newKey = () => Crypto.randomUUID();
export const mediaSource = (mediaId: string, thumb = false) => ({
  uri: `${baseUrl}/media/${mediaId}/${thumb ? 'thumb' : 'image'}`,
  ...(accessToken
    ? { headers: { Authorization: `Bearer ${accessToken}` } }
    : {}),
});

/** Отправляет ограниченный по времени запрос с JWT и ключом повторной операции. */
export async function request(
  path: string,
  options: {
    method?: string;
    body?: unknown;
    key?: string;
    anonymous?: boolean;
  } = {},
): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  const requestId = newKey();
  const sentToken = accessToken,
    sentUrl = baseUrl;
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'X-Request-ID': requestId,
  };
  if (accessToken && !options.anonymous)
    headers.Authorization = `Bearer ${accessToken}`;
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (options.key) headers['Idempotency-Key'] = options.key;
  try {
    const response = await fetch(`${sentUrl}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body:
        options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: controller.signal,
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as {
        error?: unknown;
      } | null;
      if (
        response.status === 401 &&
        !options.anonymous &&
        sentToken === accessToken &&
        sentUrl === baseUrl
      )
        onExpired?.();
      throw new ApiError(
        typeof body?.error === 'string' ? body.error : 'SERVICE_UNAVAILABLE',
        response.status,
        response.headers.get('X-Request-ID') ?? requestId,
      );
    }
    if (response.status === 204) return undefined;
    const text = await response.text();
    if (!text.trim()) return undefined;
    try {
      return JSON.parse(text);
    } catch {
      throw new ApiError('API_CONTRACT_MISMATCH', 502, requestId);
    }
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError('SERVICE_UNAVAILABLE', 0, requestId);
  } finally {
    clearTimeout(timeout);
  }
}

/** Проверяет полученный JSON против контракта покупателя. */
function decode<S extends z.ZodTypeAny>(
  schema: S,
  value: unknown,
): z.output<S> {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new ApiError('API_CONTRACT_MISMATCH', 502);
  return parsed.data;
}

/** Загружает все страницы одного небольшого учебного каталога. */
async function allCards(path: string): Promise<Item[]> {
  const items: Item[] = [];
  for (let page = 1; ; page++) {
    const value = decode(
      pageSchema,
      await request(`${path}?page=${page}&pageSize=100`),
    );
    items.push(...value.items);
    if (!value.items.length || page * value.pageSize >= value.total)
      return items;
  }
}
export const api = {
  health: () => request('/health', { anonymous: true }),
  catalog: async () =>
    (
      await Promise.all([allCards('/products'), allCards('/catalog/pets')])
    ).flat(),
  categories: async () =>
    decode(z.array(categorySchema), await request('/catalog/categories')),
  item: async (kind: 'product' | 'pet', id: string) =>
    decode(
      itemSchema,
      await request(
        `${kind === 'product' ? '/products' : '/catalog/pets'}/${encodeURIComponent(id)}`,
      ),
    ),
  login: async (email: string, password: string) =>
    decode(
      z.object({ access_token: z.string().min(1), user: userSchema }),
      await request('/auth/login', {
        method: 'POST',
        body: { email, password },
        anonymous: true,
      }),
    ),
  me: async () => decode(userSchema, await request('/user/me')),
  profile: async (value: Delivery) =>
    decode(
      userSchema,
      await request('/user/me', { method: 'PUT', body: value }),
    ),
  cart: async () => decode(cartSchema, await request('/store/cart')),
  saveCart: async (
    version: number,
    lines: Selection,
    key?: string,
  ): Promise<Cart> =>
    decode(
      cartSchema,
      await request('/store/cart', {
        method: 'PUT',
        body: {
          version,
          lines: lines.map(({ id, kind, quantity }) => ({
            id,
            kind,
            quantity,
          })),
        },
        key,
      }),
    ),
  orders: async () =>
    decode(z.array(orderSchema), await request('/store/orders')),
  order: async (id: string) =>
    decode(
      orderSchema,
      await request(`/store/orders/${encodeURIComponent(id)}`),
    ),
  createDraft: async (cartVersion: number, key: string) =>
    decode(
      orderSchema,
      await request('/store/orders', {
        method: 'POST',
        body: { cartVersion },
        key,
      }),
    ),
  place: async (id: string, version: number, key: string) =>
    decode(
      orderSchema,
      await request(`/store/orders/${id}/place`, {
        method: 'POST',
        body: { version },
        key,
      }),
    ),
  deleteDraft: (id: string) =>
    request(`/store/orders/${id}`, { method: 'DELETE' }),
  cancel: (id: string, version: number) =>
    request(`/store/orders/${id}/cancel`, {
      method: 'POST',
      body: { version },
    }),
  payments: async (id: string) =>
    decode(
      z.array(paymentSchema),
      await request(`/store/orders/${id}/payments`),
    ),
  pay: (id: string, input: PaymentInput, key: string) =>
    request(`/store/orders/${id}/payments`, {
      method: 'POST',
      body: input,
      key,
    }),
};
