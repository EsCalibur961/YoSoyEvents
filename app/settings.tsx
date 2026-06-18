import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useFocusEffect } from "expo-router";
import {
  collection,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { useCallback, useState } from "react";
import {
  Alert,
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

type TeacherUser = {
  id: string;
  username: string;
  password: string;
  initialPassword?: string;
  firstName: string;
  lastName: string;
  danceSchool: string;
};

type AdminSettings = {
  password?: string;
};

export default function SettingsScreen() {
  const { colors, isDark, toggleTheme } = useTheme();
  const styles = createStyles(colors, isDark);
  const [role, setRole] = useState<string | null>(null);
  const [teacherUsername, setTeacherUsername] = useState<string | null>(null);
  const [teacherId, setTeacherId] = useState<string | null>(null);

  const [teachers, setTeachers] = useState<TeacherUser[]>([]);
  const [adminPassword, setAdminPassword] = useState("admin");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadLocalUser();

      const unsubAdmin = onSnapshot(
        doc(db, "settings", "adminAuth"),
        (snap) => {
          if (snap.exists()) {
            const data = snap.data() as AdminSettings;
            setAdminPassword(data.password || "admin");
          }
        },
      );

      const unsubTeachers = onSnapshot(
        collection(db, "teachers"),
        (snapshot) => {
          const data: TeacherUser[] = snapshot.docs.map((item) => ({
            id: item.id,
            ...(item.data() as Omit<TeacherUser, "id">),
          }));

          setTeachers(data);
        },
      );

      return () => {
        unsubAdmin();
        unsubTeachers();
      };
    }, []),
  );

  const loadLocalUser = async () => {
    const savedRole = await AsyncStorage.getItem("loggedUser");
    const savedTeacherUsername = await AsyncStorage.getItem("teacherUsername");
    const savedTeacherId = await AsyncStorage.getItem("teacherId");

    setRole(savedRole);
    setTeacherUsername(savedTeacherUsername);
    setTeacherId(savedTeacherId);
  };

  const currentTeacher = teachers.find(
    (teacher) => teacher.username === teacherUsername,
  );

  const clearForm = () => {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  };

  const changePassword = async () => {
    if (
      !currentPassword.trim() ||
      !newPassword.trim() ||
      !confirmPassword.trim()
    ) {
      Alert.alert("Campi mancanti", "Compila tutti i campi password.");
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert("Errore", "Le nuove password non coincidono.");
      return;
    }

    if (newPassword.length < 6) {
      Alert.alert(
        "Password debole",
        "La nuova password deve avere almeno 6 caratteri.",
      );
      return;
    }

    try {
      setLoading(true);

      if (role === "admin") {
        if (currentPassword !== adminPassword) {
          setLoading(false);
          Alert.alert("Password errata", "La password attuale non è corretta.");
          return;
        }

        await setDoc(
          doc(db, "settings", "adminAuth"),
          {
            password: newPassword,
            updatedAt: serverTimestamp(),
          },
          { merge: true },
        );

        setLoading(false);
        clearForm();

        Alert.alert(
          "Password aggiornata",
          "La password admin è stata modificata live.",
        );
        return;
      }

      const idToUpdate = teacherId || currentTeacher?.id;

      if (!idToUpdate || !currentTeacher) {
        setLoading(false);
        Alert.alert("Errore", "Maestro non trovato.");
        return;
      }

      if (currentPassword !== currentTeacher.password) {
        setLoading(false);
        Alert.alert("Password errata", "La password attuale non è corretta.");
        return;
      }

      await updateDoc(doc(db, "teachers", idToUpdate), {
        password: newPassword,
        mustChangePassword: false,
        updatedAt: serverTimestamp(),
      });

      setLoading(false);
      clearForm();

      Alert.alert(
        "Password aggiornata",
        "La tua password è stata modificata. La password originale generata resta visibile solo all’admin.",
      );
    } catch (error) {
      setLoading(false);
      Alert.alert("Errore", "Non è stato possibile aggiornare la password.");
    }
  };

  const handleLogout = async () => {
    await AsyncStorage.multiRemove([
      "isLogged",
      "loggedUser",
      "teacherUsername",
      "teacherId",
      "teacherFullName",
      "danceSchool",
    ]);

    router.replace("/login");
  };

  return (
    <KeyboardAvoidingView
      style={[styles.wrapper, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="chevron-back-outline" size={24} color={colors.text} />
          <Text style={[styles.backText, { color: colors.text }]}>Indietro</Text>
        </TouchableOpacity>

        <Text style={[styles.title, { color: colors.text }]}>Impostazioni</Text>

        <Text style={[styles.subtitle, { color: colors.secondary }]}>
          Gestisci password e accesso. Le modifiche sono sincronizzate live.
        </Text>

        <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Ionicons
            name={role === "admin" ? "shield-checkmark-outline" : "person"}
            size={30}
            color={colors.primary}
          />

          <View style={styles.infoTextBox}>
            <Text style={[styles.infoTitle, { color: colors.text }]}>
              {role === "admin" ? "Account admin" : "Account maestro"}
            </Text>

            <Text style={[styles.infoText, { color: colors.secondary }]}>
              {role === "admin"
                ? "Puoi modificare la password admin."
                : currentTeacher
                  ? `${currentTeacher.firstName} ${currentTeacher.lastName} • ${currentTeacher.danceSchool}`
                  : teacherUsername || "Maestro"}
            </Text>
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Tema App</Text>

          <TouchableOpacity style={[styles.saveButton, { backgroundColor: colors.primaryDark }]} onPress={toggleTheme}>
            <Ionicons
              name={isDark ? "sunny" : "moon"}
              size={22}
              color={colors.text}
            />

            <Text style={styles.saveButtonText}>
              {isDark ? "Passa al tema chiaro" : "Passa al tema scuro"}
            </Text>
          </TouchableOpacity>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Cambia password</Text>

          <Text style={[styles.label, { color: colors.text }]}>Password attuale</Text>

          <View style={[styles.passwordBox, { backgroundColor: colors.input, borderColor: colors.border }]}>
            <TextInput
              style={[styles.passwordInput, { color: colors.text }]}
              placeholder="Inserisci password attuale"
              placeholderTextColor={colors.muted}
              value={currentPassword}
              onChangeText={setCurrentPassword}
              secureTextEntry={!showCurrentPassword}
              autoCapitalize="none"
            />

            <TouchableOpacity
              style={styles.eyeButton}
              onPress={() => setShowCurrentPassword(!showCurrentPassword)}
            >
              <Ionicons
                name={showCurrentPassword ? "eye-off-outline" : "eye-outline"}
                size={22}
                color={colors.secondary}
              />
            </TouchableOpacity>
          </View>

          <Text style={[styles.label, { color: colors.text }]}>Nuova password</Text>

          <View style={[styles.passwordBox, { backgroundColor: colors.input, borderColor: colors.border }]}>
            <TextInput
              style={[styles.passwordInput, { color: colors.text }]}
              placeholder="Inserisci nuova password"
              placeholderTextColor={colors.muted}
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry={!showNewPassword}
              autoCapitalize="none"
            />

            <TouchableOpacity
              style={styles.eyeButton}
              onPress={() => setShowNewPassword(!showNewPassword)}
            >
              <Ionicons
                name={showNewPassword ? "eye-off-outline" : "eye-outline"}
                size={22}
                color={colors.secondary}
              />
            </TouchableOpacity>
          </View>

          <Text style={[styles.label, { color: colors.text }]}>Conferma nuova password</Text>

          <View style={[styles.passwordBox, { backgroundColor: colors.input, borderColor: colors.border }]}>
            <TextInput
              style={[styles.passwordInput, { color: colors.text }]}
              placeholder="Conferma nuova password"
              placeholderTextColor={colors.muted}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={!showConfirmPassword}
              autoCapitalize="none"
            />

            <TouchableOpacity
              style={styles.eyeButton}
              onPress={() => setShowConfirmPassword(!showConfirmPassword)}
            >
              <Ionicons
                name={showConfirmPassword ? "eye-off-outline" : "eye-outline"}
                size={22}
                color={colors.secondary}
              />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.saveButton, loading && styles.saveButtonDisabled]}
            onPress={changePassword}
            disabled={loading}
          >
            <Ionicons
              name={loading ? "hourglass-outline" : "save-outline"}
              size={22}
              color={colors.text}
            />

            <Text style={styles.saveButtonText}>
              {loading ? "Salvataggio..." : "Aggiorna password"}
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={[styles.logoutButton, { backgroundColor: colors.danger }]} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={22} color={colors.text} />
          <Text style={styles.logoutButtonText}>Logout</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: colors.background,
  },

  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  content: {
    paddingTop: 52,
    paddingHorizontal: 22,
    paddingBottom: 120,
  },

  backButton: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 24,
  },

  backText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "800",
    marginLeft: 6,
  },

  title: {
    color: colors.text,
    fontSize: 38,
    fontWeight: "900",
    marginBottom: 10,
  },

  subtitle: {
    color: colors.secondary,
    fontSize: 16,
    lineHeight: 23,
    marginBottom: 24,
  },

  infoCard: {
    backgroundColor: colors.card,
    borderRadius: 24,
    padding: 18,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: "row",
    alignItems: "center",
  },

  infoTextBox: {
    flex: 1,
    marginLeft: 14,
  },

  infoTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900",
    marginBottom: 4,
  },

  infoText: {
    color: colors.secondary,
    fontSize: 14,
    fontWeight: "800",
    lineHeight: 20,
  },

  card: {
    backgroundColor: colors.card,
    borderRadius: 28,
    padding: 20,
    marginBottom: 22,
  },

  cardTitle: {
    color: colors.text,
    fontSize: 24,
    fontWeight: "900",
    marginBottom: 18,
  },

  label: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "900",
    marginBottom: 8,
  },

  passwordBox: {
    backgroundColor: colors.background,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },

  passwordInput: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 16,
    color: colors.text,
    fontSize: 16,
  },

  eyeButton: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },

  saveButton: {
    backgroundColor: colors.primary,
    borderRadius: 20,
    paddingVertical: 18,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    marginTop: 8,
  },

  saveButtonDisabled: {
    opacity: 0.6,
  },

  saveButtonText: {
    color: colors.onPrimary,
    fontSize: 16,
    fontWeight: "900",
    marginLeft: 8,
  },

  logoutButton: {
    backgroundColor: colors.danger,
    borderRadius: 20,
    paddingVertical: 18,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },

  logoutButtonText: {
    color: colors.onPrimary,
    fontSize: 16,
    fontWeight: "900",
    marginLeft: 8,
  },
});
