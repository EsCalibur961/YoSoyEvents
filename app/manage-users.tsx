import { Ionicons } from "@expo/vector-icons";
import * as Contacts from "expo-contacts";
import { router } from "expo-router";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import {
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useTheme } from "../contexts/ThemeContext";
import { db } from "../firebase";
import { hashPassword } from "../utils/hash";

type TeacherUser = {
  id: string;
  username: string;
  password: string;
  initialPassword?: string;
  firstName: string;
  lastName: string;
  danceSchool: string;
  whatsapp?: string;
  profileImage?: string;
  mustChangePassword: boolean;
  isOnline?: boolean;
  lastSeen?: any;
};

export default function ManageUsersScreen() {
  const { colors, isDark } = useTheme();
  const styles = createStyles(colors, isDark);
  const pickWhatsappFromContacts = async () => {
    const { status } = await Contacts.requestPermissionsAsync();

    if (status !== "granted") {
      Alert.alert("Permesso negato", "Autorizza l'accesso alla rubrica.");
      return;
    }

    const contact = await Contacts.presentContactPickerAsync();

    if (!contact) return;

    const phone = contact.phoneNumbers?.[0]?.number?.replace(/\s/g, "") || "";

    if (!phone) {
      Alert.alert("Errore", "Questo contatto non ha un numero.");
      return;
    }

    setWhatsapp(phone);
  };
  const [teachers, setTeachers] = useState<TeacherUser[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [initialPassword, setInitialPassword] = useState("");

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [danceSchool, setDanceSchool] = useState("");
  const [whatsapp, setWhatsapp] = useState("");

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "teachers"), (snapshot) => {
      const data: TeacherUser[] = snapshot.docs.map((docItem) => ({
        id: docItem.id,
        ...(docItem.data() as Omit<TeacherUser, "id">),
      }));

      setTeachers(data);
    });

    return unsubscribe;
  }, []);

  const generatePassword = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

    let result = "";

    for (let i = 0; i < 10; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    setPassword(result);
    setInitialPassword(result);
  };

  const resetForm = () => {
    setEditingId(null);
    setUsername("");
    setPassword("");
    setInitialPassword("");
    setFirstName("");
    setLastName("");
    setDanceSchool("");
    setWhatsapp("");
  };

  const normalizeWhatsapp = (value: string) => {
    return value.replace(/\s/g, "").replace("+", "");
  };

  const sendWhatsappCredentials = (teacher: TeacherUser) => {
    if (!teacher.whatsapp?.trim()) {
      Alert.alert(
        "WhatsApp mancante",
        "Inserisci un numero WhatsApp per questo maestro.",
      );
      return;
    }

    const number = normalizeWhatsapp(teacher.whatsapp);

    const message = `Ciao ${teacher.firstName}, ecco le tue credenziali per YoSoy Events:

Username: ${teacher.username}
Password: ${teacher.initialPassword || teacher.password}

Al primo accesso ti verrà chiesto di cambiare password.`;

    const url = `https://wa.me/${number}?text=${encodeURIComponent(message)}`;

    Linking.openURL(url).catch(() => {
      Alert.alert("Errore", "Non è stato possibile aprire WhatsApp.");
    });
  };

  const saveTeacher = async () => {
    if (
      !username.trim() ||
      !password.trim() ||
      !firstName.trim() ||
      !lastName.trim() ||
      !danceSchool.trim() ||
      !whatsapp.trim()
    ) {
      Alert.alert(
        "Campi mancanti",
        "Compila username, password, nome, cognome, scuola e WhatsApp.",
      );
      return;
    }

    try {
      const isAlreadyHashed = password.trim().length === 64;
      const finalPassword = isAlreadyHashed ? password.trim() : hashPassword(password.trim());

      const teacherData = {
        username: username.trim(),
        password: finalPassword,
        initialPassword: initialPassword.trim() || password.trim(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        danceSchool: danceSchool.trim(),
        whatsapp: whatsapp.trim(),
        mustChangePassword: editingId ? false : true,
        updatedAt: serverTimestamp(),
      };

      let createdTeacher: TeacherUser = {
        id: editingId || "",
        ...teacherData,
        profileImage: "",
      };

      if (editingId) {
        await updateDoc(doc(db, "teachers", editingId), teacherData);

        createdTeacher = {
          ...createdTeacher,
          id: editingId,
        };
      } else {
        const newDoc = await addDoc(collection(db, "teachers"), {
          ...teacherData,
          profileImage: "",
          createdAt: serverTimestamp(),
        });

        createdTeacher = {
          ...createdTeacher,
          id: newDoc.id,
        };
      }

      const number = normalizeWhatsapp(createdTeacher.whatsapp || "");

      const message = `Ciao ${createdTeacher.firstName},

ecco le tue credenziali per YoSoy Events:

Username: ${createdTeacher.username}

Password: ${createdTeacher.initialPassword || createdTeacher.password}

Al primo accesso ti verrà richiesto di cambiare password.`;

      const url = `https://wa.me/${number}?text=${encodeURIComponent(message)}`;

      resetForm();

      Linking.openURL(url);

      Alert.alert(
        "Maestro creato",
        "WhatsApp è stato aperto con le credenziali pronte da inviare.",
      );
    } catch (error) {
      Alert.alert("Errore", "Non è stato possibile salvare il maestro.");
    }
  };

  const editTeacher = (teacher: TeacherUser) => {
    setEditingId(teacher.id);
    setUsername(teacher.username);
    setPassword(teacher.password);
    setInitialPassword(teacher.initialPassword || teacher.password);
    setFirstName(teacher.firstName);
    setLastName(teacher.lastName);
    setDanceSchool(teacher.danceSchool);
    setWhatsapp(teacher.whatsapp || "");
  };
  const deleteTeacher = async (teacher: TeacherUser) => {
    try {
      Alert.alert(
        "Elimina maestro",
        `Vuoi eliminare ${teacher.firstName} ${teacher.lastName}? Verranno eliminati anche tutti i dati associati a questo maestro (stanze, pacchetti, pagamenti, notifiche, attività).`,
        [
          {
            text: "Annulla",
            style: "cancel",
          },
          {
            text: "Elimina",
            style: "destructive",
            onPress: async () => {
              try {
                const username = teacher.username;

                const collectionsToClean = ["roomsData", "roomAssignments"];

                for (const collectionName of collectionsToClean) {
                  const snapshot = await getDocs(
                    collection(db, collectionName),
                  );

                  for (const itemDoc of snapshot.docs) {
                    const data = itemDoc.data();

                    const belongsToTeacher =
                      data.teacherUsername === username ||
                      data.username === username ||
                      data.teacherId === teacher.id ||
                      data.assignedTo === username ||
                      data.assignedTeacher === username ||
                      data.teacher === username ||
                      data.userUsername === username ||
                      data.ownerUsername === username ||
                      data.createdBy === username;

                    if (belongsToTeacher) {
                      await deleteDoc(doc(db, collectionName, itemDoc.id));
                    }
                  }
                }

                await deleteDoc(doc(db, "teachers", teacher.id));

                Alert.alert("Successo", "Maestro eliminato completamente.");
              } catch (error) {
                console.error(error);

                Alert.alert("Errore", "Impossibile eliminare il maestro.");
              }
            },
          },
        ],
      );
    } catch (error) {
      console.error(error);
    }
  };

  const getTimestampMillis = (value: any) => {
    if (!value) return 0;
    if (typeof value?.toMillis === "function") return value.toMillis();
    if (value instanceof Date) return value.getTime();
    if (typeof value === "number") return value;

    const parsed = new Date(value).getTime();
    return Number.isNaN(parsed) ? 0 : parsed;
  };

  const isTeacherOnline = (teacher: TeacherUser) => {
    const lastSeenMillis = getTimestampMillis(teacher.lastSeen);
    const seenRecently = lastSeenMillis > 0 && Date.now() - lastSeenMillis < 90 * 1000;

    return Boolean(teacher.isOnline && seenRecently);
  };
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
        <Ionicons name="chevron-back-outline" size={24} color={colors.text} />
        <Text style={styles.backText}>Indietro</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Gestione utenti</Text>

      <Text style={styles.subtitle}>
        Crea e gestisci i maestri YoSoy con credenziali e WhatsApp.
      </Text>

      <View style={styles.formCard}>
        <Text style={styles.formTitle}>
          {editingId ? "Modifica maestro" : "Nuovo maestro"}
        </Text>

        <TextInput
          style={styles.input}
          placeholder="Username"
          placeholderTextColor={colors.placeholder}
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
        />

        <TextInput
          style={styles.input}
          placeholder="Nome"
          placeholderTextColor={colors.placeholder}
          value={firstName}
          onChangeText={setFirstName}
        />

        <TextInput
          style={styles.input}
          placeholder="Cognome"
          placeholderTextColor={colors.placeholder}
          value={lastName}
          onChangeText={setLastName}
        />

        <TextInput
          style={styles.input}
          placeholder="Scuola di ballo"
          placeholderTextColor={colors.placeholder}
          value={danceSchool}
          onChangeText={setDanceSchool}
        />

        <TextInput
          style={[styles.input, styles.whatsappInput]}
          placeholder="Numero WhatsApp"
          placeholderTextColor={colors.placeholder}
          value={whatsapp}
          onChangeText={setWhatsapp}
          keyboardType="phone-pad"
        />

        <TouchableOpacity
          style={styles.contactPickerButton}
          onPress={pickWhatsappFromContacts}
        >
          <Ionicons name="book-outline" size={22} color="#FFFFFF" />
          <Text style={styles.contactPickerText}>Scegli dalla rubrica</Text>
        </TouchableOpacity>

        <View style={styles.passwordRow}>
          <TextInput
            style={styles.passwordInput}
            placeholder="Password generata"
            placeholderTextColor={colors.placeholder}
            value={password}
            onChangeText={(value) => {
              setPassword(value);
              if (!editingId) {
                setInitialPassword(value);
              }
            }}
          />

          <TouchableOpacity
            style={styles.generateButton}
            onPress={generatePassword}
          >
            <Ionicons name="refresh-outline" size={22} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {editingId ? (
          <View style={styles.infoBox}>
            <Text style={styles.infoLabel}>Password generata originale</Text>

            <Text style={styles.infoValue}>
              {initialPassword || "Non disponibile"}
            </Text>
          </View>
        ) : null}

        <TouchableOpacity style={styles.saveButton} onPress={saveTeacher}>
          <Ionicons
            name={editingId ? "save-outline" : "person-add-outline"}
            size={22}
            color={colors.text}
          />

          <Text style={styles.saveButtonText}>
            {editingId ? "Salva modifiche" : "Crea maestro"}
          </Text>
        </TouchableOpacity>

        {editingId ? (
          <TouchableOpacity style={styles.cancelButton} onPress={resetForm}>
            <Text style={styles.cancelButtonText}>Annulla modifica</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <Text style={styles.sectionTitle}>Maestri registrati</Text>

      {teachers.length === 0 ? (
        <View style={styles.emptyBox}>
          <Ionicons name="people-outline" size={50} color={colors.secondary} />

          <Text style={styles.emptyTitle}>Nessun maestro creato</Text>

          <Text style={styles.emptyText}>I maestri compariranno qui.</Text>
        </View>
      ) : (
        teachers.map((teacher: TeacherUser) => (
          <View key={teacher.id} style={styles.teacherCard}>
            <View style={styles.teacherHeader}>
              <View style={styles.teacherMainInfo}>
                <Text style={styles.teacherName}>
                  {teacher.firstName} {teacher.lastName}
                </Text>

                <Text style={styles.teacherUsername}>@{teacher.username}</Text>

                <View style={styles.onlineRow}>
                  <View
                    style={[
                      styles.onlineDot,
                      {
                        backgroundColor: isTeacherOnline(teacher)
                          ? colors.success
                          : colors.danger,
                      },
                    ]}
                  />

                  <Text
                    style={[
                      styles.onlineText,
                      {
                        color: isTeacherOnline(teacher)
                          ? colors.success
                          : colors.danger,
                      },
                    ]}
                  >
                    {isTeacherOnline(teacher) ? "Online" : "Offline"}
                  </Text>
                </View>
              </View>

              <View style={styles.actions}>
                <TouchableOpacity
                  style={styles.editButton}
                  onPress={() => editTeacher(teacher)}
                >
                  <Ionicons
                    name="create-outline"
                    size={20}
                    color={colors.text}
                  />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => deleteTeacher(teacher)}
                >
                  <Ionicons
                    name="trash-outline"
                    size={20}
                    color={colors.text}
                  />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.schoolBadge}>
              <Ionicons name="business-outline" size={16} color={colors.text} />

              <Text style={styles.schoolText}>{teacher.danceSchool}</Text>
            </View>

            <View style={styles.whatsappBox}>
              <Ionicons name="logo-whatsapp" size={18} color={colors.success} />
              <Text style={styles.whatsappText}>
                {teacher.whatsapp || "WhatsApp non inserito"}
              </Text>
            </View>

            <View style={styles.passwordBox}>
              <Text style={styles.passwordLabel}>
                Password generata originale
              </Text>

              <Text style={styles.passwordValue}>
                {teacher.initialPassword || teacher.password}
              </Text>
            </View>

            <View style={styles.teacherActions}>
              <TouchableOpacity
                style={styles.whatsappButton}
                onPress={() => sendWhatsappCredentials(teacher)}
              >
                <Ionicons name="logo-whatsapp" size={22} color={colors.text} />

                <Text style={styles.whatsappButtonText}>
                  Invia credenziali WhatsApp
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.contactButton}
                onPress={pickWhatsappFromContacts}
              >
                <Ionicons name="book-outline" size={20} color={colors.text} />
                <Text style={styles.contactButtonText}>
                  Scegli dalla rubrica
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}
const createStyles = (colors: any, isDark: boolean) =>
  StyleSheet.create({
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
      fontSize: 40,
      fontWeight: "900",
      marginBottom: 10,
    },

    subtitle: {
      color: colors.secondary,
      fontSize: 16,
      marginBottom: 26,
      lineHeight: 23,
    },

    formCard: {
      backgroundColor: colors.card,
      borderRadius: 28,
      padding: 20,
      marginBottom: 26,
    },

    formTitle: {
      color: colors.text,
      fontSize: 24,
      fontWeight: "900",
      marginBottom: 18,
    },

    input: {
      backgroundColor: colors.background,
      borderRadius: 18,
      paddingVertical: 16,
      paddingHorizontal: 16,
      color: colors.text,
      fontSize: 16,
      marginBottom: 14,
      borderWidth: 1,
      borderColor: colors.border,
    },

    whatsappInput: {
      marginBottom: 0,
    },

    passwordRow: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 18,
    },

    passwordInput: {
      flex: 1,
      backgroundColor: colors.background,
      borderRadius: 18,
      paddingVertical: 16,
      paddingHorizontal: 16,
      color: colors.text,
      fontSize: 16,
      borderWidth: 1,
      borderColor: colors.border,
      marginRight: 12,
    },

    generateButton: {
      width: 58,
      height: 58,
      borderRadius: 18,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },

    infoBox: {
      backgroundColor: colors.background,
      borderRadius: 18,
      padding: 14,
      marginBottom: 18,
      borderWidth: 1,
      borderColor: colors.border,
    },

    infoLabel: {
      color: colors.placeholder,
      fontSize: 13,
      marginBottom: 6,
    },

    infoValue: {
      color: colors.text,
      fontSize: 16,
      fontWeight: "900",
    },

    saveButton: {
      backgroundColor: colors.primary,
      borderRadius: 20,
      paddingVertical: 18,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
    },

    saveButtonText: {
      color: colors.onPrimary,
      fontSize: 16,
      fontWeight: "900",
      marginLeft: 8,
    },

    cancelButton: {
      marginTop: 12,
      backgroundColor: colors.border,
      borderRadius: 18,
      paddingVertical: 15,
      alignItems: "center",
    },

    contactButton: {
      backgroundColor: "#25D366",
      borderRadius: 18,
      paddingVertical: 16,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      gap: 10,
    },

    contactPickerButton: {
      marginTop: 14,
      marginBottom: 20,
      backgroundColor: "#25D366",
      borderRadius: 18,
      paddingVertical: 16,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      gap: 10,
    },

    contactPickerText: {
      color: "#FFFFFF",
      fontSize: 16,
      fontWeight: "800",
    },

    contactButtonText: {
      color: colors.text,
      fontSize: 14,
      fontWeight: "900",
    },

    cancelButtonText: {
      color: colors.secondary,
      fontSize: 15,
      fontWeight: "800",
    },

    sectionTitle: {
      color: colors.text,
      fontSize: 26,
      fontWeight: "900",
      marginBottom: 18,
    },

    emptyBox: {
      backgroundColor: colors.card,
      borderRadius: 28,
      padding: 30,
      alignItems: "center",
    },

    emptyTitle: {
      color: colors.text,
      fontSize: 22,
      fontWeight: "900",
      marginTop: 14,
      marginBottom: 8,
    },

    emptyText: {
      color: colors.secondary,
      fontSize: 15,
    },

    teacherCard: {
      backgroundColor: colors.card,
      borderRadius: 28,
      padding: 18,
      marginBottom: 18,
    },

    teacherHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      marginBottom: 14,
    },

    teacherMainInfo: {
      flex: 1,
      paddingRight: 10,
    },

    teacherName: {
      color: colors.text,
      fontSize: 22,
      fontWeight: "900",
    },

    teacherUsername: {
      color: colors.secondary,
      fontSize: 14,
      marginTop: 4,
    },

    onlineRow: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 8,
    },

    onlineDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      marginRight: 8,
    },

    onlineText: {
      fontSize: 13,
      fontWeight: "900",
    },

    actions: {
      flexDirection: "row",
      gap: 10,
    },

    editButton: {
      width: 46,
      height: 46,
      borderRadius: 16,
      backgroundColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
    },

    deleteButton: {
      width: 46,
      height: 46,
      borderRadius: 16,
      backgroundColor: colors.danger,
      alignItems: "center",
      justifyContent: "center",
    },

    schoolBadge: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.background,
      borderRadius: 16,
      paddingVertical: 10,
      paddingHorizontal: 14,
      marginBottom: 12,
    },

    schoolText: {
      color: colors.text,
      fontSize: 14,
      fontWeight: "800",
      marginLeft: 8,
    },

    whatsappBox: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.background,
      borderRadius: 16,
      paddingVertical: 10,
      paddingHorizontal: 14,
      marginBottom: 12,
    },

    whatsappText: {
      color: colors.text,
      fontSize: 14,
      fontWeight: "800",
      marginLeft: 8,
    },

    passwordBox: {
      backgroundColor: colors.background,
      borderRadius: 18,
      padding: 14,
      marginBottom: 14,
    },

    passwordLabel: {
      color: colors.placeholder,
      fontSize: 13,
      marginBottom: 6,
    },

    passwordValue: {
      color: colors.text,
      fontSize: 16,
      fontWeight: "900",
    },

    teacherActions: {
      gap: 12,
      marginTop: 18,
    },

    whatsappButton: {
      backgroundColor: colors.success,
      borderRadius: 18,
      paddingVertical: 16,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
    },

    whatsappButtonText: {
      color: colors.text,
      fontSize: 15,
      fontWeight: "900",
      marginLeft: 8,
    },
  });
