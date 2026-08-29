import { Ionicons } from "@expo/vector-icons";
import {
  collection,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import {
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
  quantities?: Partial<Record<RoomType, number>>;
};

type RoomData = {
  id: string;
  teacherUsername?: string;
  roomType?: RoomType;
  roomIndex?: number;
  isSaved?: boolean;
  paymentVisible?: boolean;
  savedAt?: any;
};

type RoomSettings = {
  totalRooms?: Partial<Record<RoomType, number>>;
  editDeadlineDate?: string;
  editDeadlineTime?: string;
};

const roomTypes: RoomType[] = ["Doppia", "Tripla", "Quadrupla"];

export default function AdminWebRoomsScreen() {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const isMobile = width < 700;
  const isTablet = width >= 700 && width < 1050;
  const { success, error, warning } = useFeedback();

  const [teachers, setTeachers] = useState<TeacherUser[]>([]);
  const [assignments, setAssignments] = useState<RoomAssignment[]>([]);
  const [roomsData, setRoomsData] = useState<RoomData[]>([]);
  const [settings, setSettings] = useState<RoomSettings>({
    totalRooms: { Doppia: 0, Tripla: 0, Quadrupla: 0 },
    editDeadlineDate: "",
    editDeadlineTime: "",
  });

  const [selectedTeacher, setSelectedTeacher] = useState<TeacherUser | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "assigned" | "unassigned">("all");

  const [assignDoppie, setAssignDoppie] = useState("");
  const [assignTriple, setAssignTriple] = useState("");
  const [assignQuadruple, setAssignQuadruple] = useState("");

  useEffect(() => {
    const unsubTeachers = onSnapshot(collection(db, "teachers"), (snapshot) => {
      setTeachers(
        snapshot.docs.map((item) => ({
          id: item.id,
          ...(item.data() as Omit<TeacherUser, "id">),
        })),
      );
    });

    const unsubAssignments = onSnapshot(
      collection(db, "roomAssignments"),
      (snapshot) => {
        setAssignments(
          snapshot.docs.map((item) => ({
            id: item.id,
            ...(item.data() as Omit<RoomAssignment, "id">),
          })),
        );
      },
    );

    const unsubRooms = onSnapshot(collection(db, "roomsData"), (snapshot) => {
      setRoomsData(
        snapshot.docs.map((item) => ({
          id: item.id,
          ...(item.data() as Omit<RoomData, "id">),
        })),
      );
    });

    const unsubSettings = onSnapshot(doc(db, "settings", "rooms"), (snapshot) => {
      if (!snapshot.exists()) return;

      const data = snapshot.data() as RoomSettings;

      setSettings({
        totalRooms: {
          Doppia: Number(data.totalRooms?.Doppia || 0),
          Tripla: Number(data.totalRooms?.Tripla || 0),
          Quadrupla: Number(data.totalRooms?.Quadrupla || 0),
        },
        editDeadlineDate: data.editDeadlineDate || "",
        editDeadlineTime: data.editDeadlineTime || "",
      });
    });

    return () => {
      unsubTeachers();
      unsubAssignments();
      unsubRooms();
      unsubSettings();
    };
  }, []);

  const getTeacherFullName = (teacher?: TeacherUser | null) => {
    if (!teacher) return "Maestro";
    const fullName = `${teacher.firstName || ""} ${teacher.lastName || ""}`.trim();
    return fullName || teacher.username || "Maestro";
  };

  const getAssignmentForTeacher = (username?: string) => {
    if (!username) return null;
    return (
      assignments.find((item) => item.teacherUsername === username) || null
    );
  };

  const completedByTeacher = useMemo(() => {
    return roomsData
      .filter((room) => room.teacherUsername && room.roomType)
      .filter((room) => Boolean(room.isSaved || room.paymentVisible || room.savedAt))
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

  const getCompleted = (username?: string) => {
    if (!username) return { Doppia: 0, Tripla: 0, Quadrupla: 0 };
    return (
      completedByTeacher[username] || {
        Doppia: 0,
        Tripla: 0,
        Quadrupla: 0,
      }
    );
  };

  const reservedTotals = useMemo(() => {
    return assignments.reduce(
      (acc, assignment) => {
        const completed = getCompleted(assignment.teacherUsername);

        roomTypes.forEach((type) => {
          const assigned = Number(assignment.quantities?.[type] || 0);
          acc[type] += Math.max(assigned, completed[type]);
        });

        return acc;
      },
      { Doppia: 0, Tripla: 0, Quadrupla: 0 } as Record<RoomType, number>,
    );
  }, [assignments, completedByTeacher]);

  const remainingTotals = {
    Doppia: Math.max(
      Number(settings.totalRooms?.Doppia || 0) - reservedTotals.Doppia,
      0,
    ),
    Tripla: Math.max(
      Number(settings.totalRooms?.Tripla || 0) - reservedTotals.Tripla,
      0,
    ),
    Quadrupla: Math.max(
      Number(settings.totalRooms?.Quadrupla || 0) - reservedTotals.Quadrupla,
      0,
    ),
  };

  const filteredTeachers = useMemo(() => {
    const q = search.trim().toLowerCase();

    return teachers
      .filter((teacher) => teacher.username)
      .filter((teacher) => {
        const assignment = getAssignmentForTeacher(teacher.username);
        const totalAssigned =
          Number(assignment?.quantities?.Doppia || 0) +
          Number(assignment?.quantities?.Tripla || 0) +
          Number(assignment?.quantities?.Quadrupla || 0);

        if (filter === "assigned" && totalAssigned === 0) return false;
        if (filter === "unassigned" && totalAssigned > 0) return false;

        if (!q) return true;

        return [
          getTeacherFullName(teacher),
          teacher.username,
          teacher.danceSchool,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(q);
      })
      .sort((a, b) =>
        getTeacherFullName(a).localeCompare(getTeacherFullName(b)),
      );
  }, [teachers, assignments, search, filter]);

  const selectTeacher = (teacher: TeacherUser) => {
    setSelectedTeacher(teacher);

    const assignment = getAssignmentForTeacher(teacher.username);

    setAssignDoppie(String(assignment?.quantities?.Doppia || ""));
    setAssignTriple(String(assignment?.quantities?.Tripla || ""));
    setAssignQuadruple(String(assignment?.quantities?.Quadrupla || ""));
  };

  const toNumber = (value: string) => {
    const n = Number(value || 0);
    return Number.isNaN(n) ? 0 : n;
  };

  const saveAssignment = async () => {
    if (!selectedTeacher?.username) {
      warning("Maestro mancante", "Seleziona prima un maestro.");
      return;
    }

    const newQuantities: Record<RoomType, number> = {
      Doppia: toNumber(assignDoppie),
      Tripla: toNumber(assignTriple),
      Quadrupla: toNumber(assignQuadruple),
    };

    const completedSelected = getCompleted(selectedTeacher.username);

    const reservedByOthers = assignments.reduce(
      (acc, assignment) => {
        if (assignment.teacherUsername === selectedTeacher.username) return acc;

        const completed = getCompleted(assignment.teacherUsername);

        roomTypes.forEach((type) => {
          const assigned = Number(assignment.quantities?.[type] || 0);
          acc[type] += Math.max(assigned, completed[type]);
        });

        return acc;
      },
      { Doppia: 0, Tripla: 0, Quadrupla: 0 } as Record<RoomType, number>,
    );

    const nextReserved = {
      Doppia:
        reservedByOthers.Doppia +
        Math.max(newQuantities.Doppia, completedSelected.Doppia),
      Tripla:
        reservedByOthers.Tripla +
        Math.max(newQuantities.Tripla, completedSelected.Tripla),
      Quadrupla:
        reservedByOthers.Quadrupla +
        Math.max(newQuantities.Quadrupla, completedSelected.Quadrupla),
    };

    const totalRooms = {
      Doppia: Number(settings.totalRooms?.Doppia || 0),
      Tripla: Number(settings.totalRooms?.Tripla || 0),
      Quadrupla: Number(settings.totalRooms?.Quadrupla || 0),
    };

    const invalidTypes = roomTypes.filter(
      (type) => nextReserved[type] > totalRooms[type],
    );

    if (invalidTypes.length > 0) {
      warning(
        "Disponibilità insufficiente",
        invalidTypes
          .map(
            (type) =>
              `${type}: ${nextReserved[type]} richieste su ${totalRooms[type]} disponibili`,
          )
          .join(" • "),
      );
      return;
    }

    try {
      await setDoc(
        doc(db, "roomAssignments", selectedTeacher.username),
        {
          teacherUsername: selectedTeacher.username,
          teacherFullName: getTeacherFullName(selectedTeacher),
          danceSchool: selectedTeacher.danceSchool || "",
          quantities: newQuantities,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );

      success(
        "Assegnazione salvata",
        "Le camere sono state aggiornate live per questo maestro.",
      );
    } catch {
      error(
        "Assegnazione non salvata",
        "Non è stato possibile aggiornare le camere.",
      );
    }
  };

  const assignedTotalForTeacher = (teacher: TeacherUser) => {
    const assignment = getAssignmentForTeacher(teacher.username);
    return roomTypes.reduce(
      (sum, type) => sum + Number(assignment?.quantities?.[type] || 0),
      0,
    );
  };

  return (
    <View style={[styles.screen, (isMobile || isTablet) && styles.screenCompact, { backgroundColor: colors.background }]}> 
      <View
        style={[
          styles.sidebar, (isMobile || isTablet) && styles.sidebarCompact,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
          },
        ]}
      >
        <View style={styles.selectorHeader}>
          <View
            style={[
              styles.selectorHeaderIcon,
              { backgroundColor: `${colors.primary}12` },
            ]}
          >
            <Ionicons name="people-outline" size={19} color={colors.primary} />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={[styles.sidebarTitle, { color: colors.text }]}>
              Maestri
            </Text>
            <Text style={[styles.sidebarSubtitle, { color: colors.secondary }]}>
              Seleziona chi vuoi gestire.
            </Text>
          </View>
        </View>

        <View
          style={[
            styles.searchBox,
            {
              backgroundColor: colors.background,
              borderColor: colors.border,
            },
          ]}
        >
          <Ionicons name="search-outline" size={18} color={colors.secondary} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            value={search}
            onChangeText={setSearch}
            placeholder="Cerca maestro o scuola"
            placeholderTextColor={colors.secondary}
          />
        </View>

        <View style={styles.filterRow}>
          {([
            ["all", "Tutti"],
            ["assigned", "Con camere"],
            ["unassigned", "Senza camere"],
          ] as const).map(([value, label]) => {
            const active = filter === value;

            return (
              <TouchableOpacity
                key={value}
                style={[
                  styles.filterButton,
                  {
                    borderColor: active ? colors.primary : colors.border,
                    backgroundColor: active
                      ? colors.primary
                      : colors.background,
                  },
                ]}
                onPress={() => setFilter(value)}
              >
                <Text
                  style={{
                    color: active ? colors.onPrimary : colors.secondary,
                    fontWeight: "900",
                    fontSize: 9,
                  }}
                >
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <ScrollView
          style={styles.teacherList}
          showsVerticalScrollIndicator={false}
        >
          {filteredTeachers.map((teacher) => {
            const assignment = getAssignmentForTeacher(teacher.username);
            const completed = getCompleted(teacher.username);
            const selected = selectedTeacher?.id === teacher.id;

            return (
              <TouchableOpacity
                key={teacher.id}
                style={[
                  styles.teacherCard,
                  {
                    backgroundColor: selected
                      ? `${colors.primary}12`
                      : colors.background,
                    borderColor: selected ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => selectTeacher(teacher)}
              >
                <View
                  style={[
                    styles.avatar,
                    { backgroundColor: `${colors.primary}12` },
                  ]}
                >
                  <Ionicons name="person-outline" size={18} color={colors.primary} />
                </View>

                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text
                    style={[styles.teacherName, { color: colors.text }]}
                    numberOfLines={1}
                  >
                    {getTeacherFullName(teacher)}
                  </Text>
                  <Text
                    style={[styles.teacherSchool, { color: colors.secondary }]}
                    numberOfLines={1}
                  >
                    @{teacher.username} • {teacher.danceSchool || "Scuola non inserita"}
                  </Text>

                  <Text style={[styles.teacherMeta, { color: colors.primary }]}>
                    {assignedTotalForTeacher(teacher)} assegnate •{" "}
                    {completed.Doppia + completed.Tripla + completed.Quadrupla} completate
                  </Text>
                </View>

                <Ionicons
                  name="chevron-forward-outline"
                  size={17}
                  color={colors.secondary}
                />
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView
        style={styles.main}
        contentContainerStyle={[styles.mainContent, isMobile && styles.mainContentMobile]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.header, isMobile && styles.headerMobile]}>
          <View>
            <Text style={[styles.title, { color: colors.text }]}>
              Gestione stanze
            </Text>
            <Text style={[styles.subtitle, { color: colors.secondary }]}>
              Assegna e redistribuisci camere senza perdere di vista la disponibilità reale.
            </Text>
          </View>

        </View>

        <View style={[styles.statsGrid, isMobile && styles.statsGridMobile]}>
          {roomTypes.map((type) => (
              <View
                key={type}
                style={[
                  styles.statCard,
                  isMobile && styles.statCardMobile,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                },
              ]}
            >
              <View
                style={[
                  styles.statIcon,
                  { backgroundColor: `${colors.primary}12` },
                ]}
              >
                <Ionicons name="bed-outline" size={20} color={colors.primary} />
              </View>

              <Text style={[styles.statTitle, { color: colors.secondary }]}>
                {type}
              </Text>

              <View style={styles.statNumbers}>
                <View>
                  <Text style={[styles.statValue, { color: colors.text }]}>
                    {Number(settings.totalRooms?.[type] || 0)}
                  </Text>
                  <Text style={[styles.statCaption, { color: colors.secondary }]}>
                    totali
                  </Text>
                </View>

                <View>
                  <Text style={[styles.statValue, { color: colors.primary }]}>
                    {reservedTotals[type]}
                  </Text>
                  <Text style={[styles.statCaption, { color: colors.secondary }]}>
                    riservate
                  </Text>
                </View>

                <View>
                  <Text style={[styles.statValue, { color: colors.success }]}>
                    {remainingTotals[type]}
                  </Text>
                  <Text style={[styles.statCaption, { color: colors.secondary }]}>
                    libere
                  </Text>
                </View>
              </View>
            </View>
          ))}
        </View>

        {!selectedTeacher ? (
          <View
            style={[
              styles.emptyPanel,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
              },
            ]}
          >
            <View
              style={[
                styles.emptyIcon,
                { backgroundColor: `${colors.primary}12` },
              ]}
            >
              <Ionicons name="people-outline" size={30} color={colors.primary} />
            </View>

            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              Seleziona un maestro
            </Text>
            <Text style={[styles.emptyText, { color: colors.secondary }]}>
              Usa la colonna a sinistra per aprire l’assegnazione di un maestro.
            </Text>
          </View>
        ) : (
          <View
            style={[
              styles.editor,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
              },
            ]}
          >
            <View style={styles.editorHeader}>
              <View>
                <Text style={[styles.editorEyebrow, { color: colors.primary }]}>
                  ASSEGNAZIONE CAMERE
                </Text>
                <Text style={[styles.editorTitle, { color: colors.text }]}>
                  {getTeacherFullName(selectedTeacher)}
                </Text>
                <Text style={[styles.editorSubtitle, { color: colors.secondary }]}>
                  @{selectedTeacher.username} •{" "}
                  {selectedTeacher.danceSchool || "Scuola non inserita"}
                </Text>
              </View>
            </View>

            <View style={[styles.roomEditorGrid, isMobile && styles.roomEditorGridMobile]}>
              {roomTypes.map((type) => {
                const value =
                  type === "Doppia"
                    ? assignDoppie
                    : type === "Tripla"
                      ? assignTriple
                      : assignQuadruple;

                const setValue =
                  type === "Doppia"
                    ? setAssignDoppie
                    : type === "Tripla"
                      ? setAssignTriple
                      : setAssignQuadruple;

                const completed = getCompleted(selectedTeacher.username)[type];

                return (
                  <View
                    key={type}
                    style={[
                      styles.roomEditorCard,
                      isMobile && styles.roomEditorCardMobile,
                      {
                        backgroundColor: colors.background,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <View style={styles.roomEditorTop}>
                      <Text style={[styles.roomEditorTitle, { color: colors.text }]}>
                        {type}
                      </Text>
                      <Text style={[styles.completedPill, { color: colors.success }]}>
                        {completed} completate
                      </Text>
                    </View>

                    <Text style={[styles.inputLabel, { color: colors.secondary }]}>
                      Camere assegnate
                    </Text>

                    <TextInput
                      style={[
                        styles.quantityInput,
                        {
                          color: colors.text,
                          borderColor: colors.border,
                          backgroundColor: colors.card,
                        },
                      ]}
                      value={value}
                      onChangeText={setValue}
                      keyboardType="numeric"
                      placeholder="0"
                      placeholderTextColor={colors.secondary}
                    />

                    <Text style={[styles.availableHint, { color: colors.secondary }]}>
                      Disponibili globalmente: {remainingTotals[type]}
                    </Text>
                  </View>
                );
              })}
            </View>

            <View
              style={[
                styles.deadlineBox,
                {
                  backgroundColor: `${colors.primary}0B`,
                  borderColor: `${colors.primary}24`,
                },
              ]}
            >
              <Ionicons name="time-outline" size={19} color={colors.primary} />
              <Text style={[styles.deadlineText, { color: colors.secondary }]}>
                Modifiche maestri fino al{" "}
                {settings.editDeadlineDate || "nessuna data"}{" "}
                {settings.editDeadlineTime
                  ? `alle ${settings.editDeadlineTime}`
                  : ""}
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.saveButton, { backgroundColor: colors.primary }]}
              onPress={saveAssignment}
            >
              <Ionicons name="save-outline" size={20} color={colors.onPrimary} />
              <Text style={[styles.saveButtonText, { color: colors.onPrimary }]}>
                Salva assegnazione
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    flexDirection: "row",
    minHeight: "100vh" as any,
  },
  screenCompact: { flexDirection: "column" },

  sidebar: {
    width: 315,
    borderRightWidth: 1,
    padding: 14,
  },
  sidebarCompact: { width: "100%", maxHeight: 340, borderRightWidth: 0, borderBottomWidth: 1 },

  selectorHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },

  selectorHeaderIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 9,
  },

  sidebarTitle: {
    fontSize: 18,
    fontWeight: "900",
  },

  sidebarSubtitle: {
    fontSize: 9,
    lineHeight: 13,
    fontWeight: "700",
    marginTop: 2,
  },

  searchBox: {
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    marginBottom: 9,
  },

  searchInput: {
    flex: 1,
    height: "100%",
    minHeight: 42,
    marginLeft: 8,
    fontSize: 12,
    fontWeight: "700",
  },

  filterRow: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 12,
  },

  filterButton: {
    flex: 1,
    minHeight: 35,
    borderRadius: 11,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  teacherList: {
    flex: 1,
  },

  teacherCard: {
    minHeight: 68,
    borderRadius: 16,
    borderWidth: 1,
    padding: 10,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
  },

  avatar: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 9,
  },

  teacherName: {
    fontSize: 12,
    fontWeight: "900",
  },

  teacherSchool: {
    fontSize: 9,
    fontWeight: "700",
    marginTop: 2,
  },

  teacherMeta: {
    fontSize: 9,
    fontWeight: "900",
    marginTop: 5,
  },

  main: {
    flex: 1,
  },

  mainContent: {
    paddingHorizontal: 26,
    paddingTop: 24,
    paddingBottom: 70,
  },
  mainContentMobile: { paddingHorizontal: 14, paddingTop: 18, paddingBottom: 50 },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 20,
  },
  headerMobile: { flexDirection: "column" },

  eyebrow: {
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.2,
    marginBottom: 7,
  },

  title: {
    fontSize: 34,
    fontWeight: "900",
    letterSpacing: -1,
  },

  subtitle: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "700",
    marginTop: 6,
  },

  mobileButton: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
  },

  mobileButtonText: {
    fontSize: 10,
    fontWeight: "900",
    marginLeft: 6,
  },

  statsGrid: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 20,
  },
  statsGridMobile: { flexDirection: "column" },

  statCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 20,
    padding: 15,
  },
  statCardMobile: { flexGrow: 0, flexShrink: 0, flexBasis: "auto", width: "100%", minWidth: 0 },

  statIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },

  statTitle: {
    fontSize: 10,
    fontWeight: "900",
    marginBottom: 10,
  },

  statNumbers: {
    flexDirection: "row",
    justifyContent: "space-between",
  },

  statValue: {
    fontSize: 21,
    fontWeight: "900",
  },

  statCaption: {
    fontSize: 8,
    fontWeight: "800",
    marginTop: 2,
  },

  emptyPanel: {
    minHeight: 430,
    borderWidth: 1,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    padding: 30,
  },

  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },

  emptyTitle: {
    fontSize: 20,
    fontWeight: "900",
  },

  emptyText: {
    fontSize: 11,
    fontWeight: "700",
    marginTop: 6,
    textAlign: "center",
  },

  editor: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 20,
  },

  editorHeader: {
    marginBottom: 18,
  },

  editorEyebrow: {
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1,
  },

  editorTitle: {
    fontSize: 25,
    fontWeight: "900",
    marginTop: 5,
  },

  editorSubtitle: {
    fontSize: 11,
    fontWeight: "700",
    marginTop: 4,
  },

  roomEditorGrid: {
    flexDirection: "row",
    gap: 12,
  },
  roomEditorGridMobile: { flexDirection: "column" },

  roomEditorCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
  },
  roomEditorCardMobile: { flexGrow: 0, flexShrink: 0, flexBasis: "auto", width: "100%", minWidth: 0 },

  roomEditorTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },

  roomEditorTitle: {
    fontSize: 15,
    fontWeight: "900",
  },

  completedPill: {
    fontSize: 8,
    fontWeight: "900",
  },

  inputLabel: {
    fontSize: 9,
    fontWeight: "800",
    marginBottom: 6,
  },

  quantityInput: {
    height: 50,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 13,
    fontSize: 18,
    fontWeight: "900",
  },

  availableHint: {
    fontSize: 8,
    fontWeight: "700",
    marginTop: 7,
  },

  deadlineBox: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
  },

  deadlineText: {
    fontSize: 10,
    fontWeight: "700",
    marginLeft: 8,
  },

  saveButton: {
    minHeight: 50,
    borderRadius: 15,
    marginTop: 16,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },

  saveButtonText: {
    fontSize: 11,
    fontWeight: "900",
    marginLeft: 7,
  },
});
