import { Stack } from 'expo-router';

export default function OfficeLayout() {
  return (
    <Stack>
      <Stack.Screen name="office-portal" options={{ headerShown: false }} />
      <Stack.Screen name="visitor-info" options={{ headerShown: false }} />
      <Stack.Screen name="exit-scan" options={{ headerShown: false }} />
    </Stack>
  );
}
