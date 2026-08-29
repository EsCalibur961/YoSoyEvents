import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { db } from "../../firebase";
import { registerForPushNotificationsAsync } from "../../services/pushNotifications";
import { hashPassword } from "../../utils/hash";

type TeacherUser = {
  id: string;
  username: string;
  password: string;
  firstName?: string;
  lastName?: string;
  danceSchool?: string;
  mustChangePassword?: boolean;
};

type AdminAuth = {
  username?: string;
  password?: string;
};

export default function WebLoginScreen() {
  const { colors, isDark } = useTheme();
  const { width } = useWindowDimensions();
  const styles = createStyles(colors, isDark, width < 420);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const goToTeacherWeb = () => {
    setTimeout(() => {
      router.replace("/web/teacher");
    }, 150);
  };

  const goToAdminWeb = () => {
    setTimeout(() => {
      router.replace("/admin-web");
    }, 150);
  };

  const login = async () => {
    if (!username.trim() || !password.trim()) {
      Alert.alert("Campi mancanti", "Inserisci username e password.");
      return;
    }

    try {
      setLoading(true);

      const cleanUsername = username.trim();
      const cleanPassword = password.trim();

      const adminSnap = await getDoc(doc(db, "settings", "adminAuth"));
      const adminData = adminSnap.exists()
        ? (adminSnap.data() as AdminAuth)
        : null;

      const adminUsername = adminData?.username || "admin";
      const adminPassword = adminData?.password || "admin";

      if (cleanUsername.toLowerCase() === adminUsername.toLowerCase()) {
        const isHashed = adminPassword.length === 64;
        const hashedInput = hashPassword(cleanPassword);
        const isPasswordCorrect = isHashed 
          ? hashedInput === adminPassword 
          : cleanPassword === adminPassword;

        if (!isPasswordCorrect) {
          setLoading(false);
          Alert.alert("Accesso negato", "Password admin non corretta.");
          return;
        }

        await AsyncStorage.setItem("isLogged", "true");
        await AsyncStorage.setItem("loggedUser", "admin");

        await AsyncStorage.removeItem("teacherUsername");
        await AsyncStorage.removeItem("teacherId");
        await AsyncStorage.removeItem("teacherFullName");
        await AsyncStorage.removeItem("danceSchool");

        try {
          await registerForPushNotificationsAsync({
            role: "admin",
            username: "admin",
          });
        } catch (pushError) {
          console.log("Push admin non registrata:", pushError);
        }

        setLoading(false);
        goToAdminWeb();
        return;
      }

      const teachersRef = collection(db, "teachers");
      const q = query(
        teachersRef,
        where("username", "==", cleanUsername),
        limit(1),
      );
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        setLoading(false);
        Alert.alert("Accesso negato", "Username o password non corretti.");
        return;
      }

      const docItem = snapshot.docs[0];
      const foundTeacher: TeacherUser = {
        id: docItem.id,
        ...(docItem.data() as Omit<TeacherUser, "id">),
      };

      const isPasswordCorrect = foundTeacher.password?.length === 64
        ? hashPassword(cleanPassword) === foundTeacher.password
        : cleanPassword === foundTeacher.password;

      if (!isPasswordCorrect) {
        setLoading(false);
        Alert.alert("Accesso negato", "Username o password non corretti.");
        return;
      }

      await AsyncStorage.setItem("isLogged", "true");
      await AsyncStorage.setItem("loggedUser", "teacher");
      await AsyncStorage.setItem(
        "teacherUsername",
        foundTeacher.username || "",
      );
      await AsyncStorage.setItem("teacherId", foundTeacher.id || "");
      await AsyncStorage.setItem(
        "teacherFullName",
        `${foundTeacher.firstName || ""} ${foundTeacher.lastName || ""}`.trim(),
      );
      await AsyncStorage.setItem("danceSchool", foundTeacher.danceSchool || "");

      try {
        await updateDoc(doc(db, "teachers", foundTeacher.id), {
          isOnline: true,
          lastSeen: serverTimestamp(),
        });
      } catch (presenceError) {
        console.log("Presenza maestro non aggiornata:", presenceError);
      }

      try {
        await registerForPushNotificationsAsync({
          role: "teacher",
          username: foundTeacher.username || "",
          teacherId: foundTeacher.id || "",
        });
      } catch (pushError) {
        console.log("Push maestro non registrata:", pushError);
      }

      setLoading(false);

      if (foundTeacher.mustChangePassword) {
        setTimeout(() => {
          router.replace("/web/teacher/change-password");
        }, 150);
      } else {
        goToTeacherWeb();
      }
    } catch (error) {
      setLoading(false);

      Alert.alert(
        "Errore",
        "Non è stato possibile effettuare l’accesso. Controlla la connessione.",
      );
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.wrapper}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.logoContainer}>
          <View style={styles.logoHalo}>
            <Image source={require("../../assets/images/logo.png")} style={styles.logoImage} />
          </View>
          <Text style={styles.logoText}>YO SOY EVENTS</Text>
          <Text style={styles.logoCaption}>Area privata maestri e staff</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.cardEyebrow}>
            <Ionicons name="sparkles-outline" size={16} color={colors.accentGold} />
            <Text style={styles.cardEyebrowText}>ACCESSO RISERVATO</Text>
          </View>
          <Text style={styles.title}>Bentornato</Text>
          <Text style={styles.subtitle}>Accedi con le credenziali admin o maestro.</Text>

          <View style={styles.inputBox}>
            <Ionicons name="person" size={22} color={colors.placeholder} />

            <TextInput
              style={styles.input}
              placeholder="Username"
              placeholderTextColor={colors.placeholder}
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.inputBox}>
            <Ionicons
              name="lock-closed-outline"
              size={22}
              color={colors.placeholder}
            />

            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor={colors.placeholder}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
            />

            <TouchableOpacity
              style={styles.eyeButton}
              onPress={() => setShowPassword(!showPassword)}
            >
              <Ionicons
                name={showPassword ? "eye-off-outline" : "eye-outline"}
                size={22}
                color={colors.secondary}
              />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.loginButton, loading && styles.loginButtonDisabled]}
            onPress={login}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={colors.text} />
            ) : (
              <>
                <Text style={styles.loginButtonText}>Accedi</Text>
                <Ionicons
                  name="arrow-forward-outline"
                  size={22}
                  color={colors.text}
                />
              </>
            )}
          </TouchableOpacity>
        </View>

        <Text style={styles.footerText}>YoSoy Events • Gestionale privato</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (colors: any, isDark: boolean, isMobileSmall: boolean) =>
  StyleSheet.create({
    wrapper: {
      flex: 1,
      backgroundColor: colors.background,
    },

    scroll: {
      flex: 1,
      backgroundColor: colors.background,
    },

    container: {
      flexGrow: 1,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: isMobileSmall ? 14 : 24,
      paddingVertical: isMobileSmall ? 24 : 48,
    },

    logoContainer: { width: "100%", maxWidth: 520, alignItems: "center", marginBottom: 24 },
    logoHalo: {
      width: isMobileSmall ? 112 : 150, height: isMobileSmall ? 112 : 150, borderRadius: isMobileSmall ? 34 : 46, alignItems: "center", justifyContent: "center",
      backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
      shadowColor: "#000", shadowOpacity: isDark ? 0.30 : 0.10, shadowRadius: 24,
      shadowOffset: { width: 0, height: 12 }, elevation: 8, marginBottom: 18,
    },
    logoImage: { width: isMobileSmall ? 94 : 126, height: isMobileSmall ? 94 : 126, resizeMode: "contain" },

    logoTitle: {
      color: colors.text,
      fontSize: 30,
      fontWeight: "900",
      letterSpacing: 3,
    },

    logoSubtitle: {
      color: colors.primary,
      fontSize: isMobileSmall ? 38 : 50,
      fontWeight: "900",
      letterSpacing: 2,
      marginTop: 2,
    },

    logoText: { color: colors.text, fontSize: 18, fontWeight: "900", letterSpacing: 2.2 },
    logoCaption: { color: colors.secondary, fontSize: 13, fontWeight: "700", marginTop: 6 },

    card: {
      width: "100%", maxWidth: 520,
      backgroundColor: colors.card, borderRadius: 28, padding: isMobileSmall ? 18 : 26, borderWidth: 1,
      borderColor: colors.border, shadowColor: "#000", shadowOpacity: isDark ? 0.22 : 0.08,
      shadowRadius: 22, shadowOffset: { width: 0, height: 10 }, elevation: 7,
    },
    cardEyebrow: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
    cardEyebrowText: { color: colors.accentGold, fontSize: 11, fontWeight: "900", letterSpacing: 1.4, marginLeft: 7 },

    title: {
      color: colors.text,
      fontSize: 32,
      fontWeight: "900",
      letterSpacing: -0.8,
      marginBottom: 8,
    },

    subtitle: {
      color: colors.secondary,
      fontSize: 16,
      marginBottom: 24,
    },

    inputBox: {
      backgroundColor: colors.input,
      borderRadius: 18,
      paddingHorizontal: 16,
      marginBottom: 16,
      flexDirection: "row",
      alignItems: "center",
      borderWidth: 1,
      borderColor: colors.border,
    },

    input: {
      flex: 1,
      color: colors.text,
      fontSize: 16,
      paddingVertical: 17,
      marginLeft: 12,
    },

    eyeButton: {
      paddingLeft: 12,
      paddingVertical: 12,
    },

    loginButton: {
      backgroundColor: colors.primary, borderRadius: 18, paddingVertical: 17, paddingHorizontal: 18,
      marginTop: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      shadowColor: colors.primary, shadowOpacity: 0.24, shadowRadius: 14,
      shadowOffset: { width: 0, height: 7 }, elevation: 5,
    },

    loginButtonDisabled: {
      opacity: 0.7,
    },

    loginButtonText: {
      color: colors.onPrimary,
      fontSize: 17,
      fontWeight: "900",
    },

    footerText: {
      color: colors.placeholder,
      fontSize: 13,
      fontWeight: "800",
      textAlign: "center",
      marginTop: 24,
    },
  });
