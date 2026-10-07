import { Tabs } from 'expo-router';
import { useEffect, useState } from 'react';
import { Keyboard, Platform, Pressable, StyleSheet, View, type ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName } from '@/components/ui/Icon';
import { useCreateMemo } from '@/hooks/useCreateMemo';
import { useTheme } from '@/theme/ThemeProvider';
import { layout } from '@/theme/tokens';

export default function TabLayout() {
  const { colors } = useTheme();
  const createMemo = useCreateMemo();
  const insets = useSafeAreaInsets();
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSubscription = Keyboard.addListener(showEvent, () => setKeyboardVisible(true));
    const hideSubscription = Keyboard.addListener(hideEvent, () => setKeyboardVisible(false));

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  return (
    <View style={styles.fill}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.accent,
          tabBarInactiveTintColor: colors.textTertiary,
          tabBarStyle: {
            backgroundColor: colors.tabBar,
            borderTopColor: colors.border,
          },
          tabBarLabelStyle: styles.tabLabel,
        }}>
        <Tabs.Screen
          name="index"
          options={{
            title: '홈',
            tabBarIcon: ({ color }) => <TabIcon name="home" color={color} />,
          }}
        />
        <Tabs.Screen
          name="notes"
          options={{
            title: '메모',
            tabBarIcon: ({ color }) => <TabIcon name="notes" color={color} />,
          }}
        />
        <Tabs.Screen
          name="search"
          options={{
            title: '검색',
            tabBarIcon: ({ color }) => <TabIcon name="search" color={color} />,
          }}
        />
        <Tabs.Screen
          name="memories"
          options={{
            title: '기억',
            tabBarIcon: ({ color }) => <TabIcon name="memories" color={color} />,
          }}
        />
      </Tabs>
      {keyboardVisible ? null : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="새 메모"
          onPress={createMemo}
          style={({ pressed }) => [
            styles.fab,
            {
              backgroundColor: colors.accent,
              bottom: insets.bottom + 72,
              transform: [{ scale: pressed ? 0.96 : 1 }],
            },
          ]}>
          <Icon name="plus" color={colors.onAccent} size={28} />
        </Pressable>
      )}
    </View>
  );
}

function TabIcon({ name, color }: { name: IconName; color: ColorValue }) {
  return <Icon name={name} color={color} size={22} />;
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  fab: {
    position: 'absolute',
    right: 20,
    width: layout.fabSize,
    height: layout.fabSize,
    borderRadius: layout.fabSize / 2,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
    elevation: 6,
    shadowColor: '#1C1B19',
    shadowOpacity: 0.16,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
});
