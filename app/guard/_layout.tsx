import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Redirect, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useAuth } from '@/contexts/auth-context';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function GuardLayout() {
  const colorScheme = useColorScheme();
  const { isRestoring, isAuthenticated, userProfile } = useAuth();

  if (isRestoring) {
    return null;
  }

  if (!isAuthenticated) {
    return <Redirect href="/(tabs)" />;
  }

  if (userProfile?.role_id === 3) {
    return <Redirect href="/office/office-portal" />;
  }

  if (userProfile?.role_id !== 2) {
    return <Redirect href="/(tabs)" />;
  }

  return (
    <SafeAreaProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack>
          <Stack.Screen name="dashboard" options={{ headerShown: false }} />
          <Stack.Screen name="select-visitor-type" options={{ headerShown: false }} />
          <Stack.Screen name="register-visitor" options={{ headerShown: false }} />
          <Stack.Screen name="id-auto-capture" options={{ headerShown: false }} />
          <Stack.Screen name="qr-ticket" options={{ headerShown: false }} />
          <Stack.Screen name="exit-scan" options={{ headerShown: false }} />
          <Stack.Screen name="alerts" options={{ headerShown: false }} />
          <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
        </Stack>
        <StatusBar style="auto" />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
