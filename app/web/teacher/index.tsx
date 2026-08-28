import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";

import { useTheme } from "../../../contexts/ThemeContext";
import { db } from "../../../firebase";

type EventPack = {
  id: string;
  letter: string;
  price: string;
  description?: string;
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

type ArtistItem = {
  id: string;
  name?: string;
  instagram?: string;
  image?: string;
  isVisible?: boolean;
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
  guests?: Guest[];
};

const ACTIONS = [
  ["Le mie stanze", "bed-outline", "/web/teacher/rooms"]  ,
 ["Esplora eventi", "compass-outline", "/web/teacher/explore"],
  ["Profilo", "person-circle-outline", "/web/teacher/profile"],
  ["Notifiche", "notifications-outline", "/web/teacher/notifications"],
  ["Le mie richieste", "git-pull-request-outline", "/web/teacher/requests"],
  ["Pagamenti", "wallet-outline", "/web/teacher/payments"],
] as const

const parseDate = (value?: string) => {
  if (!value) return new Date(2999, 0, 1);
  const [day, month, year] = value.split("/");
  if (!day || !month || !year) return new Date(2999, 0, 1);
  const d = new Date(Number(year), Number(month) - 1, Number(day));
  return Number.isNaN(d.getTime()) ? new Date(2999, 0, 1) : d;
};

const isGuestComplete = (guest: Guest) =>
  Boolean(
    guest.firstName?.trim() &&
      guest.lastName?.trim() &&
      guest.birthDate?.trim() &&
      guest.birthPlace?.trim() &&
      guest.selectedPackId?.trim(),
  );

export default function TeacherWebHome() {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const isMobile = width < 700;
  const isNarrow = width < 420;
  const isTablet = width >= 700 && width < 1100;

  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [school, setSchool] = useState("");
  const [events, setEvents] = useState<EventItem[]>([]);
  const [artists, setArtists] = useState<ArtistItem[]>([]);
  const [rooms, setRooms] = useState<RoomData[]>([]);
  const [assignedRooms, setAssignedRooms] = useState(0);
  const [pendingRequests, setPendingRequests] = useState(0);

  useEffect(() => {
    let unsubAssignments = () => {};
    let unsubRequests = () => {};
    let unsubRooms = () => {};

    const unsubEvents = onSnapshot(collection(db, "events"), (snapshot) => {
      setEvents(
        snapshot.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<EventItem, "id">),
        })),
      );
    });

    const unsubArtists = onSnapshot(collection(db, "artists"), (snapshot) => {
      setArtists(
        snapshot.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<ArtistItem, "id">),
        })),
      );
    });

    (async () => {
      const role = await AsyncStorage.getItem("loggedUser");
      if (role !== "teacher") {
        router.replace("/web/login");
        return;
      }

      const u = (await AsyncStorage.getItem("teacherUsername")) || "";
      setUsername(u);
      setFullName((await AsyncStorage.getItem("teacherFullName")) || u);
      setSchool((await AsyncStorage.getItem("danceSchool")) || "");

      unsubAssignments = onSnapshot(
        query(
          collection(db, "roomAssignments"),
          where("teacherUsername", "==", u),
        ),
        (snap) => {
          let total = 0;
          snap.forEach((d) => {
            const quantities = d.data()?.quantities || {};
            total +=
              Number(quantities.Doppia || 0) +
              Number(quantities.Tripla || 0) +
              Number(quantities.Quadrupla || 0);
          });
          setAssignedRooms(total);
        },
      );

      unsubRequests = onSnapshot(
        query(
          collection(db, "roomChangeRequests"),
          where("teacherUsername", "==", u),
        ),
        (snap) => {
          setPendingRequests(
            snap.docs.filter(
              (d) => (d.data()?.status || "pending") === "pending",
            ).length,
          );
        },
      );

      unsubRooms = onSnapshot(
        query(collection(db, "roomsData"), where("teacherUsername", "==", u)),
        (snap) => {
          setRooms(
            snap.docs.map((d) => ({
              id: d.id,
              ...(d.data() as Omit<RoomData, "id">),
            })),
          );
        },
      );
    })();

    return () => {
      unsubEvents();
      unsubArtists();
      unsubAssignments();
      unsubRequests();
      unsubRooms();
    };
  }, []);

  const nextEvent = useMemo(() => {
    return [...events].sort(
      (a, b) => parseDate(a.startDate).getTime() - parseDate(b.startDate).getTime(),
    )[0] || null;
  }, [events]);

  const visibleArtists = useMemo(
    () =>
      artists
        .filter((artist) => artist.isVisible !== false)
        .sort((a, b) => (a.name || "").localeCompare(b.name || "")),
    [artists],
  );

  const completedRooms = useMemo(
    () =>
      rooms.filter((room) => {
        const guests = Array.isArray(room.guests) ? room.guests : [];
        return guests.length > 0 && guests.every(isGuestComplete);
      }).length,
    [rooms],
  );

  const guestCount = useMemo(
    () =>
      rooms.reduce(
        (sum, room) =>
          sum +
          (Array.isArray(room.guests)
            ? room.guests.filter(isGuestComplete).length
            : 0),
        0,
      ),
    [rooms],
  );

  const selectedPacks = useMemo(
    () =>
      rooms.reduce(
        (sum, room) =>
          sum +
          (Array.isArray(room.guests)
            ? room.guests.filter((g) => g.selectedPackId?.trim()).length
            : 0),
        0,
      ),
    [rooms],
  );

  const countdown = useMemo(() => {
    if (!nextEvent?.startDate) return "Data non impostata";
    const today = new Date();
    const eventDate = parseDate(nextEvent.startDate);
    today.setHours(0, 0, 0, 0);
    eventDate.setHours(0, 0, 0, 0);
    const days = Math.ceil(
      (eventDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
    );
    if (days > 1) return `Mancano ${days} giorni`;
    if (days === 1) return "Manca 1 giorno";
    if (days === 0) return "Inizia oggi";
    return "Evento già iniziato";
  }, [nextEvent]);

  const logout = async () => {
    await AsyncStorage.multiRemove([
      "isLogged",
      "loggedUser",
      "teacherUsername",
      "teacherId",
      "teacherFullName",
      "danceSchool",
    ]);
    router.replace("/web/login");
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={[styles.content, isMobile && styles.contentMobile, isTablet && styles.contentTablet]}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.header, isMobile && styles.headerMobile]}>
        <View>
          <Text style={[styles.eyebrow, { color: colors.primary }]}>
            YO SOY EVENTS / WEB MAESTRO
          </Text>
          <Text style={[styles.title, isMobile && styles.titleMobile, { color: colors.text }]}>
            Ciao {fullName || username}
          </Text>
          <Text style={[styles.subtitle, isMobile && styles.subtitleMobile, { color: colors.secondary }]}>
            {school || "Area maestro"} • Tutto ciò che trovi nell’app, anche dal computer.
          </Text>
        </View>

        {!isMobile ? (
        <TouchableOpacity
          style={[
            styles.logout,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
          onPress={logout}
        >
          <Ionicons name="log-out-outline" size={18} color={colors.danger} />
          <Text style={[styles.logoutText, { color: colors.danger }]}>Esci</Text>
        </TouchableOpacity>
        ) : null}
      </View>

      {nextEvent ? (
        <View
          style={[
            styles.eventCard,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          {nextEvent.image ? (
            <Image source={{ uri: nextEvent.image }} style={[styles.eventImage, isMobile && styles.eventImageMobile]} />
          ) : (
            <View
              style={[
                styles.eventImage,
                styles.imagePlaceholder,
                { backgroundColor: colors.background },
              ]}
            >
              <Ionicons name="calendar-outline" size={42} color={colors.secondary} />
            </View>
          )}

          <View style={styles.eventBody}>
            <View style={styles.eventTopRow}>
              <View
                style={[
                  styles.countdown,
                  { backgroundColor: `${colors.primary}18` },
                ]}
              >
                <Ionicons name="time-outline" size={16} color={colors.primary} />
                <Text style={[styles.countdownText, { color: colors.primary }]}>
                  {countdown}
                </Text>
              </View>
            </View>

            <Text style={[styles.eventTitle, isMobile && styles.eventTitleMobile, { color: colors.text }]}>
              {nextEvent.title || "Evento"}
            </Text>
            <Text style={[styles.eventMeta, { color: colors.secondary }]}>
              {nextEvent.startDate || "-"} → {nextEvent.endDate || "-"} •{" "}
              {nextEvent.location || "Location non inserita"}
            </Text>
            <Text
              numberOfLines={3}
              style={[styles.eventDescription, { color: colors.secondary }]}
            >
              {nextEvent.description || "Nessuna descrizione disponibile."}
            </Text>

            <View style={[styles.eventInfoGrid, isMobile && styles.eventInfoGridMobile]}>
              <View
                style={[
                  styles.packPanel,
                  isMobile && styles.panelMobile,
                  { backgroundColor: colors.background, borderColor: colors.border },
                ]}
              >
                <View style={styles.panelHeader}>
                  <Ionicons name="ticket-outline" size={19} color={colors.primary} />
                  <Text style={[styles.panelTitle, { color: colors.text }]}>
                    Pack disponibili
                  </Text>
                </View>

                {nextEvent.packs?.length ? (
                  nextEvent.packs.map((pack) => (
                    <View key={pack.id} style={styles.packRow}>
                      <Text style={[styles.packLetter, { color: colors.text }]}>
                        Pack {pack.letter}
                      </Text>
                      <Text style={[styles.packPrice, { color: colors.success }]}>
                        €{pack.price}
                      </Text>
                    </View>
                  ))
                ) : (
                  <Text style={[styles.emptySmall, { color: colors.secondary }]}>
                    Nessun Pack inserito.
                  </Text>
                )}
              </View>

              <View
                style={[
                  styles.artistsPanel,
                  isMobile && styles.panelMobile,
                  { backgroundColor: colors.background, borderColor: colors.border },
                ]}
              >
                <View style={styles.panelHeader}>
                  <Ionicons name="people-outline" size={19} color={colors.primary} />
                  <Text style={[styles.panelTitle, { color: colors.text }]}>
                    Artisti presenti
                  </Text>
                </View>

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.artistRow}
                >
                  {visibleArtists.slice(0, 8).map((artist) => (
                    <TouchableOpacity
                      key={artist.id}
                      style={styles.artist}
                      onPress={() => router.push("/web/teacher/explore")}
                    >
                      {artist.image ? (
                        <Image source={{ uri: artist.image }} style={styles.artistImage} />
                      ) : (
                        <View
                          style={[
                            styles.artistImage,
                            styles.artistPlaceholder,
                            { backgroundColor: colors.card },
                          ]}
                        >
                          <Ionicons
                            name="person-outline"
                            size={20}
                            color={colors.secondary}
                          />
                        </View>
                      )}
                      <Text
                        numberOfLines={1}
                        style={[styles.artistName, { color: colors.text }]}
                      >
                        {artist.name || "Artista"}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>
          </View>
        </View>
      ) : (
        <View
          style={[
            styles.emptyEvent,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Ionicons name="calendar-outline" size={42} color={colors.secondary} />
          <Text style={[styles.emptyEventTitle, { color: colors.text }]}>
            Nessun evento pubblicato
          </Text>
        </View>
      )}

      <Text style={[styles.sectionTitle, { color: colors.text }]}>
        Il tuo riepilogo
      </Text>

      <View style={[styles.personalSummary, isMobile && styles.personalSummaryMobile]}>
        <View
          style={[
            styles.personalMainCard,
            isMobile && styles.personalMainCardMobile,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <View style={styles.personalMainHeader}>
            <View
              style={[
                styles.personalMainIcon,
                { backgroundColor: `${colors.primary}12` },
              ]}
            >
              <Ionicons name="bed-outline" size={24} color={colors.primary} />
            </View>

            <View style={{ flex: 1 }}>
              <Text style={[styles.personalMainTitle, { color: colors.text }]}>
                Le tue camere
              </Text>
              <Text
                style={[styles.personalMainSubtitle, { color: colors.secondary }]}
              >
                Solo le camere assegnate al tuo account.
              </Text>
            </View>
          </View>

          <View style={styles.roomProgressRow}>
            <View style={styles.roomProgressItem}>
              <Text style={[styles.roomProgressValue, { color: colors.text }]}>
                {assignedRooms}
              </Text>
              <Text style={[styles.roomProgressLabel, { color: colors.secondary }]}>
                Assegnate
              </Text>
            </View>

            <View style={styles.roomProgressDivider} />

            <View style={styles.roomProgressItem}>
              <Text style={[styles.roomProgressValue, { color: colors.success }]}>
                {completedRooms}
              </Text>
              <Text style={[styles.roomProgressLabel, { color: colors.secondary }]}>
                Completate
              </Text>
            </View>

            <View style={styles.roomProgressDivider} />

            <View style={styles.roomProgressItem}>
              <Text style={[styles.roomProgressValue, { color: colors.primary }]}>
                {Math.max(assignedRooms - completedRooms, 0)}
              </Text>
              <Text style={[styles.roomProgressLabel, { color: colors.secondary }]}>
                Da completare
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.manageRoomsButton, { backgroundColor: colors.primary }]}
            onPress={() => router.push("/web/teacher/rooms")}
          >
            <Ionicons name="bed-outline" size={18} color={colors.onPrimary} />
            <Text style={[styles.manageRoomsButtonText, { color: colors.onPrimary }]}>
              Gestisci le tue camere
            </Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.personalSideGrid, isMobile && styles.personalSideGridMobile]}>
          <View
            style={[
              styles.personalSmallCard, isMobile && styles.personalSmallCardMobile,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Ionicons name="people-outline" size={21} color={colors.primary} />
            <Text style={[styles.personalSmallValue, { color: colors.text }]}>
              {guestCount}
            </Text>
            <Text style={[styles.personalSmallLabel, { color: colors.secondary }]}>
              I tuoi ospiti inseriti
            </Text>
          </View>

          <View
            style={[
              styles.personalSmallCard, isMobile && styles.personalSmallCardMobile,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Ionicons name="ticket-outline" size={21} color={colors.primary} />
            <Text style={[styles.personalSmallValue, { color: colors.text }]}>
              {selectedPacks}
            </Text>
            <Text style={[styles.personalSmallLabel, { color: colors.secondary }]}>
              Pack scelti dai tuoi ospiti
            </Text>
          </View>

          <View
            style={[
              styles.personalSmallCard, isMobile && styles.personalSmallCardMobile, isMobile && styles.personalSmallCardWide,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Ionicons
              name="git-pull-request-outline"
              size={21}
              color={pendingRequests > 0 ? colors.warning : colors.primary}
            />
            <Text style={[styles.personalSmallValue, { color: colors.text }]}>
              {pendingRequests}
            </Text>
            <Text style={[styles.personalSmallLabel, { color: colors.secondary }]}>
              Tue richieste in attesa
            </Text>
          </View>
        </View>
      </View>

      <Text style={[styles.sectionTitle, { color: colors.text }]}>
        Le tue funzioni
      </Text>

      <View style={[styles.grid, isMobile && styles.gridMobile]}>
        {ACTIONS.map(([label, icon, route]) => (
          <TouchableOpacity
            key={label}
            style={[
              styles.card,
              isMobile && styles.cardMobile, isNarrow && styles.cardNarrow,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
            onPress={() => router.push(route as never)}
          >
            <View
              style={[styles.icon, { backgroundColor: `${colors.primary}12` }]}
            >
              <Ionicons name={icon} size={24} color={colors.primary} />
            </View>
            <Text style={[styles.cardTitle, { color: colors.text }]}>{label}</Text>
            <Ionicons name="arrow-forward-outline" size={19} color={colors.secondary} />
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    width: "100%",
    maxWidth: 1220,
    alignSelf: "center",
    padding: 32,
    paddingBottom: 80,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 24,
  },
  eyebrow: { fontSize: 10, fontWeight: "900", letterSpacing: 1.2, marginBottom: 6 },
  title: { fontSize: 34, fontWeight: "900", letterSpacing: -1 },
  subtitle: { fontSize: 12, fontWeight: "700", marginTop: 6 },
  logout: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 13,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
  },
  logoutText: { fontSize: 10, fontWeight: "900", marginLeft: 6 },

  eventCard: {
    borderWidth: 1,
    borderRadius: 24,
    overflow: "hidden",
    marginBottom: 18,
  },
  eventImage: { width: "100%", height: 250, resizeMode: "cover" },
  imagePlaceholder: { alignItems: "center", justifyContent: "center" },
  eventBody: { padding: 20 },
  eventTopRow: { flexDirection: "row", marginBottom: 10 },
  countdown: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    flexDirection: "row",
    alignItems: "center",
  },
  countdownText: { fontSize: 9, fontWeight: "900", marginLeft: 5 },
  eventTitle: { fontSize: 27, fontWeight: "900" },
  eventMeta: { fontSize: 11, fontWeight: "800", marginTop: 5 },
  eventDescription: { fontSize: 12, lineHeight: 18, fontWeight: "700", marginTop: 10 },

  eventInfoGrid: { flexDirection: "row", gap: 12, marginTop: 18 },
  packPanel: { flex: 0.9, borderWidth: 1, borderRadius: 18, padding: 14 },
  artistsPanel: { flex: 1.6, borderWidth: 1, borderRadius: 18, padding: 14 },
  panelHeader: { flexDirection: "row", alignItems: "center", marginBottom: 11 },
  panelTitle: { fontSize: 12, fontWeight: "900", marginLeft: 7 },
  packRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
  },
  packLetter: { fontSize: 10, fontWeight: "900" },
  packPrice: { fontSize: 10, fontWeight: "900" },
  emptySmall: { fontSize: 10, fontWeight: "700" },
  artistRow: { gap: 10 },
  artist: { width: 78 },
  artistImage: { width: 58, height: 58, borderRadius: 16, marginBottom: 6 },
  artistPlaceholder: { alignItems: "center", justifyContent: "center" },
  artistName: { fontSize: 9, fontWeight: "900" },

  emptyEvent: {
    borderWidth: 1,
    borderRadius: 22,
    minHeight: 180,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  emptyEventTitle: { fontSize: 18, fontWeight: "900", marginTop: 9 },

  personalSummary: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 28,
  },
  personalMainCard: {
    flex: 1.45,
    borderWidth: 1,
    borderRadius: 22,
    padding: 18,
  },
  personalMainHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 18,
  },
  personalMainIcon: {
    width: 48,
    height: 48,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 11,
  },
  personalMainTitle: {
    fontSize: 17,
    fontWeight: "900",
  },
  personalMainSubtitle: {
    fontSize: 10,
    lineHeight: 14,
    fontWeight: "700",
    marginTop: 3,
  },
  roomProgressRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 18,
  },
  roomProgressItem: {
    flex: 1,
  },
  roomProgressDivider: {
    width: 1,
    height: 34,
    backgroundColor: "rgba(127,127,127,0.18)",
    marginHorizontal: 8,
  },
  roomProgressValue: {
    fontSize: 25,
    fontWeight: "900",
  },
  roomProgressLabel: {
    fontSize: 9,
    fontWeight: "800",
    marginTop: 3,
  },
  manageRoomsButton: {
    minHeight: 45,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  manageRoomsButtonText: {
    fontSize: 10,
    fontWeight: "900",
    marginLeft: 7,
  },
  personalSideGrid: {
    flex: 1,
    gap: 10,
  },
  personalSmallCard: {
    flex: 1,
    minHeight: 82,
    borderWidth: 1,
    borderRadius: 18,
    padding: 13,
    justifyContent: "center",
  },
  personalSmallValue: {
    fontSize: 21,
    fontWeight: "900",
    marginTop: 7,
  },
  personalSmallLabel: {
    fontSize: 9,
    lineHeight: 13,
    fontWeight: "800",
    marginTop: 2,
  },

  sectionTitle: { fontSize: 21, fontWeight: "900", marginBottom: 12 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 11 },
  card: {
    width: "31.8%",
    minHeight: 125,
    borderWidth: 1,
    borderRadius: 20,
    padding: 15,
    justifyContent: "space-between",
  },
  icon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: { fontSize: 14, fontWeight: "900" },
  contentMobile: { paddingHorizontal: 14, paddingTop: 18, paddingBottom: 60 },
  contentTablet: { paddingHorizontal: 24, paddingTop: 24 },
  headerMobile: { marginBottom: 16 },
  titleMobile: { fontSize: 27, lineHeight: 31, letterSpacing: -0.6 },
  subtitleMobile: { fontSize: 11, lineHeight: 16, maxWidth: "100%" },
  eventImageMobile: { height: 210 },
  eventTitleMobile: { fontSize: 22, lineHeight: 26 },
  eventInfoGridMobile: { flexDirection: "column", gap: 10 },
  panelMobile: { flex: 0, width: "100%" },
  personalSummaryMobile: { flexDirection: "column", gap: 10, marginBottom: 22 },
  personalMainCardMobile: { flex: 0, width: "100%" },
  personalSideGridMobile: { flex: 0, width: "100%", flexDirection: "row", flexWrap: "wrap", gap: 8 },
  personalSmallCardMobile: { flex: 0, flexBasis: "48.5%", minWidth: 0, minHeight: 108 },
  personalSmallCardWide: { flexBasis: "100%" },
  gridMobile: { gap: 9 },
  cardMobile: { width: "48.5%", minHeight: 112, padding: 13 },
  cardNarrow: { width: "100%", minHeight: 96 },
});
