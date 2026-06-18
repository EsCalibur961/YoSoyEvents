import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, Image, StyleSheet, Text, View } from "react-native";
import { useTheme } from "../contexts/ThemeContext";

export default function StartScreen() {
  const { colors, isDark } = useTheme();
  const styles = createStyles(colors, isDark);
  useEffect(() => {
    checkSession();
  }, []);

  const checkSession = async () => {
    try {
      const isLogged = await AsyncStorage.getItem("isLogged");
      const loggedUser = await AsyncStorage.getItem("loggedUser");

      setTimeout(() => {
        if (isLogged === "true" && loggedUser) {
          router.replace("/(tabs)");
        } else {
          router.replace("/login");
        }
      }, 300);
    } catch {
      router.replace("/login");
    }
  };

  return (
    <View style={styles.container}>
      <Image
        source={require("../assets/images/logo.png")}
        style={{
          width: 260,
          height: 180,
          resizeMode: "contain",
        }}
      />

      <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />

      <Text style={styles.text}>Caricamento...</Text>
    </View>
  );
}

const createStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },

  logoTitle: {
    color: colors.text,
    fontSize: 30,
    fontWeight: "900",
    letterSpacing: 3,
  },

  logoSubtitle: {
    color: colors.primary,
    fontSize: 46,
    fontWeight: "900",
    letterSpacing: 2,
    marginTop: 4,
  },

  loader: {
    marginTop: 36,
    marginBottom: 18,
  },

  text: {
    color: colors.secondary,
    fontSize: 15,
    fontWeight: "800",
  },
});
