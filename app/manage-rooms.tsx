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
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useTheme } from "../contexts/ThemeContext";
import { useFeedback } from "../contexts/FeedbackContext";
import { db } from "../firebase";
import { ProfileAvatar } from "../components/ProfileAvatar";
import { getTeacherProfileImage } from "../utils/profileImages";

type RoomType = "Doppia" | "Tripla" | "Quadrupla";

type TeacherUser = {
  id: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  danceSchool?: string;
  profileImage?: string;
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
  const { success, error, warning, info, confirm } = useFeedback();
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
  const [teacherSearch, setTeacherSearch] = useState("");
  const [teacherFilter, setTeacherFilter] = useState<"all" | "assigned" | "unassigned">("all");

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

  const reservedTotals = useMemo(() => {
    return validAssignments.reduce(
      (acc, assignment) => {
        const completed = getCompletedForTeacher(assignment.teacherUsername);

        roomTypes.forEach((type) => {
          const assigned = Number(assignment.quantities?.[type] || 0);
          acc[type] += Math.max(assigned, completed[type]);
        });

        return acc;
      },
      { Doppia: 0, Tripla: 0, Quadrupla: 0 } as Record<RoomType, number>,
    );
  }, [validAssignments, completedRoomsByTeacher]);

  const remainingTotals = {
    Doppia: Number(settings.totalRooms?.Doppia || 0) - reservedTotals.Doppia,
    Tripla: Number(settings.totalRooms?.Tripla || 0) - reservedTotals.Tripla,
    Quadrupla:
      Number(settings.totalRooms?.Quadrupla || 0) - reservedTotals.Quadrupla,
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

      success("Configurazione salvata", "Disponibilità e scadenza modifiche sono state aggiornate live.");
    } catch {
      error("Salvataggio non riuscito", "Non è stato possibile salvare la configurazione stanze.");
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
      warning("Maestro mancante", "Seleziona prima un maestro.");
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

    const totalRooms = {
      Doppia: Number(settings.totalRooms?.Doppia || 0),
      Tripla: Number(settings.totalRooms?.Tripla || 0),
      Quadrupla: Number(settings.totalRooms?.Quadrupla || 0),
    };

    // Le camere non completate liberate da un maestro tornano subito disponibili.
    // Quelle già completate/salvate restano invece fisicamente occupate.
    const reservedByOthers = validAssignments.reduce(
      (acc, assignment) => {
        if (assignment.teacherUsername === selectedTeacher.username) return acc;

        const completed = getCompletedForTeacher(assignment.teacherUsername);

        roomTypes.forEach((type) => {
          const assigned = Number(assignment.quantities?.[type] || 0);
          acc[type] += Math.max(assigned, completed[type]);
        });

        return acc;
      },
      { Doppia: 0, Tripla: 0, Quadrupla: 0 } as Record<RoomType, number>,
    );

    const selectedCompleted = getCompletedForTeacher(selectedTeacher.username);

    const nextReserved = {
      Doppia:
        reservedByOthers.Doppia +
        Math.max(newQuantities.Doppia, selectedCompleted.Doppia),
      Tripla:
        reservedByOthers.Tripla +
        Math.max(newQuantities.Tripla, selectedCompleted.Tripla),
      Quadrupla:
        reservedByOthers.Quadrupla +
        Math.max(newQuantities.Quadrupla, selectedCompleted.Quadrupla),
    };

    if (
      nextReserved.Doppia > totalRooms.Doppia ||
      nextReserved.Tripla > totalRooms.Tripla ||
      nextReserved.Quadrupla > totalRooms.Quadrupla
    ) {
      const unavailableTypes = roomTypes
        .filter((type) => nextReserved[type] > totalRooms[type])
        .map(
          (type) =>
            `${type}: richieste ${nextReserved[type]} su ${totalRooms[type]}`,
        )
        .join(" • ");

      warning(
        "Disponibilità insufficiente",
        `Non ci sono abbastanza camere libere. ${unavailableTypes}`,
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

      success("Assegnazione salvata", "Le camere sono state assegnate live al maestro.");
      closeTeacherEditor();
    } catch {
      error("Assegnazione non salvata", "Non è stato possibile salvare l’assegnazione.");
    }
  };

  const availableTeachers = teachers.filter((teacher) => teacher.username);

  const filteredTeachers = useMemo(() => {
    const query = teacherSearch.trim().toLowerCase();

    return [...availableTeachers]
      .filter((teacher) => {
        const assignment = getAssignmentForTeacher(teacher.username);
        const hasAssignment = Boolean(
          Number(assignment?.quantities?.Doppia || 0) ||
            Number(assignment?.quantities?.Tripla || 0) ||
            Number(assignment?.quantities?.Quadrupla || 0),
        );

        if (teacherFilter === "assigned" && !hasAssignment) return false;
        if (teacherFilter === "unassigned" && hasAssignment) return false;

        if (!query) return true;

        return [
          getTeacherFullName(teacher),
          teacher.username,
          teacher.danceSchool,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(query);
      })
      .sort((a, b) =>
        getTeacherFullName(a).localeCompare(getTeacherFullName(b)),
      );
  }, [availableTeachers, assignments, teacherSearch, teacherFilter]);

  const closeTeacherEditor = () => {
    setSelectedTeacher(null);
    setAssignDoppie("");
    setAssignTriple("");
    setAssignQuadruple("");
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

      {!selectedTeacher ? (
        <View style={styles.card}>
          <View style={styles.teacherListHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Maestri</Text>
              <Text style={styles.teacherListSubtitle}>
                Cerca il maestro e apri solo la sua assegnazione.
              </Text>
            </View>

            <View style={styles.teacherCountPill}>
              <Text style={styles.teacherCountText}>{filteredTeachers.length}</Text>
            </View>
          </View>

          <View style={styles.teacherSearchBox}>
            <Ionicons name="search-outline" size={19} color={colors.secondary} />
            <TextInput
              style={styles.teacherSearchInput}
              value={teacherSearch}
              onChangeText={setTeacherSearch}
              placeholder="Cerca maestro, username o scuola"
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
              ["assigned", "Con camere"],
              ["unassigned", "Senza camere"],
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

          {filteredTeachers.length === 0 ? (
            <View style={styles.compactEmptyBox}>
              <Ionicons name="people-outline" size={36} color={colors.secondary} />
              <Text style={styles.emptyText}>Nessun maestro trovato.</Text>
            </View>
          ) : (
            filteredTeachers.map((teacher) => {
              const assignment = getAssignmentForTeacher(teacher.username);
              const completed = getCompletedForTeacher(teacher.username);
              const assignedCount =
                Number(assignment?.quantities?.Doppia || 0) +
                Number(assignment?.quantities?.Tripla || 0) +
                Number(assignment?.quantities?.Quadrupla || 0);
              const completedCount =
                completed.Doppia + completed.Tripla + completed.Quadrupla;

              return (
                <TouchableOpacity
                  key={teacher.id}
                  style={styles.compactTeacherCard}
                  onPress={() => selectTeacher(teacher)}
                  activeOpacity={0.8}
                >
                  <ProfileAvatar uri={getTeacherProfileImage(teacher as unknown as Record<string, unknown>)} size={40} color={colors.primary} backgroundColor={colors.cardAlt} style={styles.compactTeacherAvatar} />

                  <View style={styles.compactTeacherInfo}>
                    <Text style={styles.compactTeacherName} numberOfLines={1}>
                      {getTeacherFullName(teacher)}
                    </Text>

                    <Text style={styles.compactTeacherSchool} numberOfLines={1}>
                      @{teacher.username} • {teacher.danceSchool || "Scuola non inserita"}
                    </Text>

                    <View style={styles.compactTeacherStats}>
                      <View style={styles.compactStatPill}>
                        <Ionicons name="bed-outline" size={12} color={colors.primary} />
                        <Text style={styles.compactStatText}>
                          {assignedCount} assegnate
                        </Text>
                      </View>

                      <View style={styles.compactStatPill}>
                        <Ionicons name="checkmark-circle-outline" size={12} color={colors.success} />
                        <Text style={styles.compactStatText}>
                          {completedCount} completate
                        </Text>
                      </View>
                    </View>
                  </View>

                  <Ionicons
                    name="chevron-forward-outline"
                    size={21}
                    color={colors.secondary}
                  />
                </TouchableOpacity>
              );
            })
          )}
        </View>
      ) : (
        <View style={styles.card}>
          <View style={styles.teacherEditorTop}>
            <TouchableOpacity
              style={styles.teacherEditorBack}
              onPress={closeTeacherEditor}
            >
              <Ionicons name="chevron-back-outline" size={18} color={colors.primary} />
              <Text style={styles.teacherEditorBackText}>Torna ai maestri</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.cardTitle}>
            Assegna camere a {getTeacherFullName(selectedTeacher)}
          </Text>

          <Text style={styles.selectedTeacherMeta}>
            @{selectedTeacher.username} • {selectedTeacher.danceSchool || "Scuola non inserita"}
          </Text>

          {getAssignmentForTeacher(selectedTeacher.username) ? (
            <View style={styles.remainingCard}>
              <Text style={styles.remainingCardTitle}>Situazione attuale</Text>

              <View style={styles.currentRoomGrid}>
                {roomTypes.map((type) => {
                  const assignment = getAssignmentForTeacher(selectedTeacher.username);
                  const assigned = Number(assignment?.quantities?.[type] || 0);
                  const completed = getCompletedForTeacher(selectedTeacher.username)[type];
                  const remaining = getRemainingForAssignment(assignment)[type];

                  return (
                    <View key={type} style={styles.currentRoomBox}>
                      <Text style={styles.currentRoomType}>{type}</Text>
                      <Text style={styles.currentRoomAssigned}>{assigned}</Text>
                      <Text style={styles.currentRoomSmall}>assegnate</Text>
                      <Text style={styles.currentRoomComplete}>{completed} completate</Text>
                      <Text style={styles.currentRoomRemaining}>{remaining} rimaste</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          ) : (
            <View style={styles.noAssignmentBox}>
              <Ionicons name="bed-outline" size={22} color={colors.secondary} />
              <Text style={styles.noAssignmentText}>
                Nessuna camera ancora assegnata a questo maestro.
              </Text>
            </View>
          )}

          <Text style={styles.assignmentSectionTitle}>Nuova assegnazione</Text>

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
            <Ionicons name="bed" size={22} color={colors.onPrimary} />
            <Text style={styles.saveButtonText}>Salva assegnazione</Text>
          </TouchableOpacity>
        </View>
      )}

    </ScrollView>
  );
}

const createStyles = (colors: any, isDark: boolean) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },

    content: {
      paddingTop: 34,
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
      fontSize: 31,
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
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: "#000",
      shadowOpacity: isDark ? 0.14 : 0.045,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
      elevation: 2,
      borderRadius: 28,
      padding: 20,
      marginBottom: 16,
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
      borderRadius: 18,
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
      marginBottom: 16,
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
      color: colors.onPrimary,
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

    teacherListHeader: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      marginBottom: 12,
    },

    teacherListSubtitle: {
      color: colors.secondary,
      fontSize: 12,
      lineHeight: 17,
      fontWeight: "700",
      marginTop: -10,
    },

    teacherCountPill: {
      minWidth: 36,
      height: 36,
      borderRadius: 12,
      backgroundColor: `${colors.primary}14`,
      alignItems: "center",
      justifyContent: "center",
      marginLeft: 10,
    },

    teacherCountText: {
      color: colors.primary,
      fontSize: 13,
      fontWeight: "900",
    },

    teacherSearchBox: {
      height: 50,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 13,
      marginBottom: 10,
    },

    teacherSearchInput: {
      flex: 1,
      color: colors.text,
      fontSize: 13,
      fontWeight: "700",
      marginLeft: 8,
    },

    teacherFilters: {
      flexDirection: "row",
      gap: 7,
      marginBottom: 12,
    },

    teacherFilterButton: {
      flex: 1,
      minHeight: 38,
      borderRadius: 13,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
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
      textAlign: "center",
    },

    teacherFilterTextActive: {
      color: colors.onPrimary,
    },

    compactTeacherCard: {
      minHeight: 76,
      borderRadius: 17,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
      padding: 10,
      marginBottom: 8,
      flexDirection: "row",
      alignItems: "center",
    },

    compactTeacherAvatar: {
      width: 46,
      height: 46,
      borderRadius: 14,
      backgroundColor: `${colors.primary}12`,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 10,
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

    compactTeacherSchool: {
      color: colors.secondary,
      fontSize: 10,
      fontWeight: "700",
      marginTop: 3,
    },

    compactTeacherStats: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 5,
      marginTop: 6,
    },

    compactStatPill: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.card,
      borderRadius: 9,
      paddingHorizontal: 6,
      paddingVertical: 4,
    },

    compactStatText: {
      color: colors.secondary,
      fontSize: 9,
      fontWeight: "900",
      marginLeft: 4,
    },

    compactEmptyBox: {
      alignItems: "center",
      paddingVertical: 28,
    },

    teacherEditorTop: {
      marginBottom: 12,
    },

    teacherEditorBack: {
      alignSelf: "flex-start",
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: `${colors.primary}12`,
      borderRadius: 12,
      paddingHorizontal: 10,
      paddingVertical: 8,
    },

    teacherEditorBackText: {
      color: colors.primary,
      fontSize: 12,
      fontWeight: "900",
      marginLeft: 4,
    },

    selectedTeacherMeta: {
      color: colors.secondary,
      fontSize: 12,
      fontWeight: "800",
      marginTop: -10,
      marginBottom: 16,
    },

    currentRoomGrid: {
      flexDirection: "row",
      gap: 7,
    },

    currentRoomBox: {
      flex: 1,
      backgroundColor: colors.card,
      borderRadius: 14,
      paddingVertical: 10,
      paddingHorizontal: 5,
      alignItems: "center",
    },

    currentRoomType: {
      color: colors.secondary,
      fontSize: 9,
      fontWeight: "900",
    },

    currentRoomAssigned: {
      color: colors.text,
      fontSize: 20,
      fontWeight: "900",
      marginTop: 3,
    },

    currentRoomSmall: {
      color: colors.secondary,
      fontSize: 8,
      fontWeight: "700",
    },

    currentRoomComplete: {
      color: colors.success,
      fontSize: 8,
      fontWeight: "900",
      marginTop: 5,
      textAlign: "center",
    },

    currentRoomRemaining: {
      color: colors.warning,
      fontSize: 8,
      fontWeight: "900",
      marginTop: 2,
      textAlign: "center",
    },

    noAssignmentBox: {
      backgroundColor: colors.background,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 16,
    },

    noAssignmentText: {
      flex: 1,
      color: colors.secondary,
      fontSize: 12,
      fontWeight: "700",
      marginLeft: 9,
    },

    assignmentSectionTitle: {
      color: colors.text,
      fontSize: 17,
      fontWeight: "900",
      marginBottom: 12,
    },

    teacherButton: {
      backgroundColor: colors.background,
      borderRadius: 18,
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
