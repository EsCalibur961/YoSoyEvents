import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useFocusEffect } from "expo-router";
import { collection, onSnapshot } from "firebase/firestore";
import { useCallback, useMemo, useState } from "react";
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { db } from "../../firebase";
import { useTheme } from "../../contexts/ThemeContext";

type EventPack = {
  id: string;
  letter: string;
  price: string;
  description: string;
};

type EventItem = {
  id: string;
  title?: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  location?: string;
  image?: string;
  packs?: EventPack[];
};

type TeacherUser = {
  id: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  danceSchool?: string;
  isOnline?: boolean;
  lastSeen?: any;
};

type Guest = {
  firstName?: string;
  lastName?: string;
  birthDate?: string;
  birthPlace?: string;
  selectedPackId?: string;
  selectedPackLetter?: string;
  selectedPackPrice?: string;
};

type RoomData = {
  id: string;
  teacherUsername?: string;
  roomType?: "Doppia" | "Tripla" | "Quadrupla";
  roomIndex?: number;
  customName?: string;
  guests?: Guest[];
};

export default function HomeScreen() {
  const { colors, isDark } = useTheme();
  const styles = createStyles(colors, isDark);
  const [role, setRole] = useState<string | null>(null);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [teachers, setTeachers] = useState<TeacherUser[]>([]);
  const [roomsData, setRoomsData] = useState<RoomData[]>([]);

  useFocusEffect(
    useCallback(() => {
      let unsubEvents: (() => void) | null = null;
      let unsubTeachers: (() => void) | null = null;
      let unsubRooms: (() => void) | null = null;

      loadUser();

      try {
        unsubEvents = onSnapshot(collection(db, "events"), (snapshot) => {
          const data: EventItem[] = snapshot.docs.map((item) => ({
            id: item.id,
            ...(item.data() as Omit<EventItem, "id">),
          }));

          setEvents(data);
        });

        unsubTeachers = onSnapshot(collection(db, "teachers"), (snapshot) => {
          const data: TeacherUser[] = snapshot.docs.map((item) => ({
            id: item.id,
            ...(item.data() as Omit<TeacherUser, "id">),
          }));

          setTeachers(data);
        });

        unsubRooms = onSnapshot(collection(db, "roomsData"), (snapshot) => {
          const data: RoomData[] = snapshot.docs.map((item) => ({
            id: item.id,
            ...(item.data() as Omit<RoomData, "id">),
          }));

          setRoomsData(data);
        });
      } catch {
        setEvents([]);
        setTeachers([]);
        setRoomsData([]);
      }

      return () => {
        if (unsubEvents) unsubEvents();
        if (unsubTeachers) unsubTeachers();
        if (unsubRooms) unsubRooms();
      };
    }, []),
  );

  const loadUser = async () => {
    try {
      const savedRole = await AsyncStorage.getItem("loggedUser");
      setRole(savedRole);
    } catch {
      setRole(null);
    }
  };


  const getTeacherFullName = (teacher: TeacherUser) => {
    const fullName = `${teacher.firstName || ""} ${teacher.lastName || ""}`.trim();
    return fullName || teacher.username || "Maestro";
  };

  const getLastSeenDate = (lastSeen: any) => {
    if (!lastSeen) return null;

    if (typeof lastSeen?.toDate === "function") {
      return lastSeen.toDate();
    }

    const date = new Date(lastSeen);

    return Number.isNaN(date.getTime()) ? null : date;
  };

  const formatLastSeen = (lastSeen: any) => {
    const date = getLastSeenDate(lastSeen);

    if (!date) return "Ultimo accesso non disponibile";

    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    const yesterday = new Date();
    yesterday.setDate(now.getDate() - 1);

    const time = date.toLocaleTimeString("it-IT", {
      hour: "2-digit",
      minute: "2-digit",
    });

    if (isToday) return `Ultimo accesso oggi alle ${time}`;
    if (date.toDateString() === yesterday.toDateString()) {
      return `Ultimo accesso ieri alle ${time}`;
    }

    return `Ultimo accesso ${date.toLocaleDateString("it-IT")} alle ${time}`;
  };

  const onlineTeachers = useMemo(() => {
    return teachers.filter((teacher) => Boolean(teacher.isOnline));
  }, [teachers]);

  const offlineTeachers = useMemo(() => {
    return teachers
      .filter((teacher) => !teacher.isOnline)
      .sort((a, b) => {
        const aTime = getLastSeenDate(a.lastSeen)?.getTime() || 0;
        const bTime = getLastSeenDate(b.lastSeen)?.getTime() || 0;

        return bTime - aTime;
      });
  }, [teachers]);

  const sortedTeachersByPresence = useMemo(() => {
    return [...onlineTeachers, ...offlineTeachers];
  }, [onlineTeachers, offlineTeachers]);

  const parseDate = (value?: string) => {
    if (!value) return new Date(2999, 0, 1);

    const parts = value.split("/");
    if (parts.length !== 3) return new Date(2999, 0, 1);

    const [day, month, year] = parts;

    const parsed = new Date(Number(year), Number(month) - 1, Number(day));

    if (Number.isNaN(parsed.getTime())) return new Date(2999, 0, 1);

    return parsed;
  };

  const nextEvent = useMemo(() => {
    if (events.length === 0) return null;

    const sorted = [...events].sort(
      (a, b) =>
        parseDate(a.startDate).getTime() - parseDate(b.startDate).getTime(),
    );

    return sorted[0] || null;
  }, [events]);

  const getCountdown = () => {
    if (!nextEvent?.startDate) return "Data non impostata";

    const today = new Date();
    const eventDate = parseDate(nextEvent.startDate);

    today.setHours(0, 0, 0, 0);
    eventDate.setHours(0, 0, 0, 0);

    const diff = eventDate.getTime() - today.getTime();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));

    if (days > 1) return `Mancano ${days} giorni`;
    if (days === 1) return "Manca 1 giorno";
    if (days === 0) return "Inizia oggi";
    if (days < 0) return "Evento già iniziato";

    return "Data non valida";
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

  const normalizedRooms = roomsData.map((room) => ({
    ...room,
    guests: Array.isArray(room.guests) ? room.guests : [],
  }));

  const completedRooms = normalizedRooms.filter(
    (room) =>
      room.guests.length > 0 &&
      room.guests.every((guest) => isGuestComplete(guest)),
  ).length;

  const totalGuests = normalizedRooms.reduce((sum, room) => {
    return sum + room.guests.filter((guest) => isGuestComplete(guest)).length;
  }, 0);

  const totalPacks = normalizedRooms.reduce((sum, room) => {
    return (
      sum + room.guests.filter((guest) => guest.selectedPackId?.trim()).length
    );
  }, 0);

  const totalAmount = normalizedRooms.reduce((sum, room) => {
    return (
      sum +
      room.guests.reduce((guestSum, guest) => {
        if (!isGuestComplete(guest)) return guestSum;

        const price = Number(guest.selectedPackPrice || 0);

        return guestSum + (Number.isNaN(price) ? 0 : price);
      }, 0)
    );
  }, 0);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Image
        source={require("../../assets/images/logo.png")}
        style={styles.homeLogo}
      />

      <Text style={[styles.welcome, { color: colors.secondary }]}>
        {role === "admin" ? "Dashboard admin live" : "Benvenuto"}
      </Text>

      {nextEvent ? (
        <TouchableOpacity
          style={[styles.eventCard, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() =>
            router.push({
              pathname: "/event-details",
              params: { id: nextEvent.id },
            })
          }
        >
          {nextEvent.image ? (
            <Image
              source={{ uri: nextEvent.image }}
              style={styles.eventImage}
            />
          ) : null}

          <View style={[styles.countdownBadge, { backgroundColor: colors.primaryDark }]}>
            <Ionicons name="time-outline" size={18} color={colors.text} />
            <Text style={styles.countdownText}>{getCountdown()}</Text>
          </View>

          <Text style={[styles.eventTitle, { color: colors.text }]}>
            {nextEvent.title || "Evento senza titolo"}
          </Text>

          <Text style={[styles.eventDate, { color: colors.primary }]}>
            Dal {nextEvent.startDate || "-"} al {nextEvent.endDate || "-"}
          </Text>

          <Text style={[styles.eventLocation, { color: colors.text }]}>
            {nextEvent.location || "Location non inserita"}
          </Text>

          <Text numberOfLines={3} style={[styles.eventDescription, { color: colors.secondary }]}>
            {nextEvent.description || "Nessuna descrizione disponibile."}
          </Text>

          <View style={[styles.packBox, { backgroundColor: colors.cardAlt, borderColor: colors.border }]}>
            <Text style={[styles.packTitle, { color: colors.text }]}>Pack disponibili</Text>

            {Array.isArray(nextEvent.packs) && nextEvent.packs.length > 0 ? (
              nextEvent.packs.map((pack) => (
                <Text key={pack.id} style={[styles.packText, { color: colors.secondary }]}>
                  Pack {pack.letter}: €{pack.price}
                </Text>
              ))
            ) : (
              <Text style={[styles.packText, { color: colors.secondary }]}>Nessun pack disponibile.</Text>
            )}
          </View>

          <View style={[styles.detailsButton, { backgroundColor: colors.primaryDark }]}>
            <Text style={styles.detailsButtonText}>Vedi dettagli</Text>
          </View>
        </TouchableOpacity>
      ) : (
        <View style={[styles.emptyBox, { backgroundColor: colors.card }]}>
          <Ionicons name="calendar" size={46} color={colors.secondary} />

          <Text style={[styles.emptyTitle, { color: colors.text }]}>Nessun evento pubblicato</Text>

          <Text style={[styles.emptyText, { color: colors.secondary }]}>
            Quando l’admin pubblicherà un evento, comparirà qui.
          </Text>
        </View>
      )}

      {role === "admin" ? (
        <>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Riepilogo gestionale</Text>

          <View style={[styles.onlineCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.onlineHeader}>
              <View>
                <Text style={[styles.onlineTitle, { color: colors.text }]}>
                  Maestri online
                </Text>
                <Text style={[styles.onlineSubtitle, { color: colors.secondary }]}>
                  Stato live e ultimo accesso
                </Text>
              </View>

              <View style={styles.onlineCounters}>
                <View style={[styles.onlineCounterBadge, { backgroundColor: colors.success }]}>
                  <Text style={styles.onlineCounterText}>{onlineTeachers.length} online</Text>
                </View>

                <View style={[styles.onlineCounterBadge, { backgroundColor: colors.danger }]}>
                  <Text style={styles.onlineCounterText}>{offlineTeachers.length} offline</Text>
                </View>
              </View>
            </View>

            {sortedTeachersByPresence.length === 0 ? (
              <Text style={[styles.onlineEmptyText, { color: colors.secondary }]}>
                Nessun maestro registrato.
              </Text>
            ) : (
              sortedTeachersByPresence.slice(0, 8).map((teacher) => (
                <View key={teacher.id} style={[styles.teacherPresenceRow, { borderColor: colors.border }]}>
                  <View
                    style={[
                      styles.presenceDot,
                      { backgroundColor: teacher.isOnline ? colors.success : colors.danger },
                    ]}
                  />

                  <View style={styles.teacherPresenceInfo}>
                    <Text style={[styles.teacherPresenceName, { color: colors.text }]}>
                      {getTeacherFullName(teacher)}
                    </Text>

                    <Text style={[styles.teacherPresenceMeta, { color: colors.secondary }]}>
                      @{teacher.username || "-"} • {teacher.danceSchool || "Scuola non inserita"}
                    </Text>

                    <Text
                      style={[
                        styles.teacherPresenceStatus,
                        { color: teacher.isOnline ? colors.success : colors.warning },
                      ]}
                    >
                      {teacher.isOnline ? "Online adesso" : formatLastSeen(teacher.lastSeen)}
                    </Text>
                  </View>
                </View>
              ))
            )}

            {sortedTeachersByPresence.length > 8 ? (
              <TouchableOpacity
                style={[styles.viewAllTeachersButton, { backgroundColor: colors.primaryDark }]}
                onPress={() => router.push("/manage-users")}
              >
                <Text style={styles.viewAllTeachersText}>
                  Vedi tutti i maestri
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>

          <View style={styles.statsGrid}>
            <View style={[styles.statBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Ionicons name="people" size={24} color={colors.primary} />
              <Text style={[styles.statNumber, { color: colors.text }]}>{teachers.length}</Text>
              <Text style={[styles.statLabel, { color: colors.secondary }]}>Maestri</Text>
            </View>

            <View style={[styles.statBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Ionicons name="bed" size={24} color={colors.primary} />
              <Text style={[styles.statNumber, { color: colors.text }]}>{completedRooms}</Text>
              <Text style={[styles.statLabel, { color: colors.secondary }]}>Camere complete</Text>
            </View>

            <View style={[styles.statBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Ionicons name="person-add" size={24} color={colors.warning} />
              <Text style={[styles.statNumber, { color: colors.text }]}>{totalGuests}</Text>
              <Text style={[styles.statLabel, { color: colors.secondary }]}>Ospiti</Text>
            </View>

            <View style={[styles.statBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Ionicons name="ticket" size={24} color={colors.success} />
              <Text style={[styles.statNumber, { color: colors.text }]}>{totalPacks}</Text>
              <Text style={[styles.statLabel, { color: colors.secondary }]}>Pack</Text>
            </View>
          </View>

          <View style={[styles.moneyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.moneyTitle, { color: colors.secondary }]}>Totale pack selezionati</Text>
            <Text style={styles.moneyValue}>€{totalAmount}</Text>
          </View>

          <View style={styles.quickActions}>
            <TouchableOpacity
              style={[styles.quickButton, { backgroundColor: colors.primaryDark }]}
              onPress={() => router.push("/manage-events")}
            >
              <Ionicons name="calendar" size={22} color={colors.text} />
              <Text style={styles.quickText}>Eventi</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.quickButton, { backgroundColor: colors.primaryDark }]}
              onPress={() => router.push("/manage-users")}
            >
              <Ionicons name="people" size={22} color={colors.text} />
              <Text style={styles.quickText}>Maestri</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.quickButton, { backgroundColor: colors.primaryDark }]}
              onPress={() => router.push("/manage-rooms")}
            >
              <Ionicons name="bed" size={22} color={colors.text} />
              <Text style={styles.quickText}>Stanze</Text>
            </TouchableOpacity>
          </View>
        </>
      ) : (
        <>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Accessi rapidi</Text>

          <View style={styles.quickActions}>
            <TouchableOpacity
              style={[styles.quickButton, { backgroundColor: colors.primaryDark }]}
              onPress={() => router.push("/(tabs)/rooms")}
            >
              <Ionicons name="bed" size={22} color={colors.text} />
              <Text style={styles.quickText}>Stanze</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.quickButton, { backgroundColor: colors.primaryDark }]}
              onPress={() => router.push("/teacher-room-list")}
            >
              <Ionicons name="list" size={22} color={colors.text} />
              <Text style={styles.quickText}>Lista</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.quickButton, { backgroundColor: colors.primaryDark }]}
              onPress={() => router.push("/teacher-payments")}
            >
              <Ionicons name="cash" size={22} color={colors.text} />
              <Text style={styles.quickText}>Pagamenti</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </ScrollView>
  );
}

const createStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  content: {
    paddingTop: 58,
    paddingHorizontal: 22,
    paddingBottom: 130,
  },
  homeLogo: {
    width: 240,
    height: 170,
    resizeMode: "contain",
    alignSelf: "center",
    marginBottom: 16,
  },

  logoTitle: {
    color: colors.text,
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: 3,
  },

  logoSubtitle: {
    color: colors.primary,
    fontSize: 48,
    fontWeight: "900",
    marginBottom: 16,
    letterSpacing: 2,
  },

  welcome: {
    color: colors.secondary,
    fontSize: 17,
    fontWeight: "800",
    marginBottom: 22,
    textAlign: "center",
  },

  eventCard: {
    backgroundColor: colors.card,
    borderRadius: 30,
    padding: 18,
    marginBottom: 26,
  },

  eventImage: {
    width: "100%",
    height: 230,
    borderRadius: 24,
    marginBottom: 18,
    backgroundColor: colors.background,
  },

  countdownBadge: {
    alignSelf: "flex-start",
    backgroundColor: colors.primary,
    borderRadius: 16,
    paddingVertical: 8,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },

  countdownText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "900",
    marginLeft: 6,
  },

  eventTitle: {
    color: colors.text,
    fontSize: 28,
    fontWeight: "900",
    marginBottom: 8,
  },

  eventDate: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: "900",
    marginBottom: 8,
  },

  eventLocation: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 12,
  },

  eventDescription: {
    color: colors.secondary,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 18,
  },

  packBox: {
    backgroundColor: colors.background,
    borderRadius: 18,
    padding: 14,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: colors.border,
  },

  packTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "900",
    marginBottom: 8,
  },

  packText: {
    color: colors.secondary,
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 5,
  },

  detailsButton: {
    backgroundColor: colors.primary,
    borderRadius: 18,
    paddingVertical: 15,
    alignItems: "center",
  },

  detailsButtonText: {
    color: colors.onPrimary,
    fontSize: 16,
    fontWeight: "900",
  },

  sectionTitle: {
    color: colors.text,
    fontSize: 24,
    fontWeight: "900",
    marginBottom: 16,
  },


  onlineCard: {
    backgroundColor: colors.card,
    borderRadius: 26,
    padding: 18,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },

  onlineHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
    gap: 12,
  },

  onlineTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "900",
  },

  onlineSubtitle: {
    color: colors.secondary,
    fontSize: 13,
    fontWeight: "800",
    marginTop: 4,
  },

  onlineCounters: {
    alignItems: "flex-end",
    gap: 7,
  },

  onlineCounterBadge: {
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },

  onlineCounterText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "900",
  },

  onlineEmptyText: {
    color: colors.secondary,
    fontSize: 14,
    fontWeight: "800",
    textAlign: "center",
    paddingVertical: 10,
  },

  teacherPresenceRow: {
    flexDirection: "row",
    alignItems: "center",
    borderTopWidth: 1,
    borderColor: colors.border,
    paddingTop: 12,
    marginTop: 12,
  },

  presenceDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },

  teacherPresenceInfo: {
    flex: 1,
  },

  teacherPresenceName: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "900",
  },

  teacherPresenceMeta: {
    color: colors.secondary,
    fontSize: 12,
    fontWeight: "800",
    marginTop: 3,
  },

  teacherPresenceStatus: {
    color: colors.success,
    fontSize: 12,
    fontWeight: "900",
    marginTop: 4,
  },

  viewAllTeachersButton: {
    backgroundColor: colors.primaryDark,
    borderRadius: 16,
    paddingVertical: 13,
    alignItems: "center",
    marginTop: 16,
  },

  viewAllTeachersText: {
    color: colors.onPrimary,
    fontSize: 14,
    fontWeight: "900",
  },

  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 18,
  },

  statBox: {
    width: "47.8%",
    backgroundColor: colors.card,
    borderRadius: 22,
    paddingVertical: 18,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
  },

  statNumber: {
    color: colors.text,
    fontSize: 24,
    fontWeight: "900",
    marginTop: 8,
    marginBottom: 4,
  },

  statLabel: {
    color: colors.secondary,
    fontSize: 13,
    fontWeight: "800",
    textAlign: "center",
  },

  moneyCard: {
    backgroundColor: colors.card,
    borderRadius: 24,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },

  moneyTitle: {
    color: colors.secondary,
    fontSize: 15,
    fontWeight: "800",
    marginBottom: 8,
  },

  moneyValue: {
    color: colors.success,
    fontSize: 30,
    fontWeight: "900",
  },

  quickActions: {
    flexDirection: "row",
    gap: 10,
  },

  quickButton: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: 20,
    paddingVertical: 16,
    alignItems: "center",
  },

  quickText: {
    color: colors.onPrimary,
    fontSize: 13,
    fontWeight: "900",
    marginTop: 6,
  },

  emptyBox: {
    backgroundColor: colors.card,
    borderRadius: 28,
    padding: 28,
    alignItems: "center",
    marginBottom: 24,
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
    textAlign: "center",
    lineHeight: 22,
  },
});
