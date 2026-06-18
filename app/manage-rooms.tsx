import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import {
  collection,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { useCallback, useMemo, useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useTheme } from "../contexts/ThemeContext";
import { db } from "../firebase";

type RoomType = "Doppia" | "Tripla" | "Quadrupla";

type TeacherUser = {
  id: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  danceSchool?: string;
};

type RoomAssignment = {
  id: string;
  teacherUsername?: string;
  teacherFullName?: string;
  danceSchool?: string;
  quantities?: {
    Doppia?: number;
    Tripla?: number;
    Quadrupla?: number;
  };
};

type RoomData = {
  id: string;
  teacherUsername?: string;
  roomType?: RoomType;
  roomIndex?: number;
  isSaved?: boolean;
  paymentVisible?: boolean;
  savedAt?: any;
  guests?: any[];
};

type RoomSettings = {
  totalRooms?: {
    Doppia?: number;
    Tripla?: number;
    Quadrupla?: number;
  };
  editDeadlineDate?: string;
  editDeadlineTime?: string;
};

const roomTypes: RoomType[] = ["Doppia", "Tripla", "Quadrupla"];

export default function ManageRoomsScreen() {
  const { colors, isDark } = useTheme();
  const styles = createStyles(colors, isDark);
  const [teachers, setTeachers] = useState<TeacherUser[]>([]);
  const [assignments, setAssignments] = useState<RoomAssignment[]>([]);
  const [roomsData, setRoomsData] = useState<RoomData[]>([]);
  const [settings, setSettings] = useState<RoomSettings>({
    totalRooms: {
      Doppia: 0,
      Tripla: 0,
      Quadrupla: 0,
    },
    editDeadlineDate: "",
    editDeadlineTime: "",
  });

  const [selectedTeacher, setSelectedTeacher] = useState<TeacherUser | null>(
    null,
  );

  const [totalDoppie, setTotalDoppie] = useState("");
  const [totalTriple, setTotalTriple] = useState("");
  const [totalQuadruple, setTotalQuadruple] = useState("");

  const [assignDoppie, setAssignDoppie] = useState("");
  const [assignTriple, setAssignTriple] = useState("");
  const [assignQuadruple, setAssignQuadruple] = useState("");

  const [deadlineDate, setDeadlineDate] = useState("");
  const [deadlineTime, setDeadlineTime] = useState("");

  useFocusEffect(
    useCallback(() => {
      let unsubTeachers: (() => void) | null = null;
      let unsubAssignments: (() => void) | null = null;
      let unsubRooms: (() => void) | null = null;
      let unsubSettings: (() => void) | null = null;

      try {
        unsubTeachers = onSnapshot(collection(db, "teachers"), (snapshot) => {
          const data: TeacherUser[] = snapshot.docs.map((item) => ({
            id: item.id,
            ...(item.data() as Omit<TeacherUser, "id">),
          }));

          setTeachers(data);
        });

        unsubAssignments = onSnapshot(
          collection(db, "roomAssignments"),
          (snapshot) => {
            const data: RoomAssignment[] = snapshot.docs.map((item) => ({
              id: item.id,
              ...(item.data() as Omit<RoomAssignment, "id">),
            }));

            setAssignments(data);
          },
        );

        unsubRooms = onSnapshot(collection(db, "roomsData"), (snapshot) => {
          const data: RoomData[] = snapshot.docs.map((item) => ({
            id: item.id,
            ...(item.data() as Omit<RoomData, "id">),
          }));

          setRoomsData(data);
        });

        unsubSettings = onSnapshot(doc(db, "settings", "rooms"), (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.data() as RoomSettings;

            const safeSettings = {
              totalRooms: {
                Doppia: Number(data.totalRooms?.Doppia || 0),
                Tripla: Number(data.totalRooms?.Tripla || 0),
                Quadrupla: Number(data.totalRooms?.Quadrupla || 0),
              },
              editDeadlineDate: data.editDeadlineDate || "",
              editDeadlineTime: data.editDeadlineTime || "",
            };

            setSettings(safeSettings);

            setTotalDoppie(String(safeSettings.totalRooms.Doppia || ""));
            setTotalTriple(String(safeSettings.totalRooms.Tripla || ""));
            setTotalQuadruple(String(safeSettings.totalRooms.Quadrupla || ""));

            setDeadlineDate(safeSettings.editDeadlineDate || "");
            setDeadlineTime(safeSettings.editDeadlineTime || "");
          }
        });
      } catch {
        setTeachers([]);
        setAssignments([]);
        setRoomsData([]);
      }

      return () => {
        if (unsubTeachers) unsubTeachers();
        if (unsubAssignments) unsubAssignments();
        if (unsubRooms) unsubRooms();
        if (unsubSettings) unsubSettings();
      };
    }, []),
  );

  const toNumber = (value: string) => {
    const number = Number(value || 0);
    return Number.isNaN(number) ? 0 : number;
  };

  const getTeacherFullName = (teacher: TeacherUser) => {
    const fullName =
      `${teacher.firstName || ""} ${teacher.lastName || ""}`.trim();
    return fullName || teacher.username || "Maestro";
  };

  const getAssignmentForTeacher = (username?: string) => {
    if (!username) return null;

    return assignments.find(
      (assignment) => assignment.teacherUsername === username,
    );
  };

  const validAssignments = useMemo(() => {
    return assignments.filter((assignment) =>
      teachers.some(
        (teacher) => teacher.username === assignment.teacherUsername,
      ),
    );
  }, [assignments, teachers]);


  const isCompletedRoom = (room: RoomData) => {
    return Boolean(room.isSaved || room.paymentVisible || room.savedAt);
  };

  const completedRoomsByTeacher = useMemo(() => {
    return roomsData
      .filter((room) => room.teacherUsername && room.roomType)
      .filter((room) => isCompletedRoom(room))
      .reduce((acc, room) => {
        const username = room.teacherUsername || "";
        const type = room.roomType as RoomType;

        if (!acc[username]) {
          acc[username] = { Doppia: 0, Tripla: 0, Quadrupla: 0 };
        }

        acc[username][type] += 1;

        return acc;
      }, {} as Record<string, Record<RoomType, number>>);
  }, [roomsData]);

  const completedTotals = useMemo(() => {
    return roomsData
      .filter((room) => room.roomType)
      .filter((room) => isCompletedRoom(room))
      .reduce(
        (acc, room) => {
          const type = room.roomType as RoomType;
          acc[type] += 1;
          return acc;
        },
        { Doppia: 0, Tripla: 0, Quadrupla: 0 } as Record<RoomType, number>,
      );
  }, [roomsData]);

  const getCompletedForTeacher = (username?: string) => {
    if (!username) return { Doppia: 0, Tripla: 0, Quadrupla: 0 };

    return (
      completedRoomsByTeacher[username] || {
        Doppia: 0,
        Tripla: 0,
        Quadrupla: 0,
      }
    );
  };

  const getRemainingForAssignment = (assignment?: RoomAssignment | null) => {
    const completed = getCompletedForTeacher(assignment?.teacherUsername);

    return {
      Doppia: Math.max(Number(assignment?.quantities?.Doppia || 0) - completed.Doppia, 0),
      Tripla: Math.max(Number(assignment?.quantities?.Tripla || 0) - completed.Tripla, 0),
      Quadrupla: Math.max(Number(assignment?.quantities?.Quadrupla || 0) - completed.Quadrupla, 0),
    };
  };

  const assignedTotals = useMemo(() => {
    if (validAssignments.length === 0) {
      return {
        Doppia: 0,
        Tripla: 0,
        Quadrupla: 0,
      };
    }

    return validAssignments.reduce(
      (acc, assignment) => {
        acc.Doppia += Number(assignment.quantities?.Doppia || 0);
        acc.Tripla += Number(assignment.quantities?.Tripla || 0);
        acc.Quadrupla += Number(assignment.quantities?.Quadrupla || 0);

        return acc;
      },
      {
        Doppia: 0,
        Tripla: 0,
        Quadrupla: 0,
      },
    );
  }, [validAssignments]);

  const remainingTotals = {
    Doppia: Number(settings.totalRooms?.Doppia || 0) - completedTotals.Doppia,
    Tripla: Number(settings.totalRooms?.Tripla || 0) - completedTotals.Tripla,
    Quadrupla:
      Number(settings.totalRooms?.Quadrupla || 0) - completedTotals.Quadrupla,
  };

  const saveTotalRooms = async () => {
    try {
      await setDoc(
        doc(db, "settings", "rooms"),
        {
          totalRooms: {
            Doppia: toNumber(totalDoppie),
            Tripla: toNumber(totalTriple),
            Quadrupla: toNumber(totalQuadruple),
          },
          editDeadlineDate: deadlineDate.trim(),
          editDeadlineTime: deadlineTime.trim(),
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );

      Alert.alert("Salvato", "Configurazione stanze aggiornata live.");
    } catch {
      Alert.alert("Errore", "Non è stato possibile salvare le stanze.");
    }
  };

  const selectTeacher = (teacher: TeacherUser) => {
    if (selectedTeacher?.id === teacher.id) {
      setSelectedTeacher(null);
      setAssignDoppie("");
      setAssignTriple("");
      setAssignQuadruple("");
      return;
    }

    setSelectedTeacher(teacher);

    const existing = getAssignmentForTeacher(teacher.username);

    setAssignDoppie(String(existing?.quantities?.Doppia || ""));
    setAssignTriple(String(existing?.quantities?.Tripla || ""));
    setAssignQuadruple(String(existing?.quantities?.Quadrupla || ""));
  };

  const saveAssignment = async () => {
    if (!selectedTeacher?.username) {
      Alert.alert("Maestro mancante", "Seleziona un maestro.");
      return;
    }

    const newQuantities = {
      Doppia: toNumber(assignDoppie),
      Tripla: toNumber(assignTriple),
      Quadrupla: toNumber(assignQuadruple),
    };

    const existing = getAssignmentForTeacher(selectedTeacher.username);

    const oldQuantities = {
      Doppia: Number(existing?.quantities?.Doppia || 0),
      Tripla: Number(existing?.quantities?.Tripla || 0),
      Quadrupla: Number(existing?.quantities?.Quadrupla || 0),
    };

    const nextAssigned = {
      Doppia:
        assignedTotals.Doppia - oldQuantities.Doppia + newQuantities.Doppia,
      Tripla:
        assignedTotals.Tripla - oldQuantities.Tripla + newQuantities.Tripla,
      Quadrupla:
        assignedTotals.Quadrupla -
        oldQuantities.Quadrupla +
        newQuantities.Quadrupla,
    };

    const totalRooms = {
      Doppia: Number(settings.totalRooms?.Doppia || 0),
      Tripla: Number(settings.totalRooms?.Tripla || 0),
      Quadrupla: Number(settings.totalRooms?.Quadrupla || 0),
    };

    if (
      nextAssigned.Doppia > totalRooms.Doppia ||
      nextAssigned.Tripla > totalRooms.Tripla ||
      nextAssigned.Quadrupla > totalRooms.Quadrupla
    ) {
      Alert.alert(
        "Disponibilità insufficiente",
        "Stai assegnando più camere di quelle disponibili.",
      );
      return;
    }

    try {
      const assignmentId = selectedTeacher.username;

      await setDoc(
        doc(db, "roomAssignments", assignmentId),
        {
          teacherUsername: selectedTeacher.username,
          teacherFullName: getTeacherFullName(selectedTeacher),
          danceSchool: selectedTeacher.danceSchool || "",
          quantities: newQuantities,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );

      Alert.alert("Assegnazione salvata", "Camere assegnate live al maestro.");
    } catch {
      Alert.alert("Errore", "Non è stato possibile salvare l’assegnazione.");
    }
  };

  const availableTeachers = teachers.filter((teacher) => teacher.username);

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

      <Text style={styles.title}>Gestione stanze</Text>

      <Text style={styles.subtitle}>
        Configura disponibilità, assegna camere ai maestri e imposta la scadenza
        modifiche.
      </Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Disponibilità totale</Text>

        <TextInput
          style={styles.input}
          placeholder="Totale doppie"
          placeholderTextColor={colors.placeholder}
          value={totalDoppie}
          onChangeText={setTotalDoppie}
          keyboardType="numeric"
        />

        <TextInput
          style={styles.input}
          placeholder="Totale triple"
          placeholderTextColor={colors.placeholder}
          value={totalTriple}
          onChangeText={setTotalTriple}
          keyboardType="numeric"
        />

        <TextInput
          style={styles.input}
          placeholder="Totale quadruple"
          placeholderTextColor={colors.placeholder}
          value={totalQuadruple}
          onChangeText={setTotalQuadruple}
          keyboardType="numeric"
        />

        <Text style={styles.sectionTitle}>Scadenza modifiche maestri</Text>

        <TextInput
          style={styles.input}
          placeholder="Data scadenza es. 25/08/2026"
          placeholderTextColor={colors.placeholder}
          value={deadlineDate}
          onChangeText={setDeadlineDate}
        />

        <TextInput
          style={styles.input}
          placeholder="Ora scadenza es. 18:00"
          placeholderTextColor={colors.placeholder}
          value={deadlineTime}
          onChangeText={setDeadlineTime}
        />

        <TouchableOpacity style={styles.saveButton} onPress={saveTotalRooms}>
          <Ionicons name="save-outline" size={22} color="white" />
          <Text style={styles.saveButtonText}>Salva configurazione</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.summaryGrid}>
        {roomTypes.map((type) => (
          <View key={type} style={styles.summaryBox}>
            <Text style={styles.summaryNumber}>
              {Math.max(remainingTotals[type], 0)}
            </Text>
            <Text style={styles.summaryLabel}>{type} rimaste</Text>
            <Text style={styles.summarySubLabel}>
              Completate: {completedTotals[type]}
            </Text>
          </View>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Seleziona maestro</Text>

        {availableTeachers.length === 0 ? (
          <Text style={styles.emptyText}>
            Nessun maestro disponibile. Crea prima un maestro in Gestione
            utenti.
          </Text>
        ) : (
          availableTeachers.map((teacher) => {
            const selected = selectedTeacher?.id === teacher.id;
            const assignment = getAssignmentForTeacher(teacher.username);

            return (
              <TouchableOpacity
                key={teacher.id}
                style={[
                  styles.teacherButton,
                  selected && styles.teacherButtonActive,
                ]}
                onPress={() => selectTeacher(teacher)}
              >
                <View style={styles.teacherInfo}>
                  <Text style={styles.teacherName}>
                    {getTeacherFullName(teacher)}
                  </Text>

                  <Text style={styles.teacherSchool}>
                    @{teacher.username} •{" "}
                    {teacher.danceSchool || "Scuola non inserita"}
                  </Text>

                  {assignment ? (
                    <>
                      <Text style={styles.assignmentText}>
                        Assegnate — Doppie: {assignment.quantities?.Doppia || 0} • Triple:{" "}
                        {assignment.quantities?.Tripla || 0} • Quadruple:{" "}
                        {assignment.quantities?.Quadrupla || 0}
                      </Text>

                      <Text style={styles.completedText}>
                        Completate — Doppie: {getCompletedForTeacher(teacher.username).Doppia} • Triple:{" "}
                        {getCompletedForTeacher(teacher.username).Tripla} • Quadruple:{" "}
                        {getCompletedForTeacher(teacher.username).Quadrupla}
                      </Text>

                      <Text style={styles.remainingText}>
                        Rimaste — Doppie: {getRemainingForAssignment(assignment).Doppia} • Triple:{" "}
                        {getRemainingForAssignment(assignment).Tripla} • Quadruple:{" "}
                        {getRemainingForAssignment(assignment).Quadrupla}
                      </Text>
                    </>
                  ) : null}
                </View>

                <Ionicons
                  name={selected ? "checkmark-circle" : "ellipse-outline"}
                  size={24}
                  color={selected ? colors.primary : colors.secondary}
                />
              </TouchableOpacity>
            );
          })
        )}
      </View>

      {selectedTeacher ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            Assegna camere a {getTeacherFullName(selectedTeacher)}
          </Text>

          {getAssignmentForTeacher(selectedTeacher.username) ? (
            <View style={styles.remainingCard}>
              <Text style={styles.remainingCardTitle}>Situazione attuale</Text>
              <Text style={styles.remainingCardText}>
                Doppie rimaste: {getRemainingForAssignment(getAssignmentForTeacher(selectedTeacher.username)).Doppia}
              </Text>
              <Text style={styles.remainingCardText}>
                Triple rimaste: {getRemainingForAssignment(getAssignmentForTeacher(selectedTeacher.username)).Tripla}
              </Text>
              <Text style={styles.remainingCardText}>
                Quadruple rimaste: {getRemainingForAssignment(getAssignmentForTeacher(selectedTeacher.username)).Quadrupla}
              </Text>
            </View>
          ) : null}

          <TextInput
            style={styles.input}
            placeholder="Doppie da assegnare"
            placeholderTextColor={colors.placeholder}
            value={assignDoppie}
            onChangeText={setAssignDoppie}
            keyboardType="numeric"
          />

          <TextInput
            style={styles.input}
            placeholder="Triple da assegnare"
            placeholderTextColor={colors.placeholder}
            value={assignTriple}
            onChangeText={setAssignTriple}
            keyboardType="numeric"
          />

          <TextInput
            style={styles.input}
            placeholder="Quadruple da assegnare"
            placeholderTextColor={colors.placeholder}
            value={assignQuadruple}
            onChangeText={setAssignQuadruple}
            keyboardType="numeric"
          />

          <TouchableOpacity style={styles.saveButton} onPress={saveAssignment}>
            <Ionicons name="bed" size={22} color={colors.text} />
            <Text style={styles.saveButtonText}>Salva assegnazione</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </ScrollView>
  );
}

const createStyles = (colors: any, isDark: boolean) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },

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
      marginBottom: 24,
    },

    card: {
      backgroundColor: colors.card,
      borderRadius: 28,
      padding: 20,
      marginBottom: 22,
    },

    cardTitle: {
      color: colors.text,
      fontSize: 23,
      fontWeight: "900",
      marginBottom: 18,
    },

    sectionTitle: {
      color: colors.text,
      fontSize: 18,
      fontWeight: "900",
      marginBottom: 12,
      marginTop: 8,
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

    saveButton: {
      backgroundColor: colors.primary,
      borderRadius: 20,
      paddingVertical: 17,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      marginTop: 6,
    },

    saveButtonText: {
      color: colors.onPrimary,
      fontSize: 16,
      fontWeight: "900",
      marginLeft: 8,
    },

    summaryGrid: {
      flexDirection: "row",
      gap: 10,
      marginBottom: 22,
    },

    summaryBox: {
      flex: 1,
      backgroundColor: colors.card,
      borderRadius: 22,
      paddingVertical: 18,
      alignItems: "center",
      borderWidth: 1,
      borderColor: colors.border,
    },

    summaryNumber: {
      color: colors.text,
      fontSize: 24,
      fontWeight: "900",
      marginBottom: 4,
    },

    summaryLabel: {
      color: colors.secondary,
      fontSize: 12,
      fontWeight: "800",
      textAlign: "center",
    },

    summarySubLabel: {
      color: colors.primary,
      fontSize: 11,
      fontWeight: "900",
      textAlign: "center",
      marginTop: 5,
    },

    teacherButton: {
      backgroundColor: colors.background,
      borderRadius: 20,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.border,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },

    teacherButtonActive: {
      borderColor: colors.primary,
      backgroundColor: "transparent",
      borderWidth: 2,
    },

    teacherInfo: {
      flex: 1,
      paddingRight: 12,
    },

    teacherName: {
      color: colors.text,
      fontSize: 17,
      fontWeight: "900",
      marginBottom: 4,
    },

    teacherSchool: {
      color: colors.secondary,
      fontSize: 14,
      fontWeight: "800",
    },

    assignmentText: {
      color: colors.primary,
      fontSize: 13,
      fontWeight: "900",
      marginTop: 8,
    },

    completedText: {
      color: colors.success,
      fontSize: 13,
      fontWeight: "900",
      marginTop: 5,
    },

    remainingText: {
      color: colors.warning,
      fontSize: 13,
      fontWeight: "900",
      marginTop: 5,
    },

    remainingCard: {
      backgroundColor: colors.background,
      borderRadius: 18,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 16,
    },

    remainingCardTitle: {
      color: colors.text,
      fontSize: 17,
      fontWeight: "900",
      marginBottom: 10,
    },

    remainingCardText: {
      color: colors.warning,
      fontSize: 14,
      fontWeight: "900",
      marginBottom: 5,
    },

    emptyText: {
      color: colors.secondary,
      fontSize: 15,
      lineHeight: 22,
    },
  });
