import { Stack } from 'expo-router';

export default function EnrolleeLayout() {
  return (
    <Stack>
      <Stack.Screen name="progress/[token]" options={{ headerShown: false, title: 'Enrollee Progress' }} />
    </Stack>
  );
}
