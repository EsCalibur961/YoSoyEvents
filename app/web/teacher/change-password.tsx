import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { doc, updateDoc } from "firebase/firestore";
import { useState } from "react";
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

import { useFeedback } from "../../../contexts/FeedbackContext";
import { useTheme } from "../../../contexts/ThemeContext";
import { db } from "../../../firebase";
import { hashPassword } from "../../../utils/hash";

export default function TeacherWebChangePasswordScreen() {
  const { colors } = useTheme();
  const { success, error, warning } = useFeedback();
  const { width } = useWindowDimensions();
  const isMobile = width < 700;
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const savePassword = async () => {
    if (!newPassword.trim() || !confirmPassword.trim()) {
      warning("Campi mancanti", "Inserisci e conferma la nuova password.");
      return;
    }
    if (newPassword !== confirmPassword) {
      warning("Password non coincidenti", "Le password non coincidono.");
      return;
    }
    if (newPassword.length < 6) {
      warning("Password debole", "Inserisci almeno 6 caratteri.");
      return;
    }

    try {
      setLoading(true);
      const teacherId = await AsyncStorage.getItem("teacherId");
      if (!teacherId) {
        error("Maestro non trovato", "La sessione maestro non è disponibile.");
        router.replace("/web/login");
        return;
      }

      await updateDoc(doc(db, "teachers", teacherId), {
        password: hashPassword(newPassword.trim()),
        mustChangePassword: false,
      });

      success("Password aggiornata", "La nuova password è stata salvata correttamente.");
      setTimeout(() => router.replace("/web/teacher"), 650);
    } catch (caughtError) {
      console.log("FIRST PASSWORD CHANGE ERROR:", caughtError);
      error("Aggiornamento non riuscito", "Non è stato possibile aggiornare la password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={[styles.content, isMobile && styles.contentMobile]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.card, isMobile && styles.cardMobile, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.iconBox, { backgroundColor: `${colors.primary}14` }]}>
            <Ionicons name="shield-checkmark-outline" size={42} color={colors.primary} />
          </View>
          <Text style={[styles.eyebrow, { color: colors.primary }]}>PRIMO ACCESSO MAESTRO</Text>
          <Text style={[styles.title, isMobile && styles.titleMobile, { color: colors.text }]}>Crea la tua password</Text>
          <Text style={[styles.subtitle, { color: colors.secondary }]}>
            Prima di entrare nell’area Web devi sostituire la password temporanea con una password personale.
          </Text>

          <Text style={[styles.label, { color: colors.text }]}>Nuova password</Text>
          <View style={[styles.inputBox, { backgroundColor: colors.input, borderColor: colors.border }]}>
            <TextInput
              style={[styles.input, { color: colors.text }]}
              placeholder="Nuova password"
              placeholderTextColor={colors.muted}
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity accessibilityLabel={showPassword ? "Nascondi password" : "Mostra password"} style={styles.eyeButton} onPress={() => setShowPassword((value) => !value)}>
              <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={21} color={colors.secondary} />
            </TouchableOpacity>
          </View>

          <Text style={[styles.label, { color: colors.text }]}>Conferma password</Text>
          <View style={[styles.inputBox, { backgroundColor: colors.input, borderColor: colors.border }]}>
            <TextInput
              style={[styles.input, { color: colors.text }]}
              placeholder="Conferma password"
              placeholderTextColor={colors.muted}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
              onSubmitEditing={savePassword}
            />
          </View>

          <TouchableOpacity
            style={[styles.button, { backgroundColor: colors.primary }, loading && styles.buttonDisabled]}
            onPress={savePassword}
            disabled={loading}
          >
            <Ionicons name={loading ? "hourglass-outline" : "save-outline"} size={20} color={colors.onPrimary} />
            <Text style={[styles.buttonText, { color: colors.onPrimary }]}>
              {loading ? "Salvataggio…" : "Salva e continua"}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, minHeight: "100vh" as any },
  content: { flexGrow: 1, width: "100%", padding: 32, alignItems: "center", justifyContent: "center" },
  contentMobile: { padding: 14 },
  card: { width: "100%", maxWidth: 560, borderWidth: 1, borderRadius: 26, padding: 28 },
  cardMobile: { padding: 18, borderRadius: 20 },
  iconBox: { width: 70, height: 70, borderRadius: 22, alignItems: "center", justifyContent: "center", marginBottom: 20 },
  eyebrow: { fontSize: 9, fontWeight: "900", letterSpacing: 1.3, marginBottom: 8 },
  title: { fontSize: 34, lineHeight: 40, fontWeight: "900" },
  titleMobile: { fontSize: 27, lineHeight: 33 },
  subtitle: { fontSize: 13, lineHeight: 20, fontWeight: "700", marginTop: 9, marginBottom: 24 },
  label: { fontSize: 10, fontWeight: "900", marginBottom: 7 },
  inputBox: { width: "100%", minWidth: 0, minHeight: 52, borderWidth: 1, borderRadius: 15, flexDirection: "row", alignItems: "center", marginBottom: 15 },
  input: { flex: 1, minWidth: 0, paddingHorizontal: 14, paddingVertical: 13, fontSize: 14, outlineStyle: "none" as any },
  eyeButton: { width: 50, height: 50, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  button: { minHeight: 52, borderRadius: 15, flexDirection: "row", alignItems: "center", justifyContent: "center", marginTop: 5 },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { fontSize: 12, fontWeight: "900", marginLeft: 8 },
});
