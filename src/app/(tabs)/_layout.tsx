import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useStore } from '../../store';
import { colors } from '../../ui';

/** Создаёт основные вкладки покупателя с количеством позиций корзины. */
export default function TabLayout() {
  const store = useStore();
  const count = store.lines.reduce((sum, line) => sum + line.quantity, 0);
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerShadowVisible: false,
        headerTintColor: colors.ink,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { backgroundColor: '#fff', borderTopColor: colors.line },
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Лапки',
          tabBarLabel: 'Каталог',
          tabBarButtonTestID: 'nav-catalog',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="paw-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="cart"
        options={{
          title: 'Корзина',
          tabBarButtonTestID: 'nav-cart',
          tabBarBadge: count || undefined,
          tabBarBadgeStyle: { backgroundColor: colors.accent },
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="bag-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: 'Аккаунт',
          tabBarButtonTestID: 'nav-account',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
