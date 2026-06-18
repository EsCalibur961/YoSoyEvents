import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { useState } from "react";
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { useTheme } from "../contexts/ThemeContext";
import { hashPassword } from "../utils/hash";

type TeacherUser = {
  id: number;
  username: string;
  danceSchool: string;
  password: string;
  mustChangePassword: boolean;
};

export default function ChangeTeacherPasswordScreen() {
  const { colors, isDark } = useTheme();
  const styles = createStyles(colors, isDark);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const saveNewPassword = async () => {
    if (newPassword.length < 8) {
      Alert.alert(
        "Password troppo corta",
        "La nuova password deve avere almeno 8 caratteri.",
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert("Errore", "Le password non coincidono.");
      return;
    }

    const teacherUsername = await AsyncStorage.getItem("teacherUsername");
    const savedTeachers = await AsyncStorage.getItem("teachers");

    if (!teacherUsername || !savedTeachers) {
      Alert.alert("Errore", "Sessione maestro non trovata.");
      router.replace("/login");
      return;
    }

    const teachers: TeacherUser[] = JSON.parse(savedTeachers);

    const updatedTeachers = teachers.map((teacher) =>
      teacher.username === teacherUsername
        ? {
            ...teacher,
            password: hashPassword(newPassword.trim()),
            mustChangePassword: false,
          }
        : teacher,
    );

    await AsyncStorage.setItem("teachers", JSON.stringify(updatedTeachers));

    Alert.alert(
      "Password aggiornata",
      "Ora puoi accedere alla tua area maestro.",
    );

    router.replace("/(tabs)");
  };

  return (
    <KeyboardAvoidingView
      style={styles.keyboardView}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.card}>
            <View style={styles.iconBox}>
              <Ionicons
                name="shield-checkmark-outline"
                size={52}
                color={colors.primary}
              />
            </View>

            <Text style={styles.title}>Cambia password</Text>

            <Text style={styles.subtitle}>
              Al primo accesso devi impostare una nuova password personale.
            </Text>

            <Text style={styles.label}>NUOVA PASSWORD</Text>

            <View style={styles.inputBox}>
              <Ionicons
                name="lock-closed-outline"
                size={22}
                color={colors.placeholder}
              />

              <TextInput
                style={styles.input}
                placeholder="Nuova password"
                placeholderTextColor={colors.placeholder}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                value={newPassword}
                onChangeText={setNewPassword}
              />

              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                <Ionicons
                  name={showPassword ? "eye-off-outline" : "eye-outline"}
                  size={22}
                  color={colors.placeholder}
                />
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>CONFERMA PASSWORD</Text>

            <View style={styles.inputBox}>
              <Ionicons
                name="lock-closed-outline"
                size={22}
                color={colors.placeholder}
              />

              <TextInput
                style={styles.input}
                placeholder="Conferma password"
                placeholderTextColor={colors.placeholder}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
              />
            </View>

            <TouchableOpacity style={styles.button} onPress={saveNewPassword}>
              <Text style={styles.buttonText}>Salva nuova password</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}

const createStyles = (colors: any, isDark: boolean) =>
  StyleSheet.create({
    keyboardView: {
      flex: 1,
      backgroundColor: "#1C1513",
    },

    container: {
      flex: 1,
      backgroundColor: "#1C1513",
    },

    content: {
      flexGrow: 1,
      justifyContent: "center",
      padding: 24,
      paddingTop: 70,
      paddingBottom: 120,
    },

    card: {
      backgroundColor: "#241C19",
      borderRadius: 34,
      padding: 24,
      borderWidth: 1,
      borderColor: "#3A2D28",
    },

    iconBox: {
      width: 90,
      height: 90,
      borderRadius: 45,
      backgroundColor: "#1C1513",
      alignItems: "center",
      justifyContent: "center",
      alignSelf: "center",
      marginBottom: 22,
    },

    title: {
      color: colors.text,
      fontSize: 34,
      fontWeight: "900",
      textAlign: "center",
      marginBottom: 10,
    },

    subtitle: {
      color: "#D8CCC7",
      fontSize: 15,
      textAlign: "center",
      lineHeight: 22,
      marginBottom: 28,
    },

    label: {
      color: colors.text,
      fontSize: 13,
      fontWeight: "900",
      letterSpacing: 2,
      marginBottom: 10,
      marginTop: 8,
    },

    inputBox: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: "#1C1513",
      borderRadius: 18,
      borderWidth: 1,
      borderColor: "#3A2D28",
      paddingHorizontal: 16,
      marginBottom: 20,
    },

    input: {
      flex: 1,
      color: colors.text,
      fontSize: 16,
      paddingVertical: 17,
      paddingHorizontal: 12,
    },

    button: {
      backgroundColor: colors.primary,
      borderRadius: 18,
      paddingVertical: 17,
      alignItems: "center",
      marginTop: 4,
    },

    buttonText: {
      color: colors.onPrimary,
      fontSize: 17,
      fontWeight: "900",
    },
  });
