import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import { router, useFocusEffect } from "expo-router";
import {
  collection,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytes,
} from "firebase/storage";
import { useCallback, useState } from "react";
import {
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useTheme } from "../contexts/ThemeContext";
import { db, storage } from "../firebase";

type AdminProfile = {
  name?: string;
  image?: string;
  imagePath?: string;
};

type TeacherUser = {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  danceSchool: string;
  profileImage?: string;
  profileImagePath?: string;
};

export default function EditProfileScreen() {
  const { colors, isDark } = useTheme();
  const styles = createStyles(colors, isDark);
  const [role, setRole] = useState<string | null>(null);
  const [teacherUsername, setTeacherUsername] = useState<string | null>(null);
  const [teacherId, setTeacherId] = useState<string | null>(null);

  const [adminName, setAdminName] = useState("YoSoyEvents");

  const [image, setImage] = useState("");
  const [imagePath, setImagePath] = useState("");

  const [teachers, setTeachers] = useState<TeacherUser[]>([]);
  const [adminProfile, setAdminProfile] = useState<AdminProfile | null>(null);

  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadLocalUser();

      const unsubAdmin = onSnapshot(
        doc(db, "settings", "adminProfile"),
        (snapshot) => {
          if (!snapshot.exists()) {
            setAdminProfile(null);
            return;
          }

          const data = snapshot.data() as AdminProfile;

          setAdminProfile(data);
          setAdminName(data.name || "YoSoyEvents");

          if (role !== "teacher") {
            setImage(data.image || "");
            setImagePath(data.imagePath || "");
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
    }, [role]),
  );

  useFocusEffect(
    useCallback(() => {
      if (role !== "teacher" || !teacherUsername) return;

      const currentTeacher = teachers.find(
        (teacher) => teacher.username === teacherUsername,
      );

      if (currentTeacher) {
        setImage(currentTeacher.profileImage || "");
        setImagePath(currentTeacher.profileImagePath || "");
      }
    }, [role, teacherUsername, teachers]),
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

  const uploadImageToStorage = async (uri: string) => {
    if (!uri) return null;

    if (uri.startsWith("http")) {
      return {
        url: uri,
        path: imagePath,
      };
    }

    try {
      setUploadingImage(true);

      const response = await fetch(uri);
      const blob = await response.blob();

      const folder = role === "teacher" ? "teacherProfiles" : "adminProfile";

      const ownerId =
        role === "teacher"
          ? teacherId || currentTeacher?.id || teacherUsername || "teacher"
          : "admin";

      const filePath = `${folder}/${ownerId}-${Date.now()}.jpg`;

      const imageRef = ref(storage, filePath);

      await uploadBytes(imageRef, blob);

      const downloadUrl = await getDownloadURL(imageRef);

      setUploadingImage(false);

      return {
        url: downloadUrl,
        path: filePath,
      };
    } catch (error) {
      setUploadingImage(false);

      console.log("UPLOAD IMAGE ERROR:", error);
      Alert.alert("Errore upload", String((error as any)?.message || error));

      return null;
    }
  };

  const deleteOldImageIfNeeded = async (oldPath?: string, newPath?: string) => {
    if (!oldPath) return;
    if (oldPath === newPath) return;

    try {
      await deleteObject(ref(storage, oldPath));
    } catch {
      // Se il file non esiste più, ignoriamo l'errore.
    }
  };

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert(
        "Permesso negato",
        "Devi autorizzare l’accesso alle immagini.",
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: true,
    });

    if (!result.canceled) {
      setImage(result.assets[0].uri);
    }
  };

  const removeImage = async () => {
    try {
      if (imagePath) {
        await deleteOldImageIfNeeded(imagePath);
      }

      setImage("");
      setImagePath("");

      if (role === "teacher") {
        const idToUpdate = teacherId || currentTeacher?.id;

        if (idToUpdate) {
          await updateDoc(doc(db, "teachers", idToUpdate), {
            profileImage: "",
            profileImagePath: "",
            updatedAt: serverTimestamp(),
          });
        }
      } else {
        await setDoc(
          doc(db, "settings", "adminProfile"),
          {
            name: adminName.trim() || "YoSoyEvents",
            image: "",
            imagePath: "",
            updatedAt: serverTimestamp(),
          },
          { merge: true },
        );
      }

      Alert.alert("Immagine rimossa", "La foto profilo è stata rimossa.");
    } catch (error) {
      Alert.alert("Errore", "Non è stato possibile rimuovere l’immagine.");
    }
  };

  const saveProfile = async () => {
    try {
      setLoading(true);

      const uploaded = image ? await uploadImageToStorage(image) : null;

      if (image && !uploaded) {
        setLoading(false);
        return;
      }

      if (role === "teacher") {
        const idToUpdate = teacherId || currentTeacher?.id;

        if (!idToUpdate) {
          setLoading(false);
          Alert.alert("Errore", "Maestro non trovato.");
          return;
        }

        const oldPath = currentTeacher?.profileImagePath || "";
        const newPath = uploaded?.path || "";

        await updateDoc(doc(db, "teachers", idToUpdate), {
          profileImage: uploaded?.url || "",
          profileImagePath: newPath,
          updatedAt: serverTimestamp(),
        });

        await deleteOldImageIfNeeded(oldPath, newPath);

        setLoading(false);

        Alert.alert(
          "Foto salvata",
          "La foto profilo è stata caricata su Firebase Storage.",
          [
            {
              text: "OK",
              onPress: () => router.back(),
            },
          ],
        );

        return;
      }

      if (!adminName.trim()) {
        setLoading(false);
        Alert.alert("Nome mancante", "Inserisci il nome admin.");
        return;
      }

      const oldPath = adminProfile?.imagePath || "";
      const newPath = uploaded?.path || "";

      await setDoc(
        doc(db, "settings", "adminProfile"),
        {
          name: adminName.trim(),
          image: uploaded?.url || "",
          imagePath: newPath,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );

      await deleteOldImageIfNeeded(oldPath, newPath);

      setLoading(false);

      Alert.alert(
        "Profilo salvato",
        "Il profilo admin è stato aggiornato su Firebase Storage.",
        [
          {
            text: "OK",
            onPress: () => router.back(),
          },
        ],
      );
    } catch (error) {
      setLoading(false);

      Alert.alert("Errore", "Non è stato possibile salvare il profilo.");
    }
  };

  const title =
    role === "teacher" ? "Modifica foto profilo" : "Modifica profilo";

  const subtitle =
    role === "teacher"
      ? "Carica o modifica la tua foto profilo. Verrà salvata su Firebase Storage."
      : "Aggiorna nome e immagine admin. Le modifiche saranno live su Firestore e Storage.";

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

      <Text style={styles.title}>{title}</Text>

      <Text style={styles.subtitle}>{subtitle}</Text>

      <View style={styles.card}>
        <TouchableOpacity style={styles.avatarBox} onPress={pickImage}>
          {image ? (
            <Image source={{ uri: image }} style={styles.avatar} />
          ) : (
            <View style={styles.emptyAvatar}>
              <Ionicons
                name="camera-outline"
                size={44}
                color={colors.secondary}
              />

              <Text style={styles.emptyAvatarText}>
                {role === "teacher" ? "Carica foto" : "Carica immagine"}
              </Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.imageButton}
          onPress={pickImage}
          disabled={uploadingImage || loading}
        >
          <Ionicons name="image-outline" size={22} color={colors.text} />

          <Text style={styles.imageButtonText}>
            {uploadingImage
              ? "Caricamento..."
              : image
                ? "Cambia immagine"
                : "Scegli immagine"}
          </Text>
        </TouchableOpacity>

        {image ? (
          <TouchableOpacity
            style={styles.removeButton}
            onPress={removeImage}
            disabled={loading || uploadingImage}
          >
            <Ionicons name="trash-outline" size={20} color={colors.text} />

            <Text style={styles.removeButtonText}>Rimuovi immagine</Text>
          </TouchableOpacity>
        ) : null}

        {role !== "teacher" ? (
          <>
            <Text style={styles.label}>Nome admin</Text>

            <TextInput
              style={styles.input}
              placeholder="Nome profilo"
              placeholderTextColor={colors.placeholder}
              value={adminName}
              onChangeText={setAdminName}
            />
          </>
        ) : (
          <View style={styles.teacherInfoBox}>
            <Text style={styles.teacherInfoLabel}>Maestro</Text>

            <Text style={styles.teacherInfoName}>
              {currentTeacher
                ? `${currentTeacher.firstName} ${currentTeacher.lastName}`
                : teacherUsername || "Maestro"}
            </Text>

            <Text style={styles.teacherInfoSchool}>
              {currentTeacher?.danceSchool || ""}
            </Text>
          </View>
        )}

        <TouchableOpacity
          style={[
            styles.saveButton,
            (loading || uploadingImage) && styles.saveButtonDisabled,
          ]}
          onPress={saveProfile}
          disabled={loading || uploadingImage}
        >
          <Ionicons
            name={
              loading || uploadingImage ? "hourglass-outline" : "save-outline"
            }
            size={22}
            color={colors.text}
          />

          <Text style={styles.saveButtonText}>
            {loading || uploadingImage ? "Salvataggio..." : "Salva modifiche"}
          </Text>
        </TouchableOpacity>
      </View>
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
      fontSize: 38,
      fontWeight: "900",
      marginBottom: 10,
    },

    subtitle: {
      color: colors.secondary,
      fontSize: 16,
      lineHeight: 24,
      marginBottom: 26,
    },

    card: {
      backgroundColor: colors.card,
      borderRadius: 30,
      padding: 22,
    },

    avatarBox: {
      width: 156,
      height: 156,
      borderRadius: 78,
      backgroundColor: colors.background,
      alignSelf: "center",
      marginBottom: 20,
      overflow: "hidden",
      borderWidth: 1,
      borderColor: colors.border,
    },

    avatar: {
      width: "100%",
      height: "100%",
    },

    emptyAvatar: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
    },

    emptyAvatarText: {
      color: colors.secondary,
      fontSize: 13,
      fontWeight: "800",
      marginTop: 8,
    },

    imageButton: {
      backgroundColor: colors.border,
      borderRadius: 18,
      paddingVertical: 15,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      marginBottom: 12,
    },

    imageButtonText: {
      color: colors.text,
      fontSize: 15,
      fontWeight: "900",
      marginLeft: 8,
    },

    removeButton: {
      backgroundColor: colors.danger,
      borderRadius: 18,
      paddingVertical: 14,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      marginBottom: 22,
    },

    removeButtonText: {
      color: colors.text,
      fontSize: 15,
      fontWeight: "900",
      marginLeft: 8,
    },

    label: {
      color: colors.text,
      fontSize: 15,
      fontWeight: "900",
      marginBottom: 8,
    },

    input: {
      backgroundColor: colors.background,
      borderRadius: 18,
      paddingVertical: 16,
      paddingHorizontal: 16,
      color: colors.text,
      fontSize: 16,
      marginBottom: 22,
      borderWidth: 1,
      borderColor: colors.border,
    },

    teacherInfoBox: {
      backgroundColor: colors.background,
      borderRadius: 20,
      padding: 16,
      marginBottom: 22,
      borderWidth: 1,
      borderColor: colors.border,
    },

    teacherInfoLabel: {
      color: colors.placeholder,
      fontSize: 13,
      fontWeight: "800",
      marginBottom: 6,
    },

    teacherInfoName: {
      color: colors.text,
      fontSize: 20,
      fontWeight: "900",
    },

    teacherInfoSchool: {
      color: colors.secondary,
      fontSize: 14,
      marginTop: 5,
    },

    saveButton: {
      backgroundColor: colors.primary,
      borderRadius: 20,
      paddingVertical: 18,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
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
  });
