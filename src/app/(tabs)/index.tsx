import { useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api';
import { availability, isCatalogCardComplete, type Item } from '../../domain';
import { useStore } from '../../store';
import { BrandLogo } from '../../components/Brand';
import {
  Button,
  Chip,
  colors,
  Empty,
  Field,
  Loading,
  money,
  Page,
  Photo,
  styles,
} from '../../ui';

/** Отображает нативный каталог с поиском, категориями и фильтрами. */
export default function CatalogScreen() {
  const store = useStore();
  const [search, setSearch] = useState(''),
    [kind, setKind] = useState('all'),
    [animal, setAnimal] = useState('all'),
    [category, setCategory] = useState('all'),
    [availableOnly, setAvailableOnly] = useState(false),
    [sort, setSort] = useState(false);
  const categories = useQuery({
    queryKey: ['categories', store.server],
    queryFn: api.categories,
  });
  const data = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('ru');
    const result = store.items.filter(
      (item) =>
        isCatalogCardComplete(item) &&
        (kind === 'all' || item.kind === kind) &&
        (category === 'all' || item.categoryId === category) &&
        (animal === 'all' ||
          (item.kind === 'pet'
            ? item.animalType === animal
            : item.animalTypes.includes(animal))) &&
        (!availableOnly || !availability(item)) &&
        (!query ||
          `${item.name} ${item.description} ${item.kind === 'pet' ? item.breed : item.brand}`
            .toLocaleLowerCase('ru')
            .includes(query)),
    );
    return sort
      ? result.sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity))
      : result;
  }, [store.items, search, kind, animal, category, availableOnly, sort]);

  /** Добавляет одну доступную позицию, сохраняя актуальную корзину. */
  function add(item: Item) {
    const quantity =
      store.lines.find((line) => line.id === item.id)?.quantity ?? 0;
    void store
      .setLine(item, quantity + 1)
      .then(() => store.notify('Добавлено в корзину'))
      .catch(store.report);
  }
  const header = (
    <View style={{ gap: 17, marginBottom: 18 }}>
      <View
        style={{
          backgroundColor: colors.accent,
          borderRadius: 25,
          padding: 16,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <BrandLogo size={104} />
        <View style={{ flex: 1, gap: 8 }}>
          <Text
            style={{
              color: colors.bg,
              fontSize: 22,
              lineHeight: 26,
              fontWeight: '700',
            }}
          >
            Всё для тех, кого любят
          </Text>
          <Text style={[styles.muted, { color: colors.bg }]}>
            Товары для питомцев и друзья, которые ждут свой дом.
          </Text>
        </View>
      </View>
      <Field
        testID="catalog-search"
        label="Найти в каталоге"
        placeholder="Корм, игрушка или питомец"
        value={search}
        onChangeText={setSearch}
        returnKeyType="search"
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8 }}
      >
        {[
          ['all', 'Всё'],
          ['product', 'Товары'],
          ['pet', 'Питомцы'],
        ].map(([value, title]) => (
          <Chip
            key={value}
            selected={kind === value}
            onPress={() => {
              setKind(value);
              setCategory('all');
            }}
            testID={`filter-${value}`}
          >
            {title}
          </Chip>
        ))}
      </ScrollView>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8 }}
      >
        {[
          ['all', 'Все животные'],
          ['cat', 'Кошки'],
          ['dog', 'Собаки'],
        ].map(([value, title]) => (
          <Chip
            key={value}
            selected={animal === value}
            onPress={() => setAnimal(value)}
          >
            {title}
          </Chip>
        ))}
      </ScrollView>
      {!!categories.data?.length && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8 }}
        >
          <Chip
            selected={category === 'all'}
            onPress={() => setCategory('all')}
          >
            Все категории
          </Chip>
          {categories.data
            .filter(
              (v) =>
                v.active && !v.archived && (kind === 'all' || v.kind === kind),
            )
            .map((v) => (
              <Chip
                key={v.id}
                selected={category === v.id}
                onPress={() => setCategory(v.id)}
              >
                {v.name}
              </Chip>
            ))}
        </ScrollView>
      )}
      <View style={styles.between}>
        <Chip
          selected={availableOnly}
          onPress={() => setAvailableOnly(!availableOnly)}
        >
          В наличии
        </Chip>
        <Chip selected={sort} onPress={() => setSort(!sort)}>
          Сначала дешевле
        </Chip>
      </View>
      <Text style={styles.muted}>{data.length} в каталоге</Text>
    </View>
  );
  return (
    <Page scroll={false}>
      <FlatList
        testID="catalog-items"
        data={data}
        numColumns={2}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 18, paddingBottom: 30 }}
        columnWrapperStyle={{ gap: 12 }}
        ListHeaderComponent={header}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        refreshing={store.catalogLoading && !!store.items.length}
        onRefresh={() => {
          void store.refresh();
        }}
        ListEmptyComponent={
          store.catalogLoading ? (
            <Loading />
          ) : store.catalogError ? (
            <Empty
              title="Магазин недоступен"
              error={store.catalogError}
              onRetry={() => {
                void store.refresh();
              }}
              action="Настроить подключение"
              onAction={() => router.push('/connection')}
            />
          ) : (
            <Empty
              title="Ничего не найдено"
              description="Попробуйте другой запрос или измените фильтры."
            />
          )
        }
        renderItem={({ item }) => (
          <View
            testID="catalog-item-card"
            style={[
              styles.card,
              {
                flex: 1,
                maxWidth: '49%',
                padding: 10,
                marginBottom: 12,
                gap: 9,
              },
            ]}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Открыть ${item.name}`}
              testID="catalog-item-open"
              onPress={() =>
                router.push({
                  pathname: '/item/[id]',
                  params: { id: item.id, kind: item.kind },
                })
              }
            >
              <Photo image={item.images[0]} thumb />
              <Text
                testID="catalog-item-name"
                numberOfLines={2}
                style={{
                  fontSize: 15,
                  color: colors.ink,
                  fontWeight: '600',
                  marginTop: 10,
                  minHeight: 39,
                }}
              >
                {item.name}
              </Text>
              <Text numberOfLines={1} style={styles.muted}>
                {item.kind === 'pet'
                  ? item.breed || 'Питомец'
                  : item.brand || 'Для вашего друга'}
              </Text>
            </Pressable>
            <Text style={[styles.price, { fontSize: 18 }]}>
              {money(item.price)}
            </Text>
            <Button
              testID="catalog-item-add"
              disabled={
                store.busy ||
                store.mergePending ||
                !!availability(item) ||
                (item.kind === 'pet' &&
                  store.lines.some((v) => v.id === item.id))
              }
              onPress={() => add(item)}
            >
              {availability(item)
                ? 'Недоступно'
                : item.kind === 'pet' &&
                    store.lines.some((v) => v.id === item.id)
                  ? 'В корзине'
                  : 'В корзину'}
            </Button>
          </View>
        )}
      />
    </Page>
  );
}
