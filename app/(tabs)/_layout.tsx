import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { Platform } from "react-native";
import { useTheme } from "../../contexts/ThemeContext";

export default function TabsLayout() {
  const { colors, isDark } = useTheme();
  return (
    <Tabs screenOptions={{
      headerShown: false,
      sceneStyle: { backgroundColor: colors.background },
      tabBarStyle: {
        position: "absolute", left: 14, right: 14, bottom: Platform.OS === "ios" ? 14 : 10,
        height: Platform.OS === "ios" ? 80 : 72, paddingTop: 9,
        paddingBottom: Platform.OS === "ios" ? 18 : 11,
        backgroundColor: isDark ? "#0D1C2EF2" : "#FFFFFFF2",
        borderTopWidth: 0, borderWidth: 1, borderColor: colors.border, borderRadius: 24,
        elevation: 12, shadowColor: "#000", shadowOpacity: isDark ? 0.28 : 0.12,
        shadowRadius: 18, shadowOffset: { width: 0, height: 8 },
      },
      tabBarActiveTintColor: colors.accentGold,
      tabBarInactiveTintColor: colors.muted,
      tabBarLabelStyle: { fontSize: 11.5, fontWeight: "900", marginTop: 2 },
      tabBarItemStyle: { borderRadius: 18, marginHorizontal: 3 },
    }}>
      <Tabs.Screen name="index" options={{ title: "Home", tabBarIcon: ({color, focused}) => <Ionicons name={focused ? "home" : "home-outline"} size={23} color={color} /> }} />
      <Tabs.Screen name="events" options={{ title: "Esplora", tabBarIcon: ({color, focused}) => <Ionicons name={focused ? "compass" : "compass-outline"} size={24} color={color} /> }} />
      <Tabs.Screen name="rooms" options={{ title: "Stanze", tabBarIcon: ({color, focused}) => <Ionicons name={focused ? "bed" : "bed-outline"} size={24} color={color} /> }} />
      <Tabs.Screen name="profile" options={{ title: "Profilo", tabBarIcon: ({color, focused}) => <Ionicons name={focused ? "person-circle" : "person-circle-outline"} size={25} color={color} /> }} />
    </Tabs>
  );
}
