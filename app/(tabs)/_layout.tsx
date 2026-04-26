import { Ionicons } from '@expo/vector-icons';
import { Tabs, useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet } from 'react-native';

import { cosmicTheme } from '@/src/lib/theme';

export default function TabLayout() {
  const router = useRouter();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: cosmicTheme.colors.text,
        tabBarInactiveTintColor: cosmicTheme.colors.tabInactive,
        tabBarItemStyle: styles.tabItem,
        tabBarLabelStyle: styles.tabLabel,
        tabBarStyle: styles.tabBar,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: '宇宙',
          tabBarIcon: ({ color, size }) => <Ionicons name="planet-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="compose"
        listeners={{
          tabPress: (event) => {
            event.preventDefault();
            router.replace({
              pathname: '/compose',
              params: {
                draftNonce: Date.now().toString(),
                mode: 'new',
              },
            });
          },
        }}
        options={{
          title: '发布',
          tabBarIcon: ({ color, size }) => <Ionicons name="add-circle-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="stars"
        options={{
          title: '我的星星',
          tabBarIcon: ({ color, size }) => <Ionicons name="sparkles-outline" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    left: 28,
    right: 28,
    bottom: 20,
    height: 56,
    borderTopWidth: 1,
    borderColor: cosmicTheme.colors.dockBorder,
    borderRadius: 999,
    backgroundColor: cosmicTheme.colors.dock,
    paddingTop: 3,
    paddingBottom: 6,
    elevation: 0,
  },
  tabItem: {
    paddingTop: 2,
  },
  tabLabel: {
    fontFamily: cosmicTheme.fonts.bodyMedium,
    fontSize: 10,
    letterSpacing: 0.3,
  },
});
