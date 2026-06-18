import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { DemoProvider } from "../src/context/DemoContext";

export default function RootLayout() {
  return (
    <DemoProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: "#09090b" },
        }}
      />
    </DemoProvider>
  );
}
