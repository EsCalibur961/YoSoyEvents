import { Ionicons } from "@expo/vector-icons";
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

type Guest = {
  firstName?: string;
  lastName?: string;
  birthDate?: string;
  birthPlace?: string;
  selectedPackId?: string;
  selectedPackLetter?: string;
  selectedPackPrice?: string;
  notes?: string;
};

type RoomData = {
  id: string;
  teacherUsername?: string;
  roomType?: RoomType;
  roomIndex?: number;
  customName?: string;
  guests?: Guest[];
  isSaved?: boolean;
  paymentVisible?: boolean;
  savedAt?: any;
};

const roomTypes: RoomType[] = ["Doppia", "Tripla", "Quadrupla"];

export default function AdminTeacherRoomsScreen() {
  const { colors, isDark } = useTheme();
  const styles = createStyles(colors, isDark);

  const [teachers, setTeachers] = useState<TeacherUser[]>([]);
  const [roomsData, setRoomsData] = useState<RoomData[]>([]);
  const [selectedTeacher, setSelectedTeacher] = useState<string | null>(null);
  const [showOnlyComplete, setShowOnlyComplete] = useState(true);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let unsubTeachers: (() => void) | null = null;
      let unsubRooms: (() => void) | null = null;

      try {
        unsubTeachers = onSnapshot(collection(db, "teachers"), (snapshot) => {
          const data: TeacherUser[] = snapshot.docs.map((item) => ({
            id: item.id,
            ...(item.data() as Omit<TeacherUser, "id">),
          }));

          setTeachers(data);
        });

        unsubRooms = onSnapshot(
          collection(db, "roomsData"),
          (snapshot) => {
            const data: RoomData[] = snapshot.docs.map((item) => ({
              id: item.id,
              ...(item.data() as Omit<RoomData, "id">),
            }));

            setRoomsData(data);
            setLoading(false);
          },
          () => {
            setRoomsData([]);
            setLoading(false);
          },
        );
      } catch {
        setTeachers([]);
        setRoomsData([]);
        setLoading(false);
      }

      return () => {
        if (unsubTeachers) unsubTeachers();
        if (unsubRooms) unsubRooms();
      };
    }, []),
  );

  const safeText = (value: any) => String(value ?? "").trim();

  const safeNumber = (value: any) => {
    const number = Number(value || 0);
    return Number.isNaN(number) ? 0 : number;
  };

  const normalizeGuest = (guest: any): Guest => ({
    firstName: safeText(guest?.firstName),
    lastName: safeText(guest?.lastName),
    birthDate: safeText(guest?.birthDate),
    birthPlace: safeText(guest?.birthPlace),
    selectedPackId: safeText(guest?.selectedPackId),
    selectedPackLetter: safeText(guest?.selectedPackLetter),
    selectedPackPrice: safeText(guest?.selectedPackPrice),
    notes: safeText(guest?.notes),
  });

  const normalizeRoom = (room: RoomData): RoomData => ({
    ...room,
    roomType: room.roomType || "Doppia",
    roomIndex: Number(room.roomIndex || 1),
    customName: safeText(room.customName),
    guests: Array.isArray(room.guests)
      ? room.guests.map((guest) => normalizeGuest(guest))
      : [],
  });

  const getTeacherName = (username?: string) => {
    const teacher = teachers.find((item) => item.username === username);
    const fullName = `${teacher?.firstName || ""} ${teacher?.lastName || ""}`.trim();

    return fullName || username || "Maestro";
  };

  const getTeacherSchool = (username?: string) => {
    const teacher = teachers.find((item) => item.username === username);
    return teacher?.danceSchool || "Scuola non inserita";
  };

  const getRoomLabel = (room: RoomData) => {
    if (room.customName?.trim()) return room.customName.trim();
    return `${room.roomType || "Camera"} #${room.roomIndex || "-"}`;
  };

  const getGuestFullName = (guest: Guest) => {
    return `${guest.firstName || ""} ${guest.lastName || ""}`.trim() || "Ospite senza nome";
  };

  const isGuestComplete = (guest: Guest) => {
    return Boolean(
      guest.firstName?.trim() &&
        guest.lastName?.trim() &&
        guest.birthDate?.trim() &&
        guest.birthPlace?.trim() &&
        guest.selectedPackId?.trim(),
    );
  };

  const isRoomComplete = (room: RoomData) => {
    const guests = Array.isArray(room.guests) ? room.guests : [];
    return guests.length > 0 && guests.every((guest) => isGuestComplete(guest));
  };

  const roomHasAnyGuest = (room: RoomData) => {
    const guests = Array.isArray(room.guests) ? room.guests : [];
    return guests.some(
      (guest) =>
        guest.firstName?.trim() ||
        guest.lastName?.trim() ||
        guest.birthDate?.trim() ||
        guest.birthPlace?.trim() ||
        guest.selectedPackId?.trim() ||
        guest.notes?.trim(),
    );
  };

  const getGuestPrice = (guest: Guest) => {
    return safeNumber(guest.selectedPackPrice);
  };

  const getRoomTotal = (room: RoomData) => {
    return (room.guests || []).reduce((sum, guest) => {
      if (!isGuestComplete(guest)) return sum;
      return sum + getGuestPrice(guest);
    }, 0);
  };

  const normalizedRooms = useMemo(() => {
    return roomsData
      .map((room) => normalizeRoom(room))
      .filter((room) => room.teacherUsername)
      .filter((room) => (showOnlyComplete ? isRoomComplete(room) : roomHasAnyGuest(room)));
  }, [roomsData, showOnlyComplete]);

  const teacherSummaries = useMemo(() => {
    const usernames = Array.from(
      new Set([
        ...teachers.map((teacher) => teacher.username).filter(Boolean),
        ...normalizedRooms.map((room) => room.teacherUsername).filter(Boolean),
      ]),
    ) as string[];

    return usernames
      .map((username) => {
        const rooms = normalizedRooms.filter((room) => room.teacherUsername === username);
        const guests = rooms.flatMap((room) => room.guests || []);
        const completeGuests = guests.filter((guest) => isGuestComplete(guest));
        const totalAmount = rooms.reduce((sum, room) => sum + getRoomTotal(room), 0);

        const byType = roomTypes.reduce(
          (acc, type) => {
            acc[type] = rooms.filter((room) => room.roomType === type).length;
            return acc;
          },
          {} as Record<RoomType, number>,
        );

        return {
          username,
          teacherName: getTeacherName(username),
          danceSchool: getTeacherSchool(username),
          rooms,
          roomsCount: rooms.length,
          guestsCount: completeGuests.length,
          totalAmount,
          byType,
        };
      })
      .filter((item) => item.roomsCount > 0)
      .sort((a, b) => b.roomsCount - a.roomsCount || a.teacherName.localeCompare(b.teacherName));
  }, [teachers, normalizedRooms]);

  const selectedSummary = teacherSummaries.find((item) => item.username === selectedTeacher);

  const totalRooms = teacherSummaries.reduce((sum, item) => sum + item.roomsCount, 0);
  const totalGuests = teacherSummaries.reduce((sum, item) => sum + item.guestsCount, 0);
  const totalAmount = teacherSummaries.reduce((sum, item) => sum + item.totalAmount, 0);

  const formatCurrency = (value: number) => `€${Number(value || 0).toFixed(2)}`;

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Caricamento camere...</Text>
      </View>
    );
  }

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

      <Text style={styles.title}>Camere inserite</Text>

      <Text style={styles.subtitle}>
        Vista admin di tutte le camere compilate dai maestri, con ospiti, pack e totali.
      </Text>

      <TouchableOpacity
        style={styles.filterButton}
        onPress={() => setShowOnlyComplete((prev) => !prev)}
      >
        <Ionicons
          name={showOnlyComplete ? "checkbox-outline" : "square-outline"}
          size={22}
          color={colors.text}
        />
        <Text style={styles.filterButtonText}>
          {showOnlyComplete ? "Solo camere complete" : "Mostra anche bozze"}
        </Text>
      </TouchableOpacity>

      <View style={styles.summaryCard}>
        <View style={styles.summaryBox}>
          <Text style={styles.summaryNumber}>{totalRooms}</Text>
          <Text style={styles.summaryLabel}>Camere</Text>
        </View>

        <View style={styles.summaryBox}>
          <Text style={styles.summaryNumber}>{totalGuests}</Text>
          <Text style={styles.summaryLabel}>Ospiti</Text>
        </View>

        <View style={styles.summaryBox}>
          <Text style={styles.summaryNumber}>{formatCurrency(totalAmount)}</Text>
          <Text style={styles.summaryLabel}>Totale</Text>
        </View>
      </View>

      {teacherSummaries.length === 0 ? (
        <View style={styles.emptyBox}>
          <Ionicons name="bed-outline" size={50} color={colors.secondary} />
          <Text style={styles.emptyTitle}>Nessuna camera inserita</Text>
          <Text style={styles.emptyText}>
            Quando i maestri salveranno camere complete, compariranno qui.
          </Text>
        </View>
      ) : (
        teacherSummaries.map((summary) => {
          const selected = selectedTeacher === summary.username;

          return (
            <View key={summary.username} style={styles.teacherCard}>
              <TouchableOpacity
                style={styles.teacherHeader}
                onPress={() =>
                  setSelectedTeacher(selected ? null : summary.username)
                }
              >
                <View style={styles.teacherInfo}>
                  <Text style={styles.teacherName}>{summary.teacherName}</Text>
                  <Text style={styles.teacherSchool}>
                    @{summary.username} • {summary.danceSchool}
                  </Text>

                  <Text style={styles.teacherMeta}>
                    Doppie {summary.byType.Doppia} • Triple {summary.byType.Tripla} • Quadruple {summary.byType.Quadrupla}
                  </Text>
                </View>

                <View style={styles.teacherRight}>
                  <Text style={styles.teacherAmount}>
                    {formatCurrency(summary.totalAmount)}
                  </Text>
                  <Text style={styles.teacherRooms}>
                    {summary.roomsCount} camere • {summary.guestsCount} ospiti
                  </Text>
                  <Ionicons
                    name={selected ? "chevron-up-outline" : "chevron-down-outline"}
                    size={24}
                    color={colors.text}
                  />
                </View>
              </TouchableOpacity>

              {selected ? (
                <View style={styles.roomsBlock}>
                  {roomTypes.map((type) => {
                    const typeRooms = summary.rooms.filter(
                      (room) => room.roomType === type,
                    );

                    if (typeRooms.length === 0) return null;

                    return (
                      <View key={type} style={styles.typeBlock}>
                        <Text style={styles.typeTitle}>{type}</Text>

                        {typeRooms.map((room) => {
                          const completeGuests = (room.guests || []).filter((guest) =>
                            showOnlyComplete ? isGuestComplete(guest) : true,
                          );

                          return (
                            <View key={room.id} style={styles.roomCard}>
                              <View style={styles.roomHeader}>
                                <View>
                                  <Text style={styles.roomTitle}>
                                    {getRoomLabel(room)}
                                  </Text>
                                  <Text style={styles.roomSubtitle}>
                                    {completeGuests.length}/{room.guests?.length || 0} ospiti • Totale {formatCurrency(getRoomTotal(room))}
                                  </Text>
                                </View>

                                <View
                                  style={[
                                    styles.roomStatus,
                                    isRoomComplete(room)
                                      ? styles.roomStatusComplete
                                      : styles.roomStatusDraft,
                                  ]}
                                >
                                  <Text style={styles.roomStatusText}>
                                    {isRoomComplete(room) ? "Completa" : "Bozza"}
                                  </Text>
                                </View>
                              </View>

                              {completeGuests.length === 0 ? (
                                <Text style={styles.emptyMiniText}>
                                  Nessun ospite completo in questa camera.
                                </Text>
                              ) : (
                                completeGuests.map((guest, index) => (
                                  <View key={`${room.id}-${index}`} style={styles.guestRow}>
                                    <View style={styles.guestInfo}>
                                      <Text style={styles.guestName}>
                                        {getGuestFullName(guest)}
                                      </Text>
                                      <Text style={styles.guestDetails}>
                                        {guest.birthDate || "-"} • {guest.birthPlace || "-"}
                                      </Text>
                                      <Text style={styles.guestPack}>
                                        Pack {guest.selectedPackLetter || "-"} • €{guest.selectedPackPrice || "0"}
                                      </Text>

                                      {guest.notes?.trim() ? (
                                        <Text style={styles.guestNotes}>
                                          Note: {guest.notes}
                                        </Text>
                                      ) : null}
                                    </View>

                                    <Text style={styles.guestPrice}>
                                      {formatCurrency(getGuestPrice(guest))}
                                    </Text>
                                  </View>
                                ))
                              )}
                            </View>
                          );
                        })}
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

const createStyles = (colors: any, isDark: boolean) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: {
      paddingTop: 52,
      paddingHorizontal: 22,
      paddingBottom: 130,
    },
    loadingContainer: {
      flex: 1,
      backgroundColor: colors.background,
      alignItems: "center",
      justifyContent: "center",
      padding: 24,
    },
    loadingText: {
      color: colors.text,
      fontSize: 17,
      fontWeight: "900",
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
      marginBottom: 18,
    },
    filterButton: {
      backgroundColor: colors.card,
      borderRadius: 18,
      paddingVertical: 15,
      paddingHorizontal: 16,
      borderWidth: 1,
      borderColor: colors.border,
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 16,
    },
    filterButtonText: {
      color: colors.text,
      fontSize: 15,
      fontWeight: "900",
      marginLeft: 10,
    },
    summaryCard: {
      backgroundColor: colors.card,
      borderRadius: 26,
      padding: 16,
      marginBottom: 20,
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
      textAlign: "center",
    },
    summaryLabel: {
      color: colors.secondary,
      fontSize: 12,
      fontWeight: "800",
      marginTop: 4,
      textAlign: "center",
    },
    teacherCard: {
      backgroundColor: colors.card,
      borderRadius: 26,
      padding: 16,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    teacherHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    teacherInfo: {
      flex: 1,
      paddingRight: 12,
    },
    teacherName: {
      color: colors.text,
      fontSize: 20,
      fontWeight: "900",
      marginBottom: 4,
    },
    teacherSchool: {
      color: colors.secondary,
      fontSize: 13,
      fontWeight: "800",
      marginBottom: 5,
    },
    teacherMeta: {
      color: colors.placeholder,
      fontSize: 12,
      fontWeight: "800",
    },
    teacherRight: {
      alignItems: "flex-end",
      gap: 3,
    },
    teacherAmount: {
      color: colors.primary,
      fontSize: 16,
      fontWeight: "900",
    },
    teacherRooms: {
      color: colors.secondary,
      fontSize: 12,
      fontWeight: "800",
    },
    roomsBlock: {
      marginTop: 18,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingTop: 16,
    },
    typeBlock: {
      marginBottom: 18,
    },
    typeTitle: {
      color: colors.text,
      fontSize: 20,
      fontWeight: "900",
      marginBottom: 10,
    },
    roomCard: {
      backgroundColor: colors.background,
      borderRadius: 20,
      padding: 14,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    roomHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      marginBottom: 12,
    },
    roomTitle: {
      color: colors.text,
      fontSize: 17,
      fontWeight: "900",
    },
    roomSubtitle: {
      color: colors.secondary,
      fontSize: 12,
      fontWeight: "800",
      marginTop: 4,
    },
    roomStatus: {
      borderRadius: 12,
      paddingVertical: 6,
      paddingHorizontal: 10,
    },
    roomStatusComplete: {
      backgroundColor: colors.success,
    },
    roomStatusDraft: {
      backgroundColor: colors.warning,
    },
    roomStatusText: {
      color: "#FFFFFF",
      fontSize: 11,
      fontWeight: "900",
    },
    guestRow: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 12,
      marginBottom: 10,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    guestInfo: {
      flex: 1,
      paddingRight: 10,
    },
    guestName: {
      color: colors.text,
      fontSize: 15,
      fontWeight: "900",
    },
    guestDetails: {
      color: colors.placeholder,
      fontSize: 12,
      fontWeight: "800",
      marginTop: 4,
    },
    guestPack: {
      color: colors.secondary,
      fontSize: 13,
      fontWeight: "800",
      marginTop: 4,
    },
    guestPrice: {
      color: colors.success,
      fontSize: 15,
      fontWeight: "900",
    },
    emptyBox: {
      backgroundColor: colors.card,
      borderRadius: 26,
      padding: 28,
      alignItems: "center",
      borderWidth: 1,
      borderColor: colors.border,
    },
    emptyTitle: {
      color: colors.text,
      fontSize: 21,
      fontWeight: "900",
      marginTop: 12,
      marginBottom: 8,
      textAlign: "center",
    },
    emptyText: {
      color: colors.secondary,
      fontSize: 15,
      textAlign: "center",
      lineHeight: 22,
    },
    emptyMiniText: {
      color: colors.secondary,
      fontSize: 14,
      fontWeight: "800",
      textAlign: "center",
      paddingVertical: 12,
    },
  });
