import { Stack } from 'expo-router';
import React from 'react';

export default function OfficeLayout() {
  return (
    <Stack>
      <Stack.Screen name="office-portal" options={{ headerShown: false }} />
      <Stack.Screen name="visitor-info" options={{ headerShown: false }} />
    </Stack>
  );
}
