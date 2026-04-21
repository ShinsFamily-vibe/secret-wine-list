import { Stack } from "expo-router";

export default function RootLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="scan" />
      <Stack.Screen name="detail" />
      <Stack.Screen name="buddy-wines" />
    </Stack>
  );
}
