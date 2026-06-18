import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  updateDoc,
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
  View,
} from "react-native";
import { useTheme } from "../contexts/ThemeContext";
import { db } from "../firebase";
import { registerForPushNotificationsAsync } from "../services/pushNotifications";

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

export default function LoginScreen() {
  const { colors, isDark } = useTheme();
  const styles = createStyles(colors, isDark);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const goToApp = () => {
    setTimeout(() => {
      router.replace("/(tabs)");
    }, 250);
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
        if (cleanPassword !== adminPassword) {
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
        goToApp();
        return;
      }

      const snapshot = await getDocs(collection(db, "teachers"));

      const teachers: TeacherUser[] = snapshot.docs.map((docItem) => ({
        id: docItem.id,
        ...(docItem.data() as Omit<TeacherUser, "id">),
      }));

      const foundTeacher = teachers.find(
        (teacher) =>
          teacher.username?.toLowerCase() === cleanUsername.toLowerCase() &&
          teacher.password === cleanPassword,
      );

      if (!foundTeacher) {
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
          router.replace("/change-password");
        }, 250);
      } else {
        goToApp();
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
          <Image
            source={require("../assets/images/logo.png")}
            style={{
              width: 220,
              height: 160,
              resizeMode: "contain",
              alignSelf: "center",
              marginBottom: 10,
            }}
          />
          <Text style={styles.logoText}>Area privata maestri e staff</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.title}>Accesso</Text>

          <Text style={styles.subtitle}>Accedi come admin o maestro.</Text>

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

const createStyles = (colors: any, isDark: boolean) =>
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
      paddingHorizontal: 24,
      paddingVertical: 60,
    },

    logoContainer: {
      alignItems: "center",
      marginBottom: 38,
    },

    logoTitle: {
      color: colors.text,
      fontSize: 30,
      fontWeight: "900",
      letterSpacing: 3,
    },

    logoSubtitle: {
      color: colors.primary,
      fontSize: 50,
      fontWeight: "900",
      letterSpacing: 2,
      marginTop: 2,
    },

    logoText: {
      color: colors.secondary,
      fontSize: 15,
      fontWeight: "800",
      marginTop: 10,
    },

    card: {
      backgroundColor: colors.card,
      borderRadius: 32,
      padding: 24,
      borderWidth: 1,
      borderColor: colors.border,
    },

    title: {
      color: colors.text,
      fontSize: 34,
      fontWeight: "900",
      marginBottom: 8,
    },

    subtitle: {
      color: colors.secondary,
      fontSize: 16,
      marginBottom: 24,
    },

    inputBox: {
      backgroundColor: colors.background,
      borderRadius: 20,
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
      backgroundColor: colors.primary,
      borderRadius: 22,
      paddingVertical: 18,
      paddingHorizontal: 18,
      marginTop: 8,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
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
