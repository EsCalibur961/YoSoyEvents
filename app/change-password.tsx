import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { doc, updateDoc } from "firebase/firestore";
import { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
} from "react-native";
import { useTheme } from "../contexts/ThemeContext";
import { db } from "../firebase";
import { hashPassword } from "../utils/hash";

export default function ChangePasswordScreen() {
  const { colors, isDark } = useTheme();
  const styles = createStyles(colors, isDark);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const savePassword = async () => {
    if (!newPassword.trim() || !confirmPassword.trim()) {
      Alert.alert("Campi mancanti", "Inserisci e conferma la nuova password.");
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert("Errore", "Le password non coincidono.");
      return;
    }

    if (newPassword.length < 6) {
      Alert.alert("Password debole", "Inserisci almeno 6 caratteri.");
      return;
    }

    setLoading(true);

    try {
      const teacherId = await AsyncStorage.getItem("teacherId");

      if (!teacherId) {
        setLoading(false);
        Alert.alert("Errore", "Utente maestro non trovato.");
        return;
      }

      await updateDoc(doc(db, "teachers", teacherId), {
        password: hashPassword(newPassword.trim()),
        mustChangePassword: false,
      });

      setLoading(false);

      Alert.alert("Password aggiornata", "Ora puoi usare l’app.", [
        {
          text: "Continua",
          onPress: () => router.replace("/"),
        },
      ]);
    } catch (error) {
      setLoading(false);
      Alert.alert("Errore", "Non è stato possibile aggiornare la password.");
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.wrapper}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <Ionicons name="lock-closed-outline" size={64} color={colors.primary} />

        <Text style={styles.title}>Cambia password</Text>

        <Text style={styles.subtitle}>
          Al primo accesso devi impostare una nuova password personale.
        </Text>

        <TextInput
          style={styles.input}
          placeholder="Nuova password"
          placeholderTextColor={colors.placeholder}
          value={newPassword}
          onChangeText={setNewPassword}
          secureTextEntry
        />

        <TextInput
          style={styles.input}
          placeholder="Conferma password"
          placeholderTextColor={colors.placeholder}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
        />

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={savePassword}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? "Salvataggio..." : "Salva password"}
          </Text>
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
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 50,
  },

  title: {
    color: colors.text,
    fontSize: 36,
    fontWeight: "900",
    marginTop: 24,
    marginBottom: 10,
  },

  subtitle: {
    color: colors.secondary,
    fontSize: 16,
    lineHeight: 23,
    marginBottom: 28,
  },

  input: {
    backgroundColor: colors.card,
    borderRadius: 20,
    paddingVertical: 16,
    paddingHorizontal: 16,
    color: colors.text,
    fontSize: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },

  button: {
    backgroundColor: colors.primary,
    borderRadius: 22,
    paddingVertical: 18,
    alignItems: "center",
    marginTop: 8,
  },

  buttonDisabled: {
    opacity: 0.7,
  },

  buttonText: {
    color: colors.onPrimary,
    fontSize: 17,
    fontWeight: "900",
  },
});
