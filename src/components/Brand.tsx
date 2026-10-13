import { ActivityIndicator, Image, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { colors } from '../ui';

const logo = require('../../assets/branding/lapki-logo.png');

/** Показывает утверждённый логотип магазина с кириллическим названием. */
export function BrandLogo({ size = 144 }: { size?: number }) {
  return (
    <Image
      source={logo}
      testID="brand-logo"
      accessibilityRole="image"
      accessibilityLabel="Лапки — магазин для питомцев"
      resizeMode="contain"
      style={{
        width: size,
        height: size,
        borderRadius: 20,
        alignSelf: 'center',
        backgroundColor: colors.accent,
      }}
    />
  );
}

/** Сохраняет оформление заставки, пока читаются настройки и сессия. */
export function BrandSplash() {
  return (
    <View
      testID="brand-startup"
      style={{
        flex: 1,
        backgroundColor: colors.accent,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        gap: 24,
      }}
    >
      <StatusBar style="light" />
      <BrandLogo size={260} />
      <ActivityIndicator
        color={colors.bg}
        accessibilityLabel="Загрузка магазина"
      />
    </View>
  );
}
