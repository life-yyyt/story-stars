import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';

import { AppProvider } from '@/src/context/app-context';
import { UniverseFocusIntentProvider } from '@/src/features/universe-runtime/universe-focus-intent';
import { useCosmicFonts } from '@/src/lib/fonts';
import { cosmicTheme } from '@/src/lib/theme';

SplashScreen.preventAutoHideAsync().catch(() => null);

export default function RootLayout() {
  const [fontsLoaded] = useCosmicFonts();

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync().catch(() => null);
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AppProvider>
        <UniverseFocusIntentProvider>
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: cosmicTheme.colors.background },
            }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen
              name="login"
              options={{
                presentation: 'modal',
                animation: 'slide_from_bottom',
              }}
            />
          </Stack>
          <StatusBar style="light" />
        </UniverseFocusIntentProvider>
      </AppProvider>
    </GestureHandlerRootView>
  );
}
