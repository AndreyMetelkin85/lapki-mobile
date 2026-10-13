import { Ionicons } from '@expo/vector-icons';
import { useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type ImageStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { mediaSource } from './api';
import { ApiError, errorMessage } from './errors';
import { useStore } from './store';
import type { ImageRef } from './domain';

export const colors = {
  bg: '#F7F5EF',
  card: '#FFFFFF',
  ink: '#243C31',
  muted: '#778078',
  accent: '#315E48',
  pale: '#E8EFE7',
  line: '#E1E6DD',
  warm: '#E9D6B7',
  danger: '#A74336',
};
export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 20, gap: 18, paddingBottom: 32 },
  title: {
    fontSize: 30,
    fontWeight: '700',
    color: colors.ink,
    letterSpacing: -0.8,
  },
  heading: { fontSize: 20, fontWeight: '700', color: colors.ink },
  text: { fontSize: 15, lineHeight: 23, color: colors.ink },
  muted: { fontSize: 14, lineHeight: 21, color: colors.muted },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  between: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  card: {
    backgroundColor: colors.card,
    padding: 18,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.line,
    gap: 12,
  },
  price: { fontSize: 21, fontWeight: '700', color: colors.ink },
  pill: {
    backgroundColor: colors.pale,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  label: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 7,
  },
  input: {
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.ink,
    fontSize: 16,
  },
  error: { color: colors.danger, fontSize: 13, marginTop: 6 },
  divider: { height: 1, backgroundColor: colors.line },
  smallButton: {
    padding: 10,
    minWidth: 42,
    minHeight: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.pale,
  },
});

/** Форматирует рубли и копейки для русскоязычного интерфейса. */
export function money(value: number | null): string {
  return value == null
    ? 'Цена не указана'
    : new Intl.NumberFormat('ru-RU', {
        style: 'currency',
        currency: 'RUB',
        maximumFractionDigits: 2,
      }).format(value);
}

/** Отображает прокручиваемый экран с отступами и поддержкой системной клавиатуры. */
export function Page({
  children,
  scroll = true,
}: {
  children: ReactNode;
  scroll?: boolean;
}) {
  return (
    <SafeAreaView style={styles.screen} edges={['bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {scroll ? (
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          >
            {children}
          </ScrollView>
        ) : (
          children
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/** Отображает нативную кнопку с состояниями загрузки и недоступности. */
export function Button({
  children,
  onPress,
  loading,
  disabled,
  secondary = false,
  testID,
  danger = false,
}: {
  children: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  secondary?: boolean;
  testID?: string;
  danger?: boolean;
}) {
  const bg = secondary ? colors.pale : danger ? colors.danger : colors.accent;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={children}
      accessibilityState={{
        disabled: !!disabled || !!loading,
        busy: !!loading,
      }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: bg,
        opacity: disabled || loading ? 0.5 : pressed ? 0.8 : 1,
        minHeight: 50,
        paddingHorizontal: 18,
        paddingVertical: 12,
        borderRadius: 15,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: 10,
      })}
    >
      {loading && (
        <ActivityIndicator
          color={secondary ? colors.accent : '#fff'}
          size="small"
        />
      )}
      <Text
        style={{
          color: secondary ? colors.accent : '#fff',
          fontSize: 15,
          fontWeight: '700',
        }}
      >
        {children}
      </Text>
    </Pressable>
  );
}

/** Отображает подписанное поле ввода с понятной ошибкой валидации. */
export function Field({
  label,
  error,
  ...props
}: TextInputProps & { label: string; error?: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.muted}
        autoCorrect={false}
        {...props}
        style={[
          styles.input,
          error ? { borderColor: colors.danger } : null,
          props.style,
        ]}
      />
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

/** Отображает выбираемый фильтр или небольшое действие. */
export function Chip({
  children,
  selected,
  onPress,
  testID,
}: {
  children: string;
  selected?: boolean;
  onPress: () => void;
  testID?: string;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      onPress={onPress}
      style={{
        paddingHorizontal: 15,
        paddingVertical: 10,
        borderRadius: 22,
        backgroundColor: selected ? colors.accent : colors.card,
        borderWidth: 1,
        borderColor: selected ? colors.accent : colors.line,
      }}
    >
      <Text
        style={{
          fontSize: 13,
          color: selected ? '#fff' : colors.ink,
          fontWeight: '600',
        }}
      >
        {children}
      </Text>
    </Pressable>
  );
}

/** Загружает публичное или защищённое изображение нативным компонентом Image. */
export function Photo({
  image,
  thumb = false,
  style,
}: {
  image?: ImageRef;
  thumb?: boolean;
  style?: ImageStyle;
}) {
  const [brokenUri, setBrokenUri] = useState<string | null>(null);
  const source = image ? mediaSource(image.mediaId, thumb) : null;
  if (!image || !source || brokenUri === source.uri)
    return (
      <View
        style={[
          {
            backgroundColor: colors.pale,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 16,
            aspectRatio: 1,
          },
          style,
        ]}
      >
        <Ionicons name="paw-outline" size={42} color={colors.accent} />
        <Text style={styles.muted}>Лапки</Text>
      </View>
    );
  return (
    <Image
      key={image.mediaId}
      source={source}
      accessibilityLabel={image.alt || 'Фото'}
      style={[
        { backgroundColor: colors.pale, borderRadius: 16, aspectRatio: 1 },
        style,
      ]}
      resizeMode="cover"
      onError={() => setBrokenUri(source.uri)}
    />
  );
}

/** Отображает пустое состояние либо ошибку с действием восстановления. */
export function Empty({
  title,
  description,
  error,
  onRetry,
  action,
  onAction,
}: {
  title: string;
  description?: string;
  error?: unknown;
  onRetry?: () => void;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <View style={[styles.card, { alignItems: 'center', paddingVertical: 30 }]}>
      <Ionicons
        name={error ? 'cloud-offline-outline' : 'paw-outline'}
        size={40}
        color={colors.accent}
      />
      <Text style={[styles.heading, { textAlign: 'center' }]}>{title}</Text>
      <Text style={[styles.muted, { textAlign: 'center' }]}>
        {error ? errorMessage(error) : description}
      </Text>
      {onRetry && (
        <Button secondary onPress={onRetry}>
          Повторить
        </Button>
      )}
      {action && onAction && <Button onPress={onAction}>{action}</Button>}
    </View>
  );
}
export function Loading() {
  return (
    <View style={{ padding: 50, alignItems: 'center', gap: 12 }}>
      <ActivityIndicator color={colors.accent} />
      <Text style={styles.muted}>Загружаем…</Text>
    </View>
  );
}

/** Показывает уведомления и нативный диалог ошибки поверх текущего экрана. */
export function Overlays() {
  const store = useStore();
  return (
    <>
      {!!store.notice && (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            bottom: 100,
            left: 22,
            right: 22,
            backgroundColor: colors.ink,
            padding: 16,
            borderRadius: 16,
          }}
        >
          <Text
            accessibilityLiveRegion="polite"
            style={{ color: '#fff', textAlign: 'center' }}
          >
            {store.notice}
          </Text>
        </View>
      )}
      <Modal
        visible={!!store.error}
        transparent
        animationType="fade"
        onRequestClose={store.dismissError}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: '#172B2370',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 25,
          }}
        >
          <View testID="error-dialog" style={[styles.card, { width: '100%' }]}>
            <Text style={styles.heading}>Не удалось выполнить действие</Text>
            <Text style={styles.text}>{errorMessage(store.error)}</Text>
            {store.error instanceof ApiError && store.error.requestId && (
              <Text style={styles.muted}>
                Номер обращения: {store.error.requestId}
              </Text>
            )}
            <Button testID="error-dismiss" onPress={store.dismissError}>
              Понятно
            </Button>
          </View>
        </View>
      </Modal>
    </>
  );
}
