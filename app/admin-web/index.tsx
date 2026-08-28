import { Ionicons } from "@expo/vector-icons";
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

import { useTheme } from "../../contexts/ThemeContext";
import { db } from "../../firebase";

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
  image?: string;
  isVisible?: boolean;
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
  guests?: Guest[];
};

const QUICK = [
  ["Eventi e artisti", "calendar-outline", "/admin-web/events"],
  ["Gestione stanze", "bed-outline", "/admin-web/rooms"],
  ["Maestri", "people-outline", "/admin-web/teachers"],
  ["Camere maestri", "business-outline", "/admin-web/teacher-rooms"],
  ["Pagamenti", "wallet-outline", "/admin-web/payments"],
  ["Monitoraggio", "pulse-outline", "/admin-web/monitoring"],
  ["Richieste", "git-pull-request-outline", "/admin-web/requests"],
  ["Notifiche", "notifications-outline", "/admin-web/notifications"],
  ["Impostazioni", "settings-outline", "/admin-web/settings"],
] as const;

const parseDate = (value?: string) => {
  if (!value) return new Date(2999, 0, 1);
  const [day, month, year] = value.split("/");
  if (!day || !month || !year) return new Date(2999, 0, 1);
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  return Number.isNaN(date.getTime()) ? new Date(2999, 0, 1) : date;
};

const getLastSeenDate = (lastSeen: any) => {
  if (!lastSeen) return null;
  if (typeof lastSeen?.toDate === "function") return lastSeen.toDate();
  const date = new Date(lastSeen);
  return Number.isNaN(date.getTime()) ? null : date;
};

const isGuestComplete = (guest: Guest) =>
  Boolean(
    guest.firstName?.trim() &&
      guest.lastName?.trim() &&
      guest.birthDate?.trim() &&
      guest.birthPlace?.trim() &&
      guest.selectedPackId?.trim(),
  );

export default function AdminWebScreen() {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const isMobile = width < 700;
  const isTablet = width >= 700 && width < 1100;

  const [events, setEvents] = useState<EventItem[]>([]);
  const [artists, setArtists] = useState<ArtistItem[]>([]);
  const [teachers, setTeachers] = useState<TeacherUser[]>([]);
  const [rooms, setRooms] = useState<RoomData[]>([]);
  const [pendingRequests, setPendingRequests] = useState(0);

  useEffect(() => {
    const unsubEvents = onSnapshot(collection(db, "events"), (snap) => {
      setEvents(
        snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<EventItem, "id">),
        })),
      );
    });

    const unsubArtists = onSnapshot(collection(db, "artists"), (snap) => {
      setArtists(
        snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<ArtistItem, "id">),
        })),
      );
    });

    const unsubTeachers = onSnapshot(collection(db, "teachers"), (snap) => {
      setTeachers(
        snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<TeacherUser, "id">),
        })),
      );
    });

    const unsubRooms = onSnapshot(collection(db, "roomsData"), (snap) => {
      setRooms(
        snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<RoomData, "id">),
        })),
      );
    });

    const unsubRequests = onSnapshot(
      query(collection(db, "roomChangeRequests"), where("status", "==", "pending")),
      (snap) => setPendingRequests(snap.size),
    );

    return () => {
      unsubEvents();
      unsubArtists();
      unsubTeachers();
      unsubRooms();
      unsubRequests();
    };
  }, []);

  const nextEvent = useMemo(
    () =>
      [...events].sort(
        (a, b) => parseDate(a.startDate).getTime() - parseDate(b.startDate).getTime(),
      )[0] || null,
    [events],
  );

  const visibleArtists = useMemo(
    () =>
      artists
        .filter((artist) => artist.isVisible !== false)
        .sort((a, b) => (a.name || "").localeCompare(b.name || "")),
    [artists],
  );

  const onlineTeachers = useMemo(() => {
    const now = Date.now();
    return teachers.filter((teacher) => {
      if (!teacher.isOnline) return false;
      const lastSeen = getLastSeenDate(teacher.lastSeen);
      return Boolean(lastSeen && now - lastSeen.getTime() < 90_000);
    });
  }, [teachers]);

  const normalizedRooms = useMemo(
    () =>
      rooms.map((room) => ({
        ...room,
        guests: Array.isArray(room.guests) ? room.guests : [],
      })),
    [rooms],
  );

  const completedRooms = useMemo(
    () =>
      normalizedRooms.filter(
        (room) =>
          room.guests.length > 0 && room.guests.every(isGuestComplete),
      ).length,
    [normalizedRooms],
  );

  // Unica base dati per Ospiti, Pack e totale economico:
  // consideriamo soltanto gli ospiti realmente completi.
  const completedGuests = useMemo(
    () =>
      normalizedRooms.flatMap((room) =>
        room.guests.filter((guest) => isGuestComplete(guest)),
      ),
    [normalizedRooms],
  );

  const totalGuests = completedGuests.length;

  // Un ospite completo ha obbligatoriamente un Pack selezionato,
  // quindi questo numero deve restare coerente con "Ospiti".
  const selectedPacks = completedGuests.length;

  const totalAmount = useMemo(
    () =>
      completedGuests.reduce((sum, guest) => {
        const price = Number(guest.selectedPackPrice || 0);
        return sum + (Number.isNaN(price) ? 0 : price);
      }, 0),
    [completedGuests],
  );

  const packDistribution = useMemo(() => {
    const map = new Map<string, number>();

    completedGuests.forEach((guest) => {
      const letter = guest.selectedPackLetter?.trim();
      if (!letter) return;
      map.set(letter, (map.get(letter) || 0) + 1);
    });

    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [completedGuests]);

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

  const teacherName = (teacher: TeacherUser) =>
    `${teacher.firstName || ""} ${teacher.lastName || ""}`.trim() ||
    teacher.username ||
    "Maestro";

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={[styles.content, isMobile && styles.contentMobile, isTablet && styles.contentTablet]}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.header, isMobile && styles.headerMobile]}>
        <View style={styles.headerCopy}>
          <Text style={[styles.eyebrow, { color: colors.primary }]}>
            PANNELLO AMMINISTRATORE
          </Text>
          <Text style={[styles.title, isMobile && styles.titleMobile, { color: colors.text }]}> 
            Dashboard live YoSoyEvents
          </Text>
          <Text style={[styles.subtitle, { color: colors.secondary }]}>
            Evento, artisti, Pack e riepilogo gestionale nello stesso punto.
          </Text>
        </View>
        <View
          style={[
            styles.liveBox,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <View style={[styles.liveDot, { backgroundColor: colors.success }]} />
          <Text style={[styles.liveText, { color: colors.text }]}>
            Firebase live
          </Text>
        </View>
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
              <Ionicons name="calendar-outline" size={46} color={colors.secondary} />
            </View>
          )}

            <View style={[styles.eventBody, isMobile && styles.eventBodyMobile]}>
            <View style={[styles.countdown, { backgroundColor: `${colors.primary}18` }]}>
              <Ionicons name="time-outline" size={16} color={colors.primary} />
              <Text style={[styles.countdownText, { color: colors.primary }]}>
                {countdown}
              </Text>
            </View>

            <Text style={[styles.eventTitle, isMobile && styles.eventTitleMobile, { color: colors.text }]}> 
              {nextEvent.title || "Evento"}
            </Text>
            <Text style={[styles.eventMeta, { color: colors.secondary }]}>
              {nextEvent.startDate || "-"} → {nextEvent.endDate || "-"} •{" "}
              {nextEvent.location || "Location non inserita"}
            </Text>

            <View style={[styles.eventInfoGrid, isMobile && styles.stackMobile]}>
              <View
                style={[
                  styles.packPanel,
                  isMobile && styles.eventPanelMobile,
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
                  <Text style={[styles.smallEmpty, { color: colors.secondary }]}>
                    Nessun Pack.
                  </Text>
                )}
              </View>

              <View
                style={[
                  styles.artistPanel,
                  isMobile && styles.eventPanelMobile,
                  { backgroundColor: colors.background, borderColor: colors.border },
                ]}
              >
                <View style={styles.panelHeader}>
                  <Ionicons name="people-outline" size={19} color={colors.primary} />
                  <Text style={[styles.panelTitle, { color: colors.text }]}>
                    Artisti presenti
                  </Text>
                </View>
                <ScrollView style={styles.artistScroll} horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.artistRow}>
                    {visibleArtists.slice(0, 8).map((artist) => (
                      <TouchableOpacity
                        key={artist.id}
                        style={styles.artist}
                        onPress={() => router.push("/admin-web/events")}
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
                  </View>
                </ScrollView>
              </View>
            </View>
          </View>
        </View>
      ) : null}

      <Text style={[styles.sectionTitle, { color: colors.text }]}>
        Riepilogo gestionale
      </Text>

      <View style={[styles.stats, (isMobile || isTablet) && styles.statsWrap]}>
        {[
          ["Maestri online", onlineTeachers.length, "radio-button-on-outline", colors.success],
          ["Maestri", teachers.length, "people-outline", colors.primary],
          ["Camere complete", completedRooms, "bed-outline", colors.primary],
          ["Ospiti", totalGuests, "person-add-outline", colors.primary],
          ["Pack selezionati", selectedPacks, "ticket-outline", colors.primary],
          ["Richieste", pendingRequests, "git-pull-request-outline", colors.warning],
        ].map(([label, value, icon, tint]: any) => (
          <View
            key={label}
            style={[
              styles.stat, isMobile && styles.statMobile, isTablet && styles.statTablet,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Ionicons name={icon} size={21} color={tint} />
            <Text style={[styles.statValue, { color: colors.text }]}>{value}</Text>
            <Text style={[styles.statLabel, { color: colors.secondary }]}>
              {label}
            </Text>
          </View>
        ))}
      </View>

      <View style={[styles.managementGrid, isMobile && styles.stackMobile]}>
        <View
          style={[
            styles.presenceCard,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderCopy}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>
                Maestri online
              </Text>
              <Text style={[styles.cardSub, { color: colors.secondary }]}>
                Presenza aggiornata in tempo reale
              </Text>
            </View>
            <View
              style={[
                styles.onlineBadge,
                { backgroundColor: `${colors.success}18` },
              ]}
            >
              <Text style={[styles.onlineBadgeText, { color: colors.success }]}>
                {onlineTeachers.length} online
              </Text>
            </View>
          </View>

          {onlineTeachers.length ? (
            onlineTeachers.slice(0, 8).map((teacher) => (
              <View
                key={teacher.id}
                style={[styles.teacherRow, { borderColor: colors.border }]}
              >
                <View style={[styles.presenceDot, { backgroundColor: colors.success }]} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.teacherName, { color: colors.text }]}>
                    {teacherName(teacher)}
                  </Text>
                  <Text style={[styles.teacherMeta, { color: colors.secondary }]}>
                    @{teacher.username || "-"} • {teacher.danceSchool || "Scuola non inserita"}
                  </Text>
                </View>
              </View>
            ))
          ) : (
            <Text style={[styles.smallEmpty, { color: colors.secondary }]}>
              Nessun maestro online in questo momento.
            </Text>
          )}

          <TouchableOpacity
            style={[styles.openButton, { backgroundColor: `${colors.primary}12` }]}
            onPress={() => router.push("/admin-web/teachers")}
          >
            <Text style={[styles.openButtonText, { color: colors.primary }]}>
              Apri gestione maestri
            </Text>
          </TouchableOpacity>
        </View>

        <View
          style={[
            styles.packSummary,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.cardTitle, { color: colors.text }]}>
            Totale Pack selezionati
          </Text>
          <Text style={[styles.totalAmount, { color: colors.success }]}>
            €{totalAmount.toLocaleString("it-IT")}
          </Text>
          <Text style={[styles.cardSub, { color: colors.secondary }]}>
            {selectedPacks} Pack scelti dagli ospiti inseriti dai maestri
          </Text>

          <View style={styles.packDistribution}>
            {packDistribution.length ? (
              packDistribution.map(([letter, count]) => (
                <View
                  key={letter}
                  style={[
                    styles.packChip,
                    { backgroundColor: colors.background, borderColor: colors.border },
                  ]}
                >
                  <Text style={[styles.packChipLetter, { color: colors.text }]}>
                    Pack {letter}
                  </Text>
                  <Text style={[styles.packChipCount, { color: colors.primary }]}>
                    {count}
                  </Text>
                </View>
              ))
            ) : (
              <Text style={[styles.smallEmpty, { color: colors.secondary }]}>
                Nessun Pack ancora selezionato.
              </Text>
            )}
          </View>
        </View>
      </View>

      <Text style={[styles.sectionTitle, { color: colors.text }]}>Gestione</Text>
      <View style={styles.quickGrid}>
        {QUICK.map(([label, icon, route]) => (
          <TouchableOpacity
            key={route}
            style={[
              styles.quickCard, isMobile && styles.quickCardMobile, isTablet && styles.quickCardTablet,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
            onPress={() => router.push(route as never)}
          >
            <View
              style={[styles.quickIcon, { backgroundColor: `${colors.primary}12` }]}
            >
              <Ionicons name={icon} size={22} color={colors.primary} />
            </View>
            <Text style={[styles.quickTitle, { color: colors.text }]}>{label}</Text>
            <Ionicons name="arrow-forward-outline" size={18} color={colors.secondary} />
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    width: "100%",
    minWidth: 0,
    maxWidth: 1320,
    alignSelf: "center",
    padding: 28,
    paddingBottom: 70,
  },
  contentMobile: { padding: 14, paddingBottom: 48 },
  contentTablet: { padding: 22 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 22,
  },
  headerMobile: { flexDirection: "column", gap: 12, marginBottom: 18 },
  headerCopy: { flexShrink: 1, minWidth: 0 },
  eyebrow: { fontSize: 9, fontWeight: "900", letterSpacing: 1.2, marginBottom: 6 },
  title: { fontSize: 32, fontWeight: "900", letterSpacing: -1 },
  titleMobile: { fontSize: 25, lineHeight: 30 },
  subtitle: { fontSize: 12, fontWeight: "700", marginTop: 6 },
  liveBox: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 13,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
  },
  liveDot: { width: 8, height: 8, borderRadius: 4, marginRight: 7 },
  liveText: { fontSize: 10, fontWeight: "900" },

  eventCard: {
    width: "100%",
    minWidth: 0,
    borderWidth: 1,
    borderRadius: 22,
    overflow: "hidden",
    marginBottom: 24,
  },
  eventImage: { width: "100%", height: 230, resizeMode: "cover" },
  eventImageMobile: { height: 190 },
  imagePlaceholder: { alignItems: "center", justifyContent: "center" },
  eventBody: { minWidth: 0, padding: 18 },
  eventBodyMobile: { padding: 14 },
  countdown: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  countdownText: { fontSize: 9, fontWeight: "900", marginLeft: 5 },
  eventTitle: { fontSize: 26, fontWeight: "900" },
  eventTitleMobile: { fontSize: 22, lineHeight: 27 },
  eventMeta: { fontSize: 11, fontWeight: "800", marginTop: 5 },
  eventInfoGrid: { width: "100%", minWidth: 0, flexDirection: "row", gap: 12, marginTop: 16 },
  stackMobile: { flexDirection: "column", width: "100%" },
  packPanel: { flex: 0.9, minWidth: 0, borderWidth: 1, borderRadius: 17, padding: 13 },
  artistPanel: { flex: 1.6, minWidth: 0, borderWidth: 1, borderRadius: 17, padding: 13 },
  eventPanelMobile: { flexGrow: 0, flexShrink: 0, flexBasis: "auto", width: "100%" },
  artistScroll: { width: "100%", minWidth: 0 },
  panelHeader: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  panelTitle: { fontSize: 11, fontWeight: "900", marginLeft: 7 },
  packRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 5 },
  packLetter: { fontSize: 10, fontWeight: "900" },
  packPrice: { fontSize: 10, fontWeight: "900" },
  artistRow: { flexDirection: "row", gap: 10 },
  artist: { width: 72 },
  artistImage: { width: 54, height: 54, borderRadius: 15, marginBottom: 5 },
  artistPlaceholder: { alignItems: "center", justifyContent: "center" },
  artistName: { fontSize: 8, fontWeight: "900" },
  smallEmpty: { fontSize: 10, fontWeight: "700" },

  sectionTitle: { fontSize: 21, fontWeight: "900", marginBottom: 12 },
  stats: { flexDirection: "row", gap: 9, marginBottom: 18 },
  statsWrap: { flexWrap: "wrap" },
  stat: { flex: 1, borderWidth: 1, borderRadius: 17, padding: 13 },
  statMobile: { flexGrow: 1, flexShrink: 1, flexBasis: 150, minWidth: 140, minHeight: 118 },
  statTablet: { flexGrow: 1, flexShrink: 1, flexBasis: 190, minWidth: 170 },
  statValue: { fontSize: 23, fontWeight: "900", marginTop: 9 },
  statLabel: { fontSize: 8, fontWeight: "800", marginTop: 2 },

  managementGrid: { width: "100%", minWidth: 0, flexDirection: "row", gap: 12, marginBottom: 25 },
  presenceCard: { flex: 1.3, minWidth: 0, borderWidth: 1, borderRadius: 20, padding: 16 },
  packSummary: { flex: 0.9, minWidth: 0, borderWidth: 1, borderRadius: 20, padding: 16 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 10 },
  cardHeaderCopy: { flexShrink: 1, minWidth: 0 },
  cardTitle: { fontSize: 15, fontWeight: "900" },
  cardSub: { fontSize: 9, lineHeight: 13, fontWeight: "700", marginTop: 3 },
  onlineBadge: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5 },
  onlineBadgeText: { fontSize: 8, fontWeight: "900" },
  teacherRow: {
    minHeight: 46,
    borderBottomWidth: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  presenceDot: { width: 8, height: 8, borderRadius: 4, marginRight: 9 },
  teacherName: { fontSize: 10, fontWeight: "900" },
  teacherMeta: { fontSize: 8, fontWeight: "700", marginTop: 2 },
  openButton: { borderRadius: 12, paddingVertical: 9, alignItems: "center", marginTop: 10 },
  openButtonText: { fontSize: 9, fontWeight: "900" },

  totalAmount: { fontSize: 34, fontWeight: "900", marginTop: 14 },
  packDistribution: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginTop: 16 },
  packChip: {
    minWidth: 90,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  packChipLetter: { fontSize: 9, fontWeight: "900" },
  packChipCount: { fontSize: 10, fontWeight: "900", marginLeft: 10 },

  quickGrid: { width: "100%", minWidth: 0, flexDirection: "row", flexWrap: "wrap", gap: 10 },
  quickCard: {
    width: "24%",
    minHeight: 105,
    borderWidth: 1,
    borderRadius: 18,
    padding: 13,
    justifyContent: "space-between",
  },
  quickCardMobile: { width: "auto", flexGrow: 1, flexShrink: 1, flexBasis: 150, minWidth: 140, minHeight: 118 },
  quickCardTablet: { width: "auto", flexGrow: 1, flexShrink: 1, flexBasis: 210, minWidth: 190 },
  quickIcon: {
    width: 39,
    height: 39,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  quickTitle: { minWidth: 0, fontSize: 11, fontWeight: "900" },
});
