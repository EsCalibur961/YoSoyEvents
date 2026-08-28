import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useFocusEffect } from "expo-router";
import {
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc
} from "firebase/firestore";
import { useCallback, useState } from "react";
import {
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
import { useTheme } from "../../../contexts/ThemeContext";
import { useFeedback } from "../../../contexts/FeedbackContext";
import { db } from "../../../firebase";
import { hashPassword } from "../../../utils/hash";

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

export default function TeacherWebSettingsScreen() {
  const { colors, isDark, toggleTheme } = useTheme();
  const { width } = useWindowDimensions();
  const { success, error, warning, confirm } = useFeedback();
  const styles = createStyles(colors, isDark, width < 700);
  const [role, setRole] = useState<string | null>(null);
  const [teacherUsername, setTeacherUsername] = useState<string | null>(null);
  const [teacherId, setTeacherId] = useState<string | null>(null);

  const [currentTeacher, setCurrentTeacher] = useState<TeacherUser | null>(null);
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
      let unsubTeacher = () => {};

      const loadUserAndSubscribe = async () => {
        const savedRole = await AsyncStorage.getItem("loggedUser");
        const savedTeacherUsername = await AsyncStorage.getItem("teacherUsername");
        const savedTeacherId = await AsyncStorage.getItem("teacherId");

        setRole(savedRole);
        setTeacherUsername(savedTeacherUsername);
        setTeacherId(savedTeacherId);

        if (savedRole === "teacher" && savedTeacherId) {
          unsubTeacher = onSnapshot(
            doc(db, "teachers", savedTeacherId),
            (docSnap) => {
              if (docSnap.exists()) {
                const teacherData = {
                  id: docSnap.id,
                  ...(docSnap.data() as Omit<TeacherUser, "id">),
                };
                setCurrentTeacher(teacherData);
              }
            },
          );
        }
      };

      loadUserAndSubscribe();

      const unsubAdmin = onSnapshot(
        doc(db, "settings", "adminAuth"),
        (snap) => {
          if (snap.exists()) {
            const data = snap.data() as AdminSettings;
            setAdminPassword(data.password || "admin");
          }
        },
      );

      return () => {
        unsubAdmin();
        unsubTeacher();
      };
    }, []),
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
      warning("Campi mancanti", "Compila tutti i campi password.");
      return;
    }

    if (newPassword !== confirmPassword) {
      warning("Password non coincidenti", "Le nuove password non coincidono.");
      return;
    }

    if (newPassword.length < 6) {
      warning("Password debole", "La nuova password deve avere almeno 6 caratteri.");
      return;
    }

    try {
      setLoading(true);

      if (role === "admin") {
        const isAdminPasswordHashed = adminPassword.length === 64;
        const isPasswordCorrect = isAdminPasswordHashed
          ? hashPassword(currentPassword.trim()) === adminPassword
          : currentPassword.trim() === adminPassword;

        if (!isPasswordCorrect) {
          setLoading(false);
          error("Password errata", "La password attuale non è corretta.");
          return;
        }

        await setDoc(
          doc(db, "settings", "adminAuth"),
          {
            password: hashPassword(newPassword.trim()),
            updatedAt: serverTimestamp(),
          },
          { merge: true },
        );

        setLoading(false);
        clearForm();

        success("Password aggiornata", "La password admin è stata modificata correttamente.");
        return;
      }

      const idToUpdate = teacherId || currentTeacher?.id;

      if (!idToUpdate || !currentTeacher) {
        setLoading(false);
        error("Maestro non trovato", "Non è stato possibile trovare il profilo maestro.");
        return;
      }

      const isTeacherPasswordHashed = currentTeacher.password?.length === 64;
      const isTeacherPasswordCorrect = isTeacherPasswordHashed
        ? hashPassword(currentPassword.trim()) === currentTeacher.password
        : currentPassword.trim() === currentTeacher.password;

      if (!isTeacherPasswordCorrect) {
        setLoading(false);
        error("Password errata", "La password attuale non è corretta.");
        return;
      }

      await updateDoc(doc(db, "teachers", idToUpdate), {
        password: hashPassword(newPassword.trim()),
        mustChangePassword: false,
        updatedAt: serverTimestamp(),
      });

      setLoading(false);
      clearForm();

      success(
        "Password aggiornata",
        "La tua password è stata modificata. La password originale generata resta visibile solo all’admin.",
      );
    } catch (caughtError) {
      setLoading(false);
      console.log("CHANGE PASSWORD ERROR:", caughtError);
      error("Aggiornamento non riuscito", "Non è stato possibile aggiornare la password.");
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

    router.replace("/web/login");
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
        <View style={styles.webHeader}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.webEyebrow, { color: colors.primary }]}>
              YO SOY EVENTS / WEB MAESTRO
            </Text>
            <Text style={[styles.title, { color: colors.text }]}>Impostazioni</Text>
            <Text style={[styles.subtitle, { color: colors.secondary }]}>
              Tema, password e sicurezza del tuo account maestro.
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.backButton, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => router.replace("/web/teacher/profile")}
          >
            <Ionicons name="person-circle-outline" size={19} color={colors.primary} />
            <Text style={[styles.backText, { color: colors.primary }]}>Profilo</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Ionicons
            name={role === "admin" ? "shield-checkmark-outline" : "person"}
            size={30}
            color={colors.primary}
          />

          <View style={styles.infoTextBox}>
            <Text style={[styles.infoTitle, { color: colors.text }]}>
              Account maestro
            </Text>

            <Text style={[styles.infoText, { color: colors.secondary }]}>
              {currentTeacher
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

        {width >= 700 ? <TouchableOpacity
          style={[styles.logoutButton, { backgroundColor: colors.danger }]}
          onPress={() =>
            confirm({
              title: "Uscire da YoSoyEvents?",
              message: "Dovrai effettuare nuovamente l’accesso per rientrare nell’app.",
              confirmText: "Logout",
              cancelText: "Annulla",
              destructive: true,
              onConfirm: handleLogout,
            })
          }
        >
          <Ionicons name="log-out-outline" size={22} color={colors.text} />
          <Text style={styles.logoutButtonText}>Logout</Text>
        </TouchableOpacity> : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (colors: any, isDark: boolean, isMobile: boolean) => StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: colors.background,
  },

  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  content: {
    width: "100%",
    maxWidth: 920,
    alignSelf: "center",
    paddingTop: 30,
    paddingHorizontal: isMobile ? 14 : 28,
    paddingBottom: 90,
  },

  webHeader: {
    flexDirection: isMobile ? "column" : "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 20,
    marginBottom: 20,
  },

  webEyebrow: {
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.2,
    marginBottom: 6,
  },

  backButton: {
    minHeight: 42,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 13,
    flexDirection: "row",
    alignItems: "center",
  },

  backText: {
    fontSize: 9,
    fontWeight: "900",
    marginLeft: 6,
  },

  title: {
    color: colors.text,
    fontSize: 32,
    fontWeight: "900",
    marginBottom: 5,
  },

  subtitle: {
    color: colors.secondary,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
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
    borderRadius: 20,
    padding: 20,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: colors.border,
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
    borderRadius: 18,
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
    borderRadius: 18,
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
