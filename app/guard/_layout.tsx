import { Redirect, Stack } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import 'react-native-reanimated';

import { useAuth } from '@/contexts/auth-context';

const GUARD_BLUE = '#0648A8';

export default function GuardLayout() {
  const { isRestoring, isAuthenticated, userProfile } = useAuth();

  if (isRestoring) {
    return (
      <View style={styles.restore}>
        <ActivityIndicator color="#FFD914" size="large" />
      </View>
    );
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
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'fade',
        contentStyle: { backgroundColor: GUARD_BLUE },
      }}
    >
      <Stack.Screen name="dashboard" />
      <Stack.Screen name="select-visitor-type" />
      <Stack.Screen name="register-visitor" />
      <Stack.Screen name="id-auto-capture" />
      <Stack.Screen name="qr-ticket" />
      <Stack.Screen name="exit-scan" />
      <Stack.Screen name="alerts" />
      <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal', animation: 'slide_from_bottom' }} />
    </Stack>
  );
}

const styles = StyleSheet.create({
  restore: {
    flex: 1,
    backgroundColor: GUARD_BLUE,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
