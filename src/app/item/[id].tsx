import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api';
import { availability } from '../../domain';
import { useStore } from '../../store';
import { Button, Empty, Loading, money, Page, Photo, styles } from '../../ui';

/** Отображает нативную галерею и подробную карточку товара либо питомца. */
export default function ItemScreen() {
  const { id, kind } = useLocalSearchParams<{ id: string; kind?: string }>(),
    store = useStore();
  const [selected, setSelected] = useState(0);
  const query = useQuery({
    queryKey: ['item', store.server, kind, id],
    queryFn: () => api.item(kind === 'pet' ? 'pet' : 'product', id),
  });
  const item = query.data;
  if (query.isPending)
    return (
      <Page>
        <Loading />
      </Page>
    );
  if (!item)
    return (
      <Page>
        <Empty
          title="Карточка недоступна"
          error={query.error}
          onRetry={() => {
            void query.refetch();
          }}
        />
      </Page>
    );
  const count = store.lines.find((line) => line.id === item.id)?.quantity ?? 0;
  return (
    <Page>
      <Photo
        key={item.images[selected]?.mediaId ?? item.id}
        image={item.images[selected]}
      />
      {item.images.length > 1 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 10 }}
        >
          {item.images.map((image, index) => (
            <Pressable
              key={image.mediaId}
              accessibilityRole="button"
              accessibilityLabel={`Фото ${index + 1}`}
              accessibilityState={{ selected: selected === index }}
              onPress={() => setSelected(index)}
            >
              <Photo
                image={image}
                thumb
                style={{
                  width: 68,
                  height: 68,
                  opacity: selected === index ? 1 : 0.55,
                }}
              />
            </Pressable>
          ))}
        </ScrollView>
      )}
      <Text testID="item-name" style={styles.title}>
        {item.name}
      </Text>
      <Text style={styles.price}>{money(item.price)}</Text>
      <Text style={styles.text}>{item.description}</Text>
      <View style={styles.card}>
        <Text style={styles.heading}>Подробнее</Text>
        {item.kind === 'product' ? (
          <>
            <Text style={styles.text}>Бренд: {item.brand || '—'}</Text>
            {!!item.netWeightGrams && (
              <Text style={styles.text}>Вес: {item.netWeightGrams} г</Text>
            )}
            {!!item.ingredients && (
              <Text style={styles.text}>Состав: {item.ingredients}</Text>
            )}
            <Text style={styles.muted}>
              {item.availableQuantity > 0
                ? `В наличии: ${item.availableQuantity}`
                : 'Нет в наличии'}
            </Text>
          </>
        ) : (
          <>
            <Text style={styles.text}>
              Порода: {item.breed || 'Не указана'}
            </Text>
            <Text style={styles.text}>
              Пол:{' '}
              {item.sex === 'MALE'
                ? 'Мальчик'
                : item.sex === 'FEMALE'
                  ? 'Девочка'
                  : 'Не указан'}
            </Text>
            {item.birthDate && (
              <Text style={styles.text}>
                Дата рождения:{' '}
                {new Date(item.birthDate).toLocaleDateString('ru-RU')}
              </Text>
            )}
            <Text style={styles.muted}>
              {availability(item) ?? 'Ждёт свой дом'}
            </Text>
          </>
        )}
      </View>
      <Button
        testID="item-add"
        disabled={
          store.busy ||
          store.mergePending ||
          !!availability(item) ||
          (item.kind === 'pet' && count > 0)
        }
        onPress={() => {
          void store
            .setLine(item, count + 1)
            .then(() => store.notify('Добавлено в корзину'))
            .catch(store.report);
        }}
      >
        {count > 0 && item.kind === 'pet'
          ? 'Уже в корзине'
          : availability(item)
            ? 'Недоступно'
            : 'Добавить в корзину'}
      </Button>
      {count > 0 && (
        <Button secondary onPress={() => router.navigate('/(tabs)/cart')}>
          Открыть корзину
        </Button>
      )}
    </Page>
  );
}
