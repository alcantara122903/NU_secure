import { useAuth } from '@/contexts/auth-context';
import { Redirect, Stack } from 'expo-router';

export default function OfficeLayout() {
  const { isRestoring, isAuthenticated, userProfile } = useAuth();

  if (isRestoring) {
    return null;
  }

  if (!isAuthenticated) {
    return <Redirect href="/(tabs)" />;
  }

  if (userProfile?.role_id === 2) {
    return <Redirect href="/guard/dashboard" />;
  }

  if (userProfile?.role_id !== 3) {
    return <Redirect href="/(tabs)" />;
  }

  return (
    <Stack>
      <Stack.Screen name="office-portal" options={{ headerShown: false }} />
      <Stack.Screen name="office-scan" options={{ headerShown: false }} />
      <Stack.Screen name="visitor-info" options={{ headerShown: false }} />
    </Stack>
  );
}
