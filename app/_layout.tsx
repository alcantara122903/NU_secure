import { AlertModalProvider } from '@/components/ui/alert-modal-context';
import { AuthProvider, useAuth } from '@/contexts/auth-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';

export const unstable_settings = {
  anchor: '(tabs)',
};

SplashScreen.preventAutoHideAsync().catch(() => {});

function SessionRestoreScreen() {
  return (
    <View style={styles.restoreScreen}>
      <Text style={styles.restoreTitle}>NU-SECURE</Text>
      <ActivityIndicator color="#FFD914" size="large" />
    </View>
  );
}

function AuthNavigationGate({ children }: { children: ReactNode }) {
  const { isRestoring, isAuthenticated, dashboardRoute } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const rootSegment = segments[0];
  const inProtectedGroup = rootSegment === 'guard' || rootSegment === 'office';
  const onLoginGroup = rootSegment === '(tabs)' || rootSegment == null;
  const showRestoreOverlay =
    isRestoring || Boolean(isAuthenticated && dashboardRoute && onLoginGroup);

  useEffect(() => {
    if (isRestoring) {
      return;
    }

    SplashScreen.hideAsync().catch(() => {});

    if (!isAuthenticated && inProtectedGroup) {
      router.replace('/(tabs)');
      return;
    }

    if (isAuthenticated && dashboardRoute && onLoginGroup) {
      router.replace(dashboardRoute);
    }
  }, [
    dashboardRoute,
    inProtectedGroup,
    isAuthenticated,
    isRestoring,
    onLoginGroup,
    router,
  ]);

  return (
    <View style={styles.flex}>
      {children}
      {showRestoreOverlay ? (
        <View style={StyleSheet.absoluteFillObject}>
          <SessionRestoreScreen />
        </View>
      ) : null}
    </View>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <SafeAreaProvider>
      <AlertModalProvider>
        <AuthProvider>
          <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
            <AuthNavigationGate>
              <Stack>
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                <Stack.Screen name="guard" options={{ headerShown: false }} />
                <Stack.Screen name="office" options={{ headerShown: false }} />
                <Stack.Screen name="enrollee" options={{ headerShown: false }} />
              </Stack>
            </AuthNavigationGate>
            <StatusBar style="auto" />
          </ThemeProvider>
        </AuthProvider>
      </AlertModalProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  restoreScreen: {
    flex: 1,
    backgroundColor: '#0A4DB3',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  restoreTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: '#FFD914',
    letterSpacing: 1,
  },
});
