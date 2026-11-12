import { Tabs } from "expo-router";
import BottomTabBar from "@/components/BottomTabBar";

// The four main tabs. Switching tabs keeps each screen mounted (no reload,
// scroll position kept), and Android back from any tab returns to Home
// before leaving the app.
export default function TabsLayout() {
  return (
    <Tabs
      initialRouteName="home"
      backBehavior="initialRoute"
      tabBar={(props) => <BottomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="home" />
      <Tabs.Screen name="outline" />
      <Tabs.Screen name="noted" />
      <Tabs.Screen name="devotionals" />
    </Tabs>
  );
}
