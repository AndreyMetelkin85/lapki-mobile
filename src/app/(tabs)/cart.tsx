import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { totalOf, type CartLine } from '../../domain';
import { useStore } from '../../store';
import {
  Button,
  colors,
  Empty,
  Loading,
  money,
  Page,
  Photo,
  styles,
} from '../../ui';

/** Отображает гостевую либо серверную корзину и доступность её позиций. */
export default function CartScreen() {
  const store = useStore();
  const update = (line: CartLine, quantity: number) => {
    void store.setLine(line, quantity).catch(store.report);
  };
  return (
    <Page>
      <Text style={styles.title}>Ваш выбор</Text>
      <Text style={styles.muted}>
        {store.user
          ? 'Корзина сохранена в аккаунте.'
          : 'Можно выбрать товары сейчас, а войти при оформлении.'}
      </Text>
      {store.authLoading || (store.busy && !store.lines.length) ? (
        <Loading />
      ) : store.cartError ? (
        <Empty
          title="Не удалось загрузить корзину"
          error={store.cartError}
          onRetry={() => {
            void store.refresh();
          }}
        />
      ) : !store.lines.length ? (
        <Empty
          title="Здесь пока пусто"
          description="Найдём что-нибудь для вашего друга?"
          action="Открыть каталог"
          onAction={() => router.navigate('/')}
        />
      ) : (
        <>
          {store.mergePending && (
            <View style={styles.card}>
              <Text style={styles.text}>
                Нужно завершить объединение гостевой корзины с аккаунтом.
              </Text>
              <Button
                secondary
                loading={store.busy}
                onPress={() => {
                  void store.merge().catch(store.report);
                }}
              >
                Объединить корзину
              </Button>
            </View>
          )}
          {store.lines.map((line) => (
            <View
              key={`${line.kind}:${line.id}`}
              testID="cart-item"
              style={styles.card}
            >
              <View style={styles.row}>
                <Photo
                  image={line.images[0]}
                  thumb
                  style={{ width: 80, height: 80 }}
                />
                <View style={{ flex: 1, gap: 5 }}>
                  <Text
                    testID="cart-item-name"
                    style={{
                      fontWeight: '700',
                      fontSize: 16,
                      color: colors.ink,
                    }}
                  >
                    {line.name}
                  </Text>
                  <Text style={styles.muted}>{money(line.price)} за шт.</Text>
                  {!line.available && (
                    <Text style={styles.error}>
                      Позиция недоступна. Удалите её перед оформлением.
                    </Text>
                  )}
                  {line.priceChanged && (
                    <Text style={styles.error}>Цена обновилась</Text>
                  )}
                </View>
              </View>
              <View style={styles.between}>
                <View style={styles.row}>
                  <Pressable
                    testID="cart-item-decrement"
                    accessibilityRole="button"
                    accessibilityLabel={`Уменьшить количество ${line.name}`}
                    disabled={store.busy || store.mergePending}
                    onPress={() => update(line, line.quantity - 1)}
                    style={styles.smallButton}
                  >
                    <Ionicons name="remove" size={18} color={colors.accent} />
                  </Pressable>
                  <Text testID="cart-item-quantity" style={styles.text}>
                    {line.quantity}
                  </Text>
                  <Pressable
                    testID="cart-item-increment"
                    accessibilityRole="button"
                    accessibilityLabel={`Увеличить количество ${line.name}`}
                    disabled={
                      store.busy || store.mergePending || line.kind === 'pet'
                    }
                    onPress={() => update(line, line.quantity + 1)}
                    style={[
                      styles.smallButton,
                      line.kind === 'pet' ? { opacity: 0.3 } : null,
                    ]}
                  >
                    <Ionicons name="add" size={18} color={colors.accent} />
                  </Pressable>
                </View>
                <Text style={styles.price}>
                  {money((line.price ?? 0) * line.quantity)}
                </Text>
                <Pressable
                  testID="cart-item-remove"
                  accessibilityRole="button"
                  accessibilityLabel={`Удалить ${line.name}`}
                  disabled={store.busy || store.mergePending}
                  onPress={() => update(line, 0)}
                  style={styles.smallButton}
                >
                  <Ionicons
                    name="trash-outline"
                    color={colors.danger}
                    size={18}
                  />
                </Pressable>
              </View>
            </View>
          ))}
          <View style={styles.card}>
            <View style={styles.between}>
              <Text style={styles.heading}>Итого</Text>
              <Text testID="cart-total" style={styles.price}>
                {money(totalOf(store.lines))}
              </Text>
            </View>
            <Button
              testID="cart-checkout"
              disabled={
                store.busy ||
                store.mergePending ||
                store.lines.some((line) => !line.available)
              }
              onPress={() =>
                store.user
                  ? router.push('/checkout')
                  : router.push({
                      pathname: '/login',
                      params: { next: 'checkout' },
                    })
              }
            >
              {store.user ? 'Перейти к оформлению' : 'Войти и оформить'}
            </Button>
          </View>
        </>
      )}
    </Page>
  );
}
