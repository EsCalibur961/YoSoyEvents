import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useFocusEffect } from "expo-router";
import { collection, onSnapshot } from "firebase/firestore";
import { useCallback, useMemo, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { db } from "../firebase";
import { useTheme } from "../contexts/ThemeContext";

type RoomType = "Doppia" | "Tripla" | "Quadrupla";

type Guest = {
  firstName: string;
  lastName: string;
  birthDate: string;
  birthPlace: string;
  selectedPackId: string;
  selectedPackLetter: string;
  selectedPackPrice: string;
  notes: string;
};

type RoomData = {
  id: string;
  teacherUsername: string;
  roomType: RoomType;
  roomIndex: number;
  customName?: string;
  guests: Guest[];
};

type TeacherUser = {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  danceSchool: string;
};

const roomTypes: RoomType[] = ["Doppia", "Tripla", "Quadrupla"];

export default function TeacherRoomListScreen() {
  const { colors, isDark } = useTheme();
  const styles = createStyles(colors, isDark);
  const [role, setRole] = useState<string | null>(null);
  const [teacherUsername, setTeacherUsername] = useState<string | null>(null);

  const [teachers, setTeachers] = useState<TeacherUser[]>([]);
  const [roomsData, setRoomsData] = useState<RoomData[]>([]);
  const [selectedTeacher, setSelectedTeacher] = useState<string | null>(null);
  const [openTypes, setOpenTypes] = useState<Record<RoomType, boolean>>({
    Doppia: true,
    Tripla: false,
    Quadrupla: false,
  });

  useFocusEffect(
    useCallback(() => {
      loadUser();

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

      const unsubRooms = onSnapshot(collection(db, "roomsData"), (snapshot) => {
        const data: RoomData[] = snapshot.docs.map((item) => ({
          id: item.id,
          ...(item.data() as Omit<RoomData, "id">),
        }));

        setRoomsData(data);
      });

      return () => {
        unsubTeachers();
        unsubRooms();
      };
    }, []),
  );

  const loadUser = async () => {
    const savedRole = await AsyncStorage.getItem("loggedUser");
    const savedTeacherUsername = await AsyncStorage.getItem("teacherUsername");

    setRole(savedRole);
    setTeacherUsername(savedTeacherUsername);

    if (savedRole === "teacher" && savedTeacherUsername) {
      setSelectedTeacher(savedTeacherUsername);
    }
  };

  const normalizeGuest = (guest: any): Guest => ({
    firstName: guest.firstName || "",
    lastName: guest.lastName || "",
    birthDate: guest.birthDate || "",
    birthPlace: guest.birthPlace || "",
    selectedPackId: guest.selectedPackId || "",
    selectedPackLetter: guest.selectedPackLetter || "",
    selectedPackPrice: guest.selectedPackPrice || "",
    notes: guest.notes || "",
  });

  const normalizeRoom = (room: any): RoomData => ({
    ...room,
    customName: room.customName || "",
    guests:
      room.guests || []
        ? (room.guests || []).map((guest: any) => normalizeGuest(guest))
        : [],
  });

  const normalizedRooms = roomsData.map((room) => normalizeRoom(room));

  const isGuestComplete = (guest: any) => {
    return Boolean(
      guest.firstName.trim() &&
      guest.lastName.trim() &&
      guest.birthDate.trim() &&
      guest.birthPlace.trim() &&
      guest.selectedPackId.trim(),
    );
  };

  const visibleRooms = useMemo(() => {
    if (!selectedTeacher) return [];

    return normalizedRooms.filter(
      (room) => room.teacherUsername === selectedTeacher,
    );
  }, [normalizedRooms, selectedTeacher]);

  const completeRooms = visibleRooms.filter((room) =>
    (room.guests || []).some((guest) => isGuestComplete(guest)),
  );

  const getTeacherName = (username: string) => {
    const teacher = teachers.find((item) => item.username === username);

    if (!teacher) return username;

    return `${teacher.firstName} ${teacher.lastName}`.trim();
  };

  const getTeacherSchool = (username: string) => {
    const teacher = teachers.find((item) => item.username === username);

    return teacher?.danceSchool || "";
  };

  const getGuestFullName = (guest: Guest) => {
    return `${guest.firstName} ${guest.lastName}`.trim();
  };

  const getRoomLabel = (room: RoomData) => {
    if (room.customName?.trim()) return room.customName.trim();

    return `${room.roomType} #${room.roomIndex}`;
  };

  const toggleType = (type: RoomType) => {
    setOpenTypes({
      ...openTypes,
      [type]: !openTypes[type],
    });
  };

  const roomsByType = (type: RoomType) => {
    return completeRooms.filter((room) => room.roomType === type);
  };

  const totalGuests = completeRooms.reduce((sum, room) => {
    return (
      sum + (room.guests || []).filter((guest) => isGuestComplete(guest)).length
    );
  }, 0);

  const totalAmount = completeRooms.reduce((sum, room) => {
    return (
      sum +
      (room.guests || []).reduce((guestSum, guest) => {
        if (!isGuestComplete(guest)) return guestSum;

        return guestSum + Number(guest.selectedPackPrice || 0);
      }, 0)
    );
  }, 0);

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

      <Text style={styles.title}>Lista camere</Text>

      <Text style={styles.subtitle}>
        Elenco live dei nominativi salvati nelle camere.
      </Text>

      {role === "admin" ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Seleziona maestro</Text>

          {teachers.length === 0 ? (
            <Text style={styles.emptyText}>Nessun maestro registrato.</Text>
          ) : (
            teachers.map((teacher) => (
              <TouchableOpacity
                key={teacher.id}
                style={[
                  styles.teacherButton,
                  selectedTeacher === teacher.username &&
                    styles.teacherButtonActive,
                ]}
                onPress={() => {
                  if (selectedTeacher === teacher.username) {
                    setSelectedTeacher(null);
                  } else {
                    setSelectedTeacher(teacher.username);
                  }
                }}
              >
                <View>
                  <Text style={styles.teacherName}>
                    {teacher.firstName} {teacher.lastName}
                  </Text>

                  <Text style={styles.teacherSchool}>
                    @{teacher.username} • {teacher.danceSchool}
                  </Text>
                </View>

                <Ionicons
                  name={
                    selectedTeacher === teacher.username
                      ? "checkmark-circle"
                      : "ellipse-outline"
                  }
                  size={24}
                  color={
                    selectedTeacher === teacher.username ? colors.primary : colors.secondary
                  }
                />
              </TouchableOpacity>
            ))
          )}
        </View>
      ) : null}

      {selectedTeacher ? (
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>
            {getTeacherName(selectedTeacher)}
          </Text>

          <Text style={styles.summarySubtitle}>
            {getTeacherSchool(selectedTeacher)}
          </Text>

          <View style={styles.summaryGrid}>
            <View style={styles.summaryBox}>
              <Text style={styles.summaryNumber}>{completeRooms.length}</Text>
              <Text style={styles.summaryLabel}>Camere</Text>
            </View>

            <View style={styles.summaryBox}>
              <Text style={styles.summaryNumber}>{totalGuests}</Text>
              <Text style={styles.summaryLabel}>Ospiti</Text>
            </View>

            <View style={styles.summaryBox}>
              <Text style={styles.summaryNumber}>€{totalAmount}</Text>
              <Text style={styles.summaryLabel}>Totale pack</Text>
            </View>
          </View>
        </View>
      ) : null}

      {!selectedTeacher ? (
        <View style={styles.emptyBox}>
          <Ionicons name="people-outline" size={50} color={colors.secondary} />

          <Text style={styles.emptyTitle}>Nessun maestro selezionato</Text>

          <Text style={styles.emptyText}>
            Seleziona un maestro per visualizzare la lista camere.
          </Text>
        </View>
      ) : completeRooms.length === 0 ? (
        <View style={styles.emptyBox}>
          <Ionicons name="bed" size={50} color={colors.secondary} />

          <Text style={styles.emptyTitle}>Nessuna camera salvata</Text>

          <Text style={styles.emptyText}>
            Le camere complete salvate dal maestro compariranno qui.
          </Text>
        </View>
      ) : (
        roomTypes.map((type) => {
          const typeRooms = roomsByType(type);

          if (typeRooms.length === 0) return null;

          return (
            <View key={type} style={styles.typeCard}>
              <TouchableOpacity
                style={styles.typeHeader}
                onPress={() => toggleType(type)}
              >
                <View>
                  <Text style={styles.typeTitle}>{type}</Text>

                  <Text style={styles.typeSubtitle}>
                    {typeRooms.length} camere salvate
                  </Text>
                </View>

                <Ionicons
                  name={
                    openTypes[type]
                      ? "chevron-up-outline"
                      : "chevron-down-outline"
                  }
                  size={24}
                  color={colors.text}
                />
              </TouchableOpacity>

              {openTypes[type] ? (
                <View style={styles.roomList}>
                  {typeRooms.map((room) => {
                    const guests = (room.guests || []).filter((guest) =>
                      isGuestComplete(guest),
                    );

                    return (
                      <View key={room.id} style={styles.roomCard}>
                        <View style={styles.roomHeader}>
                          <Text style={styles.roomTitle}>
                            {getRoomLabel(room)}
                          </Text>

                          <Text style={styles.roomSubtitle}>
                            {guests.length} ospiti
                          </Text>
                        </View>

                        {guests.map((guest, index) => (
                          <View
                            key={`${room.id}-${index}`}
                            style={styles.guestCard}
                          >
                            <View style={styles.guestHeader}>
                              <View style={styles.guestNumber}>
                                <Text style={styles.guestNumberText}>
                                  {index + 1}
                                </Text>
                              </View>

                              <View style={styles.guestMain}>
                                <Text style={styles.guestName}>
                                  {getGuestFullName(guest)}
                                </Text>

                                <Text style={styles.guestBirth}>
                                  Nato/a il {guest.birthDate} a{" "}
                                  {guest.birthPlace}
                                </Text>
                              </View>
                            </View>

                            <View style={styles.packBadge}>
                              <Text style={styles.packText}>
                                {`Pack ${guest.selectedPackLetter} • €${guest.selectedPackPrice}`}
                              </Text>
                            </View>

                            {guest.notes?.trim() ? (
                              <View style={styles.notesBadge}>
                                <Text style={styles.notesText}>
                                  Note: {guest.notes}
                                </Text>
                              </View>
                            ) : null}
                          </View>
                        ))}
                      </View>
                    );
                  })}
                </View>
              ) : null}
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

const createStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  content: {
    paddingTop: 52,
    paddingHorizontal: 22,
    paddingBottom: 130,
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
    lineHeight: 23,
    marginBottom: 24,
  },

  card: {
    backgroundColor: colors.card,
    borderRadius: 26,
    padding: 18,
    marginBottom: 20,
  },

  cardTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "900",
    marginBottom: 16,
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
  },

  teacherName: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "900",
  },

  teacherSchool: {
    color: colors.secondary,
    fontSize: 14,
    marginTop: 4,
  },

  summaryCard: {
    backgroundColor: colors.card,
    borderRadius: 26,
    padding: 18,
    marginBottom: 20,
  },

  summaryTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "900",
    marginBottom: 4,
  },

  summarySubtitle: {
    color: colors.secondary,
    fontSize: 14,
    marginBottom: 16,
  },

  summaryGrid: {
    flexDirection: "row",
    gap: 10,
  },

  summaryBox: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: 18,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },

  summaryNumber: {
    color: colors.primary,
    fontSize: 18,
    fontWeight: "900",
  },

  summaryLabel: {
    color: colors.secondary,
    fontSize: 12,
    marginTop: 4,
    fontWeight: "800",
  },

  typeCard: {
    backgroundColor: colors.card,
    borderRadius: 26,
    padding: 18,
    marginBottom: 20,
  },

  typeHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  typeTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "900",
  },

  typeSubtitle: {
    color: colors.secondary,
    fontSize: 14,
    marginTop: 4,
  },

  roomList: {
    marginTop: 16,
  },

  roomCard: {
    backgroundColor: colors.background,
    borderRadius: 22,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },

  roomHeader: {
    marginBottom: 14,
  },

  roomTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900",
  },

  roomSubtitle: {
    color: colors.secondary,
    fontSize: 13,
    marginTop: 4,
    fontWeight: "800",
  },

  guestCard: {
    backgroundColor: colors.card,
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
  },

  guestHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },

  guestNumber: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  guestNumberText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "900",
  },

  guestMain: {
    flex: 1,
  },

  guestName: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "900",
  },

  guestBirth: {
    color: colors.secondary,
    fontSize: 13,
    marginTop: 4,
    lineHeight: 18,
  },

  packBadge: {
    alignSelf: "flex-start",
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },

  packText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "900",
  },

  emptyBox: {
    backgroundColor: colors.card,
    borderRadius: 26,
    padding: 30,
    alignItems: "center",
  },

  emptyTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "900",
    marginTop: 14,
    marginBottom: 8,
    textAlign: "center",
  },

  emptyText: {
    color: colors.secondary,
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
  },
});
