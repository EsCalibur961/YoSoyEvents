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
import { useEffect, useMemo, useState } from "react";
import {
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { useFeedback } from "../../contexts/FeedbackContext";
import { db } from "../../firebase";
import { ProfileAvatar } from "../../components/ProfileAvatar";
import { hashPassword } from "../../utils/hash";
import { getTeacherProfileImage } from "../../utils/profileImages";

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

export default function AdminWebTeachersScreen() {
  const { colors, isDark } = useTheme();
  const { width } = useWindowDimensions();
  const { success, error, warning, info, confirm } = useFeedback();
  const styles = createStyles(colors, isDark, width < 700);
  const pickWhatsappFromContacts = async () => {
    const { status } = await Contacts.requestPermissionsAsync();

    if (status !== "granted") {
      warning("Permesso negato", "Autorizza l’accesso alla rubrica.");
      return;
    }

    const contact = await Contacts.presentContactPickerAsync();

    if (!contact) return;

    const phone = contact.phoneNumbers?.[0]?.number?.replace(/\s/g, "") || "";

    if (!phone) {
      warning("Numero non disponibile", "Questo contatto non ha un numero di telefono.");
      return;
    }

    setWhatsapp(phone);
  };
  const [teachers, setTeachers] = useState<TeacherUser[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [teacherSearch, setTeacherSearch] = useState("");
  const [teacherFilter, setTeacherFilter] = useState<"all" | "online" | "offline">("all");

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
    setEditorOpen(false);
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
      warning(
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
      error("WhatsApp non disponibile", "Non è stato possibile aprire WhatsApp.");
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
      warning(
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

      success(
        editingId ? "Maestro aggiornato" : "Maestro creato",
        "WhatsApp è stato aperto con le credenziali pronte da inviare.",
      );
    } catch (caughtError) {
      console.log("SAVE TEACHER ERROR:", caughtError);
      error("Salvataggio non riuscito", "Non è stato possibile salvare il maestro.");
    }
  };

  const editTeacher = (teacher: TeacherUser) => {
    setEditorOpen(true);
    setEditingId(teacher.id);
    setUsername(teacher.username);
    setPassword(teacher.password);
    setInitialPassword(teacher.initialPassword || teacher.password);
    setFirstName(teacher.firstName);
    setLastName(teacher.lastName);
    setDanceSchool(teacher.danceSchool);
    setWhatsapp(teacher.whatsapp || "");
  };
  const deleteTeacher = (teacher: TeacherUser) => {
    confirm({
      title: "Eliminare questo maestro?",
      message: `Vuoi eliminare ${teacher.firstName} ${teacher.lastName}? Verranno eliminati anche tutti i dati associati a questo maestro, comprese stanze e assegnazioni.`,
      confirmText: "Elimina maestro",
      cancelText: "Annulla",
      destructive: true,
      onConfirm: async () => {
        try {
          const teacherUsername = teacher.username;
          const collectionsToClean = ["roomsData", "roomAssignments"];

          for (const collectionName of collectionsToClean) {
            const snapshot = await getDocs(collection(db, collectionName));

            for (const itemDoc of snapshot.docs) {
              const data = itemDoc.data();

              const belongsToTeacher =
                data.teacherUsername === teacherUsername ||
                data.username === teacherUsername ||
                data.teacherId === teacher.id ||
                data.assignedTo === teacherUsername ||
                data.assignedTeacher === teacherUsername ||
                data.teacher === teacherUsername ||
                data.userUsername === teacherUsername ||
                data.ownerUsername === teacherUsername ||
                data.createdBy === teacherUsername;

              if (belongsToTeacher) {
                await deleteDoc(doc(db, collectionName, itemDoc.id));
              }
            }
          }

          await deleteDoc(doc(db, "teachers", teacher.id));
          success("Maestro eliminato", "Il maestro e i dati associati sono stati eliminati.");
        } catch (deleteError) {
          console.error(deleteError);
          error("Eliminazione non riuscita", "Impossibile eliminare il maestro.");
        }
      },
    });
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

  const openCreateTeacher = () => {
    resetForm();
    setEditorOpen(true);
  };

  const filteredTeachers = useMemo(() => {
    const query = teacherSearch.trim().toLowerCase();

    return [...teachers]
      .filter((teacher) => {
        const online = isTeacherOnline(teacher);

        if (teacherFilter === "online" && !online) return false;
        if (teacherFilter === "offline" && online) return false;

        if (!query) return true;

        return [
          teacher.firstName,
          teacher.lastName,
          teacher.username,
          teacher.danceSchool,
          teacher.whatsapp,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(query);
      })
      .sort((a, b) => {
        const aOnline = isTeacherOnline(a);
        const bOnline = isTeacherOnline(b);

        if (aOnline !== bOnline) return aOnline ? -1 : 1;

        return `${a.firstName} ${a.lastName}`.localeCompare(
          `${b.firstName} ${b.lastName}`,
        );
      });
  }, [teachers, teacherSearch, teacherFilter]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <TouchableOpacity style={styles.backButton} onPress={() => router.replace("/admin-web")}>
        <Ionicons name="chevron-back-outline" size={24} color={colors.text} />
        <Text style={styles.backText}>Dashboard Web</Text>
      </TouchableOpacity>

      <View style={styles.webHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.webEyebrow}>YO SOY EVENTS / ADMIN WEB</Text>
          <Text style={styles.title}>Gestione maestri</Text>
          <Text style={styles.subtitle}>
            Account, credenziali, scuole, WhatsApp e stato online in un’unica schermata.
          </Text>
        </View>
      </View>

      {editorOpen ? (
        <View style={styles.formCard}>
          <TouchableOpacity style={styles.editorBack} onPress={resetForm}>
            <Ionicons name="chevron-back-outline" size={18} color={colors.primary} />
            <Text style={styles.editorBackText}>Torna ai maestri</Text>
          </TouchableOpacity>

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
                if (!editingId) setInitialPassword(value);
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
              color={colors.onPrimary}
            />
            <Text style={styles.saveButtonText}>
              {editingId ? "Salva modifiche" : "Crea maestro"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.cancelButton} onPress={resetForm}>
            <Text style={styles.cancelButtonText}>Annulla</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <View style={styles.listHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionTitle}>Maestri registrati</Text>
              <Text style={styles.listSubtitle}>
                Cerca un maestro e apri i dettagli solo quando servono.
              </Text>
            </View>

            <TouchableOpacity
              style={styles.newTeacherButton}
              onPress={openCreateTeacher}
            >
              <Ionicons name="person-add-outline" size={19} color={colors.onPrimary} />
              <Text style={styles.newTeacherButtonText}>Nuovo</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.teacherSearchBox}>
            <Ionicons name="search-outline" size={19} color={colors.secondary} />
            <TextInput
              style={styles.teacherSearchInput}
              value={teacherSearch}
              onChangeText={setTeacherSearch}
              placeholder="Cerca nome, username, scuola..."
              placeholderTextColor={colors.placeholder}
              autoCapitalize="none"
            />
            {teacherSearch ? (
              <TouchableOpacity onPress={() => setTeacherSearch("")}>
                <Ionicons name="close-circle" size={19} color={colors.secondary} />
              </TouchableOpacity>
            ) : null}
          </View>

          <View style={styles.teacherFilters}>
            {([
              ["all", "Tutti"],
              ["online", "Online"],
              ["offline", "Offline"],
            ] as const).map(([value, label]) => {
              const active = teacherFilter === value;

              return (
                <TouchableOpacity
                  key={value}
                  style={[
                    styles.teacherFilterButton,
                    active && styles.teacherFilterButtonActive,
                  ]}
                  onPress={() => setTeacherFilter(value)}
                >
                  <Text
                    style={[
                      styles.teacherFilterText,
                      active && styles.teacherFilterTextActive,
                    ]}
                  >
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.teacherCount}>
            {filteredTeachers.length} di {teachers.length} maestri
          </Text>

          {filteredTeachers.length === 0 ? (
            <View style={styles.emptyBox}>
              <Ionicons name="people-outline" size={44} color={colors.secondary} />
              <Text style={styles.emptyTitle}>Nessun maestro trovato</Text>
              <Text style={styles.emptyText}>Modifica ricerca o filtro.</Text>
            </View>
          ) : (
            filteredTeachers.map((teacher: TeacherUser) => {
              const online = isTeacherOnline(teacher);

              return (
                <View key={teacher.id} style={styles.compactTeacherCard}>
                  <TouchableOpacity
                    style={styles.compactTeacherMain}
                    onPress={() => editTeacher(teacher)}
                    activeOpacity={0.8}
                  >
                    <ProfileAvatar uri={getTeacherProfileImage(teacher as unknown as Record<string, unknown>)} size={42} color={colors.primary} backgroundColor={colors.cardAlt} style={styles.compactAvatar} />

                    <View style={styles.compactTeacherInfo}>
                      <Text style={styles.compactTeacherName} numberOfLines={1}>
                        {teacher.firstName} {teacher.lastName}
                      </Text>

                      <Text style={styles.compactTeacherMeta} numberOfLines={1}>
                        @{teacher.username} • {teacher.danceSchool || "Scuola non inserita"}
                      </Text>

                      <View style={styles.compactStatusRow}>
                        <View
                          style={[
                            styles.onlineDotSmall,
                            {
                              backgroundColor: online
                                ? colors.success
                                : colors.danger,
                            },
                          ]}
                        />
                        <Text
                          style={[
                            styles.compactStatusText,
                            {
                              color: online ? colors.success : colors.danger,
                            },
                          ]}
                        >
                          {online ? "Online" : "Offline"}
                        </Text>

                        <Text style={styles.compactSeparator}>•</Text>

                        <Ionicons
                          name="logo-whatsapp"
                          size={12}
                          color={teacher.whatsapp ? colors.success : colors.secondary}
                        />
                        <Text style={styles.compactWhatsappStatus}>
                          {teacher.whatsapp ? "WhatsApp" : "No WhatsApp"}
                        </Text>

                        <Text style={styles.compactSeparator}>•</Text>

                        <Ionicons
                          name="key-outline"
                          size={12}
                          color={
                            teacher.initialPassword || teacher.password
                              ? colors.primary
                              : colors.secondary
                          }
                        />
                        <Text style={styles.compactWhatsappStatus}>
                          Credenziali
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>

                  <View style={styles.compactActions}>
                    <TouchableOpacity
                      style={styles.compactEditButton}
                      onPress={() => editTeacher(teacher)}
                    >
                      <Ionicons name="create-outline" size={18} color={colors.onPrimary} />
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.compactWhatsappButton}
                      onPress={() => sendWhatsappCredentials(teacher)}
                    >
                      <Ionicons name="logo-whatsapp" size={18} color="#FFFFFF" />
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.compactDeleteButton}
                      onPress={() => deleteTeacher(teacher)}
                    >
                      <Ionicons name="trash-outline" size={18} color="#FFFFFF" />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}
        </>
      )}

    </ScrollView>
  );
}
const createStyles = (colors: any, isDark: boolean, isMobile: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },

    content: {
      width: "100%",
      maxWidth: 1280,
      alignSelf: "center",
      paddingTop: 30,
      paddingHorizontal: isMobile ? 14 : 32,
      paddingBottom: 120,
    },

    webHeader: {
      flexDirection: isMobile ? "column" : "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: 20,
      marginBottom: 8,
    },

    webEyebrow: {
      color: colors.primary,
      fontSize: 10,
      fontWeight: "900",
      letterSpacing: 1.1,
      marginBottom: 7,
    },

    mobileViewButton: {
      minHeight: 42,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      paddingHorizontal: 13,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
    },

    mobileViewText: {
      color: colors.primary,
      fontSize: 10,
      fontWeight: "900",
      marginLeft: 6,
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
      fontSize: 31,
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
      width: "100%",
      maxWidth: 920,
      alignSelf: "center",
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: "#000",
      shadowOpacity: isDark ? 0.14 : 0.045,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
      elevation: 2,
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
      flexDirection: isMobile ? "column" : "row",
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
      borderRadius: 18,
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
      color: colors.onPrimary,
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

    editorBack: {
      alignSelf: "flex-start",
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: `${colors.primary}12`,
      borderRadius: 12,
      paddingHorizontal: 10,
      paddingVertical: 8,
      marginBottom: 14,
    },

    editorBackText: {
      color: colors.primary,
      fontSize: 12,
      fontWeight: "900",
      marginLeft: 4,
    },

    listHeader: {
      flexDirection: isMobile ? "column" : "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: 12,
      marginBottom: 12,
    },

    listSubtitle: {
      color: colors.secondary,
      fontSize: 12,
      lineHeight: 17,
      fontWeight: "700",
      marginTop: -10,
    },

    newTeacherButton: {
      minHeight: 42,
      borderRadius: 14,
      backgroundColor: colors.primary,
      paddingHorizontal: 12,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 5,
    },

    newTeacherButtonText: {
      color: colors.onPrimary,
      fontSize: 11,
      fontWeight: "900",
    },

    teacherSearchBox: {
      height: 50,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 13,
      marginBottom: 10,
    },

    teacherSearchInput: {
      flex: 1,
      height: "100%",
      minHeight: 42,
      color: colors.text,
      fontSize: 13,
      fontWeight: "700",
      marginLeft: 8,
    },

    teacherFilters: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 7,
      marginBottom: 8,
    },

    teacherFilterButton: {
      flex: 1,
      minHeight: 38,
      borderRadius: 13,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      alignItems: "center",
      justifyContent: "center",
    },

    teacherFilterButtonActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },

    teacherFilterText: {
      color: colors.secondary,
      fontSize: 10,
      fontWeight: "900",
    },

    teacherFilterTextActive: {
      color: colors.onPrimary,
    },

    teacherCount: {
      color: colors.secondary,
      fontSize: 10,
      fontWeight: "800",
      marginBottom: 10,
    },

    compactTeacherCard: {
      minHeight: 76,
      maxWidth: 980,
      width: "100%",
      alignSelf: "center",
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 18,
      padding: 8,
      marginBottom: 8,
      flexDirection: isMobile ? "column" : "row",
      alignItems: "center",
    },

    compactTeacherMain: {
      flex: 1,
      minWidth: 0,
      flexDirection: isMobile ? "column" : "row",
      alignItems: "center",
    },

    compactAvatar: {
      width: 48,
      height: 48,
      borderRadius: 14,
      backgroundColor: `${colors.primary}12`,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 9,
    },

    compactTeacherInfo: {
      flex: 1,
      minWidth: 0,
    },

    compactTeacherName: {
      color: colors.text,
      fontSize: 14,
      fontWeight: "900",
    },

    compactTeacherMeta: {
      color: colors.secondary,
      fontSize: 10,
      fontWeight: "700",
      marginTop: 3,
    },

    compactStatusRow: {
      flexDirection: "row",
      alignItems: "center",
      flexWrap: "wrap",
      marginTop: 5,
    },

    onlineDotSmall: {
      width: 6,
      height: 6,
      borderRadius: 3,
      marginRight: 4,
    },

    compactStatusText: {
      fontSize: 9,
      fontWeight: "900",
    },

    compactSeparator: {
      color: colors.placeholder,
      fontSize: 9,
      marginHorizontal: 5,
    },

    compactWhatsappStatus: {
      color: colors.secondary,
      fontSize: 9,
      fontWeight: "800",
      marginLeft: 3,
    },

    compactActions: {
      width: isMobile ? "100%" : undefined,
      flexDirection: "row",
      justifyContent: isMobile ? "space-between" : "flex-end",
      gap: 10,
      marginLeft: 7,
    },

    compactEditButton: {
      width: isMobile ? 44 : 32,
      height: isMobile ? 44 : 32,
      borderRadius: 9,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },

    compactWhatsappButton: {
      width: isMobile ? 44 : 32,
      height: isMobile ? 44 : 32,
      borderRadius: 9,
      backgroundColor: colors.success,
      alignItems: "center",
      justifyContent: "center",
    },

    compactDeleteButton: {
      width: isMobile ? 44 : 32,
      height: isMobile ? 44 : 32,
      borderRadius: 9,
      backgroundColor: colors.danger,
      alignItems: "center",
      justifyContent: "center",
    },

    teacherCard: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: "#000",
      shadowOpacity: isDark ? 0.14 : 0.045,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
      elevation: 2,
      borderRadius: 28,
      padding: 16,
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
