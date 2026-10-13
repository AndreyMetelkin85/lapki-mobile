import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { AppState } from 'react-native';
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { focusManager, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import {
  api,
  apiUrl,
  configureApi,
  defaultApiUrl,
  newKey,
  normalizeApiUrl,
} from './api';
import {
  availability,
  guestLines,
  guestSchema,
  mergeSelections,
  type CartLine,
  type Item,
  type Selection,
  type User,
} from './domain';
import { ApiError } from './errors';
import { operationStore } from './storage';

const tokenKey = 'lapki.android.token';
const serverKey = 'lapki.android.server';
const mergeSchema = z.object({
  key: z.string().uuid(),
  version: z.number(),
  lines: guestSchema,
  guest: guestSchema,
});
type Store = {
  ready: boolean;
  session: string | null;
  user: User | null;
  authLoading: boolean;
  authError: unknown;
  items: Item[];
  catalogLoading: boolean;
  catalogError: unknown;
  lines: CartLine[];
  cartError: unknown;
  busy: boolean;
  mergePending: boolean;
  server: string;
  notice: string;
  error: unknown;
  dismissError: () => void;
  report: (e: unknown) => void;
  notify: (message: string) => void;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setServer: (url: string) => Promise<void>;
  merge: () => Promise<void>;
  setLine: (item: Pick<Item, 'id' | 'kind'>, quantity: number) => Promise<void>;
  refresh: () => Promise<void>;
};
const Context = createContext<Store | null>(null);

/** Возвращает состояние магазина в компоненте мобильного клиента. */
export function useStore(): Store {
  const value = useContext(Context);
  if (!value) throw new Error('StoreProvider missing');
  return value;
}

/** Управляет сессией, гостевой корзиной и синхронизацией с настоящим API. */
export function StoreProvider({ children }: { children: ReactNode }) {
  const client = useQueryClient();
  const [ready, setReady] = useState(false),
    [session, setSession] = useState<string | null>(null);
  const [server, setServerState] = useState(defaultApiUrl),
    [guest, setGuest] = useState<Selection>([]);
  const [busy, setBusy] = useState(false),
    [mergePending, setMergePending] = useState(false);
  const [notice, setNotice] = useState(''),
    [error, setError] = useState<unknown>(null);
  const locked = useRef(false),
    guestRef = useRef<Selection>([]);
  const me = useQuery({
    queryKey: ['me', session],
    queryFn: api.me,
    enabled: ready && !!session,
    retry: false,
  });
  const catalog = useQuery({
    queryKey: ['catalog', server],
    queryFn: api.catalog,
    enabled: ready,
    retry: false,
  });
  const user = me.data ?? null;
  const cart = useQuery({
    queryKey: ['cart', user?.id, server],
    queryFn: api.cart,
    enabled: ready && !!user,
    retry: false,
  });
  const guestKey = () => `lapki.guest.${apiUrl()}`;

  /** Удаляет истёкшую сессию и кеш личных данных, не стирая гостевые позиции. */
  function expire() {
    configureApi(apiUrl(), null, expire);
    setSession(null);
    setMergePending(false);
    void SecureStore.deleteItemAsync(tokenKey).catch(() => undefined);
    client.removeQueries({
      predicate: (q) =>
        ['me', 'cart', 'orders', 'order', 'payments'].includes(
          String(q.queryKey[0]),
        ),
    });
    setNotice('Сессия истекла. Войдите снова.');
  }
  useEffect(() => {
    let active = true;
    void (async () => {
      const url = normalizeApiUrl(
        (await AsyncStorage.getItem(serverKey)) ?? defaultApiUrl,
      );
      const token = await SecureStore.getItemAsync(tokenKey);
      configureApi(url, token, expire);
      const raw = await AsyncStorage.getItem(`lapki.guest.${url}`);
      let values: Selection = [];
      try {
        const parsed = guestSchema.safeParse(JSON.parse(raw ?? '[]'));
        if (parsed.success) values = parsed.data;
      } catch {
        /* Восстанавливаем пустую корзину при повреждённом JSON. */
      }
      if (active) {
        guestRef.current = values;
        setGuest(values);
        setServerState(url);
        setSession(token);
        setReady(true);
      }
    })().catch((e) => {
      if (active) {
        configureApi(defaultApiUrl, null, expire);
        setReady(true);
        setError(e);
      }
    });
    const subscription = AppState.addEventListener('change', (state) =>
      focusManager.setFocused(state === 'active'),
    );
    return () => {
      active = false;
      subscription.remove();
    };
    // Начальная конфигурация считывается один раз до запросов React Query.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(''), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  /** Сохраняет гостевые позиции до их отображения и изменения серверной корзины. */
  async function saveGuest(values: Selection) {
    try {
      await AsyncStorage.setItem(guestKey(), JSON.stringify(values));
    } catch {
      throw new ApiError('STORAGE_UNAVAILABLE');
    }
    guestRef.current = values;
    setGuest(values);
  }

  /** Завершает объединение с тем же ключом после неопределённого сетевого результата. */
  async function mergeFor(actor: User) {
    const storage = operationStore('merge', actor.id, mergeSchema);
    let pending = await storage.read();
    if (!pending && !guestRef.current.length) {
      setMergePending(false);
      return;
    }
    setMergePending(true);
    if (!pending) {
      const current = await api.cart();
      pending = {
        key: newKey(),
        version: current.version,
        lines: mergeSelections(current.lines, guestRef.current),
        guest: guestRef.current,
      };
      await storage.write(pending);
    }
    try {
      const result = await api.saveCart(
        pending.version,
        pending.lines,
        pending.key,
      );
      await saveGuest(
        guestRef.current
          .map((line) => ({
            ...line,
            quantity: Math.max(
              0,
              line.quantity -
                (pending.guest.find(
                  (p) => p.id === line.id && p.kind === line.kind,
                )?.quantity ?? 0),
            ),
          }))
          .filter((line) => line.quantity > 0),
      );
      await storage.clear();
      client.setQueryData(['cart', actor.id, server], result);
      setMergePending(false);
    } catch (e) {
      if (e instanceof ApiError && e.code === 'CART_VERSION_CONFLICT')
        await storage.clear();
      throw e;
    }
  }
  useEffect(() => {
    if (!user) return;
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    void mergeFor(user)
      .catch(setError)
      .finally(() => {
        locked.current = false;
        setBusy(false);
      });
    // Объединение выполняется один раз при смене аккаунта; повтор — явной кнопкой.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, server]);

  /** Входит через API и сохраняет только JWT в защищённое хранилище. */
  async function login(email: string, password: string) {
    const result = await api.login(email.trim(), password);
    await SecureStore.setItemAsync(tokenKey, result.access_token);
    configureApi(server, result.access_token, expire);
    client.setQueryData(['me', result.access_token], result.user);
    setSession(result.access_token);
    setNotice('Вы вошли в аккаунт');
  }

  /** Завершает локальную сессию; серверные заказы и корзина остаются в аккаунте. */
  async function logout() {
    if (locked.current) return;
    await SecureStore.deleteItemAsync(tokenKey);
    configureApi(server, null, expire);
    setSession(null);
    setMergePending(false);
    client.clear();
  }

  /** Переключает сервер, отделяя авторизацию и гостевые позиции разных стендов. */
  async function setServer(url: string) {
    if (locked.current) throw new ApiError('MERGE_PENDING');
    const next = normalizeApiUrl(url);
    await logout();
    await AsyncStorage.setItem(serverKey, next);
    const raw = await AsyncStorage.getItem(`lapki.guest.${next}`);
    let values: Selection = [];
    try {
      values = guestSchema.parse(JSON.parse(raw ?? '[]'));
    } catch {
      /* Другой сервер начинает с пустой гостевой корзины. */
    }
    configureApi(next, null, expire);
    guestRef.current = values;
    setGuest(values);
    setServerState(next);
    client.clear();
  }

  /** Меняет количество по версии корзины, не допускает одновременных замен. */
  async function setLine(item: Pick<Item, 'id' | 'kind'>, quantity: number) {
    if (locked.current) return;
    if (mergePending) throw new ApiError('MERGE_PENDING');
    if (!Number.isInteger(quantity) || quantity < 0 || quantity > 1000000)
      throw new ApiError('VALIDATION_ERROR', 422);
    locked.current = true;
    setBusy(true);
    try {
      const base = user
        ? await api.cart()
        : { version: 1, lines: guestRef.current };
      const before =
        base.lines.find(
          (line) => line.id === item.id && line.kind === item.kind,
        )?.quantity ?? 0;
      const card = catalog.data?.find(
        (v) => v.id === item.id && v.kind === item.kind,
      );
      if (item.kind === 'pet' && quantity > 0) quantity = 1;
      if (quantity > before && card && availability(card, quantity))
        throw new ApiError('INSUFFICIENT_STOCK', 409);
      const next: Selection = base.lines
        .filter((line) => line.id !== item.id || line.kind !== item.kind)
        .map(({ id, kind, quantity }) => ({ id, kind, quantity }));
      if (quantity) next.push({ id: item.id, kind: item.kind, quantity });
      if (user)
        client.setQueryData(
          ['cart', user.id, server],
          await api.saveCart(base.version, next),
        );
      else await saveGuest(next);
    } catch (e) {
      if (user) await client.invalidateQueries({ queryKey: ['cart', user.id] });
      throw e;
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  async function merge() {
    if (!user || locked.current) return;
    locked.current = true;
    setBusy(true);
    try {
      await mergeFor(user);
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  const value: Store = {
    ready,
    session,
    user,
    authLoading: !!session && me.isPending,
    authError: me.error,
    items: catalog.data ?? [],
    catalogLoading: !ready || catalog.isPending,
    catalogError: catalog.error,
    lines: user
      ? (cart.data?.lines ?? [])
      : guestLines(guest, catalog.data ?? []),
    cartError: user ? cart.error : null,
    busy: busy || (!!user && cart.isPending),
    mergePending,
    server,
    notice,
    error,
    dismissError: () => setError(null),
    report: setError,
    notify: setNotice,
    login,
    logout,
    setServer,
    merge,
    setLine,
    refresh: async () => {
      await client.invalidateQueries();
    },
  };
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
