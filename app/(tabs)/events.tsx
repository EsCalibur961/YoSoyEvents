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
import { Image } from "expo-image";
import { useTheme } from "../../contexts/ThemeContext";
import { db } from "../../firebase";

type EventPack = {
  id: string;
  letter?: string;
  price?: string;
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
  description?: string;
  instagram?: string;
  image?: string;
  isVisible?: boolean;
};

type AppNotification = {
  id: string;
};

type NotificationRead = {
  id: string;
  notificationId?: string;
  username?: string;
  read?: boolean;
};

export default function EventsScreen() {
  const { colors, isDark } = useTheme();
  const styles = createStyles(colors, isDark);
  const [role, setRole] = useState<string | null>(null);
  const [teacherUsername, setTeacherUsername] = useState<string | null>(null);

  const [events, setEvents] = useState<EventItem[]>([]);
  const [artists, setArtists] = useState<ArtistItem[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [reads, setReads] = useState<NotificationRead[]>([]);

  useFocusEffect(
    useCallback(() => {
      loadUser();

      let unsubEvents: (() => void) | null = null;
      let unsubArtists: (() => void) | null = null;
      let unsubNotifications: (() => void) | null = null;
      let unsubReads: (() => void) | null = null;

      try {
        unsubEvents = onSnapshot(collection(db, "events"), (snapshot) => {
          const data: EventItem[] = snapshot.docs.map((item) => ({
            id: item.id,
            ...(item.data() as Omit<EventItem, "id">),
          }));

          setEvents(data);
        });

        unsubArtists = onSnapshot(collection(db, "artists"), (snapshot) => {
          const data: ArtistItem[] = snapshot.docs.map((item) => ({
            id: item.id,
            ...(item.data() as Omit<ArtistItem, "id">),
          }));

          setArtists(data);
        });

        unsubNotifications = onSnapshot(
          collection(db, "notifications"),
          (snapshot) => {
            const data: AppNotification[] = snapshot.docs.map((item) => ({
              id: item.id,
            }));

            setNotifications(data);
          },
        );

        unsubReads = onSnapshot(
          collection(db, "notificationReads"),
          (snapshot) => {
            const data: NotificationRead[] = snapshot.docs.map((item) => ({
              id: item.id,
              ...(item.data() as Omit<NotificationRead, "id">),
            }));

            setReads(data);
          },
        );
      } catch {
        setEvents([]);
        setArtists([]);
        setNotifications([]);
        setReads([]);
      }

      return () => {
        if (unsubEvents) unsubEvents();
        if (unsubArtists) unsubArtists();
        if (unsubNotifications) unsubNotifications();
        if (unsubReads) unsubReads();
      };
    }, []),
  );

  const loadUser = async () => {
    try {
      const savedRole = await AsyncStorage.getItem("loggedUser");
      const savedTeacherUsername =
        await AsyncStorage.getItem("teacherUsername");

      setRole(savedRole);
      setTeacherUsername(savedTeacherUsername);
    } catch {
      setRole(null);
      setTeacherUsername(null);
    }
  };

  const currentUsername = role === "admin" ? "admin" : teacherUsername || "";

  const unreadCount = useMemo(() => {
    if (!currentUsername) return 0;

    return notifications.filter((notification) => {
      return !reads.some(
        (read) =>
          read.notificationId === notification.id &&
          read.username === currentUsername &&
          read.read,
      );
    }).length;
  }, [notifications, reads, currentUsername]);

  const parseDate = (value?: string) => {
    if (!value) return new Date(2999, 0, 1);

    const parts = value.split("/");
    if (parts.length !== 3) return new Date(2999, 0, 1);

    const [day, month, year] = parts;

    const parsed = new Date(Number(year), Number(month) - 1, Number(day));

    if (Number.isNaN(parsed.getTime())) return new Date(2999, 0, 1);

    return parsed;
  };

  const sortedEvents = useMemo(() => {
    return [...events].sort(
      (a, b) =>
        parseDate(a.startDate).getTime() - parseDate(b.startDate).getTime(),
    );
  }, [events]);

  const visibleArtists = useMemo(() => {
    return artists
      .filter((artist) => artist.isVisible !== false)
      .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  }, [artists]);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: colors.text }]}>Esplora</Text>
          <Text style={[styles.subtitle, { color: colors.secondary }]}>
            Eventi pubblicati dall’admin.
          </Text>
        </View>

        <TouchableOpacity
          style={[
            styles.bellButton,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
          onPress={() => router.push("/notifications")}
        >
          <Ionicons name="notifications" size={25} color={colors.primary} />

          {unreadCount > 0 ? (
            <View
              style={[styles.badge, { backgroundColor: colors.primaryDark }]}
            >
              <Text style={styles.badgeText}>
                {unreadCount > 99 ? "99+" : unreadCount}
              </Text>
            </View>
          ) : null}
        </TouchableOpacity>
      </View>

      <View style={[styles.artistsSection, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.artistsHeader}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.artistsTitle, { color: colors.text }]}>Artisti dell’evento</Text>
            <Text style={[styles.artistsSubtitle, { color: colors.secondary }]}>
              DJ, artisti e ospiti pubblicati dall’admin.
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.artistsButton, { backgroundColor: colors.primaryDark }]}
            onPress={() => router.push("/artists")}
          >
            <Text style={styles.artistsButtonText}>Vedi tutti</Text>
          </TouchableOpacity>
        </View>

        {visibleArtists.length === 0 ? (
          <Text style={[styles.emptyArtistText, { color: colors.secondary }]}>Nessun artista pubblicato.</Text>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.artistsList}>
            {visibleArtists.slice(0, 8).map((artist) => (
              <TouchableOpacity key={artist.id} style={styles.artistMiniCard} onPress={() => router.push("/artists")}>
                {artist.image ? (
                  <Image
                    source={artist.image}
                    style={styles.artistMiniImage}
                    contentFit="cover"
                    cachePolicy="memory-disk"
                    transition={0}
                  />
                ) : (
                  <View style={[styles.artistMiniPlaceholder, { backgroundColor: colors.cardAlt, borderColor: colors.border }]}>
                    <Ionicons name="person-outline" size={28} color={colors.muted} />
                  </View>
                )}

                <Text numberOfLines={1} style={[styles.artistMiniName, { color: colors.text }]}>
                  {artist.name || "Artista"}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>

      {sortedEvents.length === 0 ? (
        <View
          style={[
            styles.emptyBox,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Ionicons name="calendar" size={50} color={colors.secondary} />

          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            Nessun evento pubblicato
          </Text>

          <Text style={[styles.emptyText, { color: colors.secondary }]}>
            Quando l’admin pubblicherà un evento, comparirà qui.
          </Text>
        </View>
      ) : (
        sortedEvents.map((event) => (
          <TouchableOpacity
            key={event.id}
            style={[
              styles.eventCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
            onPress={() =>
              router.push({
                pathname: "/event-details",
                params: { id: event.id },
              })
            }
          >
            {event.image ? (
              <Image
                source={event.image}
                style={styles.eventImage}
                contentFit="cover"
                cachePolicy="memory-disk"
                transition={0}
              />
            ) : (
              <View
                style={[
                  styles.imagePlaceholder,
                  {
                    backgroundColor: colors.cardAlt,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Ionicons name="image-outline" size={40} color={colors.muted} />
              </View>
            )}

            <Text style={[styles.eventTitle, { color: colors.text }]}>
              {event.title || "Evento senza titolo"}
            </Text>

            <Text style={[styles.eventDate, { color: colors.primary }]}>
              Dal {event.startDate || "-"} al {event.endDate || "-"}
            </Text>

            <Text style={[styles.eventLocation, { color: colors.text }]}>
              {event.location || "Location non inserita"}
            </Text>

            <Text
              numberOfLines={3}
              style={[styles.eventDescription, { color: colors.secondary }]}
            >
              {event.description || "Nessuna descrizione disponibile."}
            </Text>

            <View
              style={[
                styles.packBox,
                { backgroundColor: colors.cardAlt, borderColor: colors.border },
              ]}
            >
              <Text style={[styles.packTitle, { color: colors.text }]}>
                Pack disponibili
              </Text>

              {Array.isArray(event.packs) && event.packs.length > 0 ? (
                event.packs.map((pack) => (
                  <Text
                    key={pack.id}
                    style={[styles.packText, { color: colors.secondary }]}
                  >
                    Pack {pack.letter || "-"}: €{pack.price || "0"}
                  </Text>
                ))
              ) : (
                <Text style={[styles.packText, { color: colors.secondary }]}>
                  Nessun pack disponibile.
                </Text>
              )}
            </View>

            <View
              style={[
                styles.detailsButton,
                { backgroundColor: colors.primaryDark },
              ]}
            >
              <Text style={styles.detailsButtonText}>Vedi dettagli</Text>
            </View>
          </TouchableOpacity>
        ))
      )}
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
      paddingBottom: 130,
    },

    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      marginBottom: 26,
    },

    headerText: {
      flex: 1,
      paddingRight: 14,
    },

    title: {
      color: colors.text,
      fontSize: 40,
      fontWeight: "900",
    },

    subtitle: {
      color: colors.secondary,
      fontSize: 16,
      marginTop: 6,
      lineHeight: 22,
    },

    bellButton: {
      width: 56,
      height: 56,
      borderRadius: 18,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
    },

    badge: {
      position: "absolute",
      top: -5,
      right: -5,
      minWidth: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 5,
    },

    badgeText: {
      color: colors.text,
      fontSize: 11,
      fontWeight: "900",
    },

    artistsSection: {
      backgroundColor: colors.card,
      borderRadius: 28,
      padding: 16,
      marginBottom: 22,
      borderWidth: 1,
      borderColor: colors.border,
    },

    artistsHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 12,
      marginBottom: 14,
    },

    artistsTitle: { color: colors.text, fontSize: 22, fontWeight: "900" },
    artistsSubtitle: { color: colors.secondary, fontSize: 13, fontWeight: "800", marginTop: 4 },
    artistsButton: { backgroundColor: colors.primary, borderRadius: 15, paddingVertical: 10, paddingHorizontal: 13 },
    artistsButtonText: { color: colors.onPrimary, fontSize: 12, fontWeight: "900" },
    artistsList: { gap: 12, paddingRight: 4 },
    artistMiniCard: { width: 110 },
    artistMiniImage: { width: 110, height: 120, borderRadius: 18, backgroundColor: colors.background, marginBottom: 8 },
    artistMiniPlaceholder: {
      width: 110,
      height: 120,
      borderRadius: 18,
      borderWidth: 1,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 8,
    },
    artistMiniName: { color: colors.text, fontSize: 13, fontWeight: "900", textAlign: "center" },
    emptyArtistText: { color: colors.secondary, fontSize: 14, fontWeight: "800", textAlign: "center", paddingVertical: 10 },

    eventCard: {
      backgroundColor: colors.card,
      borderRadius: 28,
      padding: 18,
      marginBottom: 20,
      borderWidth: 1,
    },

    eventImage: {
      width: "100%",
      height: 220,
      borderRadius: 22,
      marginBottom: 16,
      backgroundColor: colors.background,
    },

    imagePlaceholder: {
      width: "100%",
      height: 220,
      borderRadius: 22,
      marginBottom: 16,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
    },

    eventTitle: {
      color: colors.text,
      fontSize: 24,
      fontWeight: "900",
      marginBottom: 8,
    },

    eventDate: {
      color: colors.primary,
      fontSize: 14,
      fontWeight: "900",
      marginBottom: 6,
    },

    eventLocation: {
      color: colors.text,
      fontSize: 15,
      fontWeight: "800",
      marginBottom: 10,
    },

    eventDescription: {
      color: colors.secondary,
      fontSize: 15,
      lineHeight: 22,
      marginBottom: 14,
    },

    packBox: {
      backgroundColor: colors.background,
      borderRadius: 16,
      padding: 12,
      marginBottom: 14,
      borderWidth: 1,
      borderColor: colors.border,
    },

    packTitle: {
      color: colors.text,
      fontSize: 15,
      fontWeight: "900",
      marginBottom: 8,
    },

    packText: {
      color: colors.secondary,
      fontSize: 14,
      fontWeight: "800",
      marginBottom: 4,
    },

    detailsButton: {
      backgroundColor: colors.primary,
      borderRadius: 18,
      paddingVertical: 15,
      alignItems: "center",
    },

    detailsButtonText: {
      color: colors.onPrimary,
      fontSize: 15,
      fontWeight: "900",
    },

    emptyBox: {
      backgroundColor: colors.card,
      borderRadius: 28,
      padding: 30,
      alignItems: "center",
      borderWidth: 1,
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
