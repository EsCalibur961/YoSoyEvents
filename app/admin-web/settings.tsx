import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
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

import { useFeedback } from "../../contexts/FeedbackContext";
import { useTheme } from "../../contexts/ThemeContext";
import { db } from "../../firebase";
import { hashPassword } from "../../utils/hash";

export default function AdminWebSettingsScreen() {
  const { colors, isDark, toggleTheme } = useTheme();
  const { width } = useWindowDimensions();
  const { success, error, warning, confirm } = useFeedback();
  const isMobile = width < 700;
  const styles = createStyles(isMobile);
  const [adminPassword, setAdminPassword] = useState("admin");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(
    () =>
      onSnapshot(doc(db, "settings", "adminAuth"), (snapshot) => {
        if (snapshot.exists()) setAdminPassword(snapshot.data().password || "admin");
      }),
    [],
  );

  const changePassword = async () => {
    if (!currentPassword.trim() || !newPassword.trim() || !confirmPassword.trim()) {
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

    const passwordMatches = adminPassword.length === 64
      ? hashPassword(currentPassword.trim()) === adminPassword
      : currentPassword.trim() === adminPassword;
    if (!passwordMatches) {
      error("Password errata", "La password attuale non è corretta.");
      return;
    }

    try {
      setLoading(true);
      await setDoc(
        doc(db, "settings", "adminAuth"),
        { password: hashPassword(newPassword.trim()), updatedAt: serverTimestamp() },
        { merge: true },
      );
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      success("Password aggiornata", "La password admin è stata modificata correttamente.");
    } catch (caughtError) {
      console.log("ADMIN PASSWORD ERROR:", caughtError);
      error("Aggiornamento non riuscito", "Non è stato possibile aggiornare la password.");
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    await AsyncStorage.multiRemove([
      "isLogged", "loggedUser", "loggedUserName", "adminName", "adminProfileImage", "profileImage",
    ]);
    router.replace("/web/login");
  };

  const PasswordField = ({
    label,
    value,
    onChangeText,
    visible,
    toggle,
  }: {
    label: string;
    value: string;
    onChangeText: (value: string) => void;
    visible: boolean;
    toggle: () => void;
  }) => (
    <View style={styles.fieldGroup}>
      <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
      <View style={[styles.passwordBox, { backgroundColor: colors.input, borderColor: colors.border }]}>
        <TextInput
          style={[styles.passwordInput, { color: colors.text }]}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={!visible}
          autoCapitalize="none"
          placeholder={label}
          placeholderTextColor={colors.muted}
        />
        <TouchableOpacity accessibilityLabel={`${visible ? "Nascondi" : "Mostra"} ${label.toLowerCase()}`} style={styles.eyeButton} onPress={toggle}>
          <Ionicons name={visible ? "eye-off-outline" : "eye-outline"} size={21} color={colors.secondary} />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={[styles.content, isMobile && styles.contentMobile]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.header, isMobile && styles.headerMobile]}>
          <View style={styles.headerCopy}>
            <Text style={[styles.eyebrow, { color: colors.primary }]}>YO SOY EVENTS / ADMIN WEB</Text>
            <Text style={[styles.title, isMobile && styles.titleMobile, { color: colors.text }]}>Impostazioni</Text>
            <Text style={[styles.subtitle, { color: colors.secondary }]}>Tema, password e sicurezza dell’account amministratore.</Text>
          </View>
          <TouchableOpacity style={[styles.backButton, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => router.replace("/admin-web")}>
            <Ionicons name="grid-outline" size={18} color={colors.primary} />
            <Text style={[styles.backText, { color: colors.primary }]}>Dashboard</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.infoIcon, { backgroundColor: `${colors.primary}16` }]}>
            <Ionicons name="shield-checkmark-outline" size={27} color={colors.primary} />
          </View>
          <View style={styles.infoCopy}>
            <Text style={[styles.infoTitle, { color: colors.text }]}>Account amministratore</Text>
            <Text style={[styles.infoText, { color: colors.secondary }]}>Le modifiche alla password sono sincronizzate live.</Text>
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Aspetto</Text>
          <TouchableOpacity style={[styles.actionButton, { backgroundColor: `${colors.primary}14`, borderColor: `${colors.primary}35` }]} onPress={toggleTheme}>
            <Ionicons name={isDark ? "sunny-outline" : "moon-outline"} size={20} color={colors.primary} />
            <Text style={[styles.actionText, { color: colors.primary }]}>{isDark ? "Passa al tema chiaro" : "Passa al tema scuro"}</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Cambia password</Text>
          <PasswordField label="Password attuale" value={currentPassword} onChangeText={setCurrentPassword} visible={showCurrent} toggle={() => setShowCurrent((value) => !value)} />
          <PasswordField label="Nuova password" value={newPassword} onChangeText={setNewPassword} visible={showNew} toggle={() => setShowNew((value) => !value)} />
          <PasswordField label="Conferma nuova password" value={confirmPassword} onChangeText={setConfirmPassword} visible={showConfirm} toggle={() => setShowConfirm((value) => !value)} />
          <TouchableOpacity style={[styles.saveButton, { backgroundColor: colors.primary }, loading && styles.disabled]} onPress={changePassword} disabled={loading}>
            <Ionicons name={loading ? "hourglass-outline" : "save-outline"} size={20} color={colors.onPrimary} />
            <Text style={[styles.saveText, { color: colors.onPrimary }]}>{loading ? "Salvataggio…" : "Aggiorna password"}</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.logoutButton, { borderColor: `${colors.danger}45`, backgroundColor: `${colors.danger}10` }]}
          onPress={() => confirm({ title: "Uscire da YoSoyEvents?", message: "Dovrai effettuare nuovamente l’accesso.", confirmText: "Logout", cancelText: "Annulla", destructive: true, onConfirm: logout })}
        >
          <Ionicons name="log-out-outline" size={20} color={colors.danger} />
          <Text style={[styles.logoutText, { color: colors.danger }]}>Logout</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (isMobile: boolean) => StyleSheet.create({
  content: { width: "100%", maxWidth: 920, minWidth: 0, alignSelf: "center", padding: 28, paddingBottom: 80 },
  contentMobile: { padding: 14, paddingBottom: 48 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 18, marginBottom: 20 },
  headerMobile: { flexDirection: "column", gap: 13 },
  headerCopy: { flex: 1, minWidth: 0 },
  eyebrow: { fontSize: 9, fontWeight: "900", letterSpacing: 1.2, marginBottom: 6 },
  title: { fontSize: 32, fontWeight: "900" },
  titleMobile: { fontSize: 26, lineHeight: 31 },
  subtitle: { fontSize: 12, lineHeight: 18, fontWeight: "700", marginTop: 6 },
  backButton: { minHeight: 42, borderRadius: 14, borderWidth: 1, paddingHorizontal: 13, flexDirection: "row", alignItems: "center" },
  backText: { fontSize: 10, fontWeight: "900", marginLeft: 6 },
  infoCard: { width: "100%", minWidth: 0, borderWidth: 1, borderRadius: 20, padding: 16, flexDirection: "row", alignItems: "center", marginBottom: 14 },
  infoIcon: { width: 48, height: 48, borderRadius: 15, alignItems: "center", justifyContent: "center", marginRight: 12 },
  infoCopy: { flex: 1, minWidth: 0 },
  infoTitle: { fontSize: 15, fontWeight: "900" },
  infoText: { fontSize: 10, lineHeight: 15, fontWeight: "700", marginTop: 3 },
  card: { width: "100%", minWidth: 0, borderWidth: 1, borderRadius: 20, padding: isMobile ? 14 : 18, marginBottom: 14 },
  cardTitle: { fontSize: 16, fontWeight: "900", marginBottom: 14 },
  actionButton: { minHeight: 48, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, flexDirection: "row", alignItems: "center" },
  actionText: { flex: 1, minWidth: 0, marginLeft: 9, fontSize: 11, fontWeight: "900" },
  fieldGroup: { width: "100%", minWidth: 0, marginBottom: 13 },
  label: { fontSize: 10, fontWeight: "900", marginBottom: 7 },
  passwordBox: { width: "100%", minWidth: 0, minHeight: 50, borderWidth: 1, borderRadius: 14, flexDirection: "row", alignItems: "center" },
  passwordInput: { flex: 1, minWidth: 0, paddingHorizontal: 13, paddingVertical: 12, fontSize: 13, outlineStyle: "none" as any },
  eyeButton: { width: 48, height: 48, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  saveButton: { minHeight: 50, borderRadius: 14, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", marginTop: 3 },
  saveText: { fontSize: 11, fontWeight: "900", marginLeft: 8 },
  disabled: { opacity: 0.55 },
  logoutButton: { minHeight: 50, borderRadius: 14, borderWidth: 1, flexDirection: "row", alignItems: "center", justifyContent: "center" },
  logoutText: { fontSize: 11, fontWeight: "900", marginLeft: 7 },
});
