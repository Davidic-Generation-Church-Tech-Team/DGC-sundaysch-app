import { View, TouchableOpacity, Text, useWindowDimensions, Platform, StyleSheet } from "react-native";
import { Feather, MaterialCommunityIcons, MaterialIcons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@/context/NavigationContext";

const ACCENT = "#9d00d4";
const isIOS = Platform.OS === "ios";

// Keys are the route file names inside app/(tabs)/.
const TABS: Record<
  string,
  { label: string; family: "feather" | "mci" | "material"; icon: string; iconActive: string }
> = {
  home: { label: "Home", family: "feather", icon: "home", iconActive: "home" },
  outline: { label: "Manuals", family: "mci", icon: "file-document-outline", iconActive: "file-document" },
  noted: { label: "Notes", family: "feather", icon: "edit-3", iconActive: "edit-3" },
  devotionals: { label: "Devotionals", family: "material", icon: "wb-sunny", iconActive: "wb-sunny" },
};

const ICON_FAMILIES = { feather: Feather, mci: MaterialCommunityIcons, material: MaterialIcons } as const;

// Floating, frosted pill tab bar. Rendered once by app/(tabs)/_layout.tsx, so
// the active tab comes straight from the navigator's own state — it can't
// drift out of sync with the screen the way a hand-rolled bar could.
export default function BottomTabBar({ state, navigation }: BottomTabBarProps) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { isDarkMode } = useNavigation();
  const isTablet = width > 768;

  return (
    <View pointerEvents="box-none" style={[styles.floatingWrap, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      <BlurView
        intensity={isIOS ? 78 : 100}
        tint={isDarkMode ? "dark" : "light"}
        style={[
          styles.glassBar,
          isTablet && styles.glassBarTablet,
          {
            borderColor: isDarkMode ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.65)",
            backgroundColor: isDarkMode ? "rgba(20,20,20,0.55)" : "rgba(255,255,255,0.55)",
          },
        ]}
      >
        {state.routes.map((route, index) => {
          const tab = TABS[route.name];
          if (!tab) return null;

          const isActive = state.index === index;
          const Icon = ICON_FAMILIES[tab.family];
          const color = isActive ? ACCENT : isDarkMode ? "#9a9a9a" : "#7a7a7a";

          const handlePress = () => {
            const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
            if (!isActive && !event.defaultPrevented) navigation.navigate(route.name);
          };

          return (
            <TouchableOpacity
              key={route.key}
              onPress={handlePress}
              activeOpacity={0.7}
              style={styles.tab}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={tab.label}
            >
              <Icon name={(isActive ? tab.iconActive : tab.icon) as never} size={isTablet ? 18 : 22} color={color} />
              <Text style={[styles.label, { color, fontFamily: isActive ? "Manrope_700Bold" : "Manrope_500Medium" }]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  floatingWrap: { position: "absolute", left: 16, right: 16, bottom: 0 },
  glassBar: {
    flexDirection: "row",
    borderRadius: 32,
    paddingTop: 12,
    paddingBottom: 10,
    paddingHorizontal: 6,
    overflow: "hidden",
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 10,
  },
  glassBarTablet: { alignSelf: "center", width: "60%" },
  tab: { flex: 1, alignItems: "center", gap: 4 },
  label: { fontSize: 10.5, letterSpacing: 0.2 },
});
