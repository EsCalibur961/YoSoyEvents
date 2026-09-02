import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router } from "expo-router";
import { collection, onSnapshot } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import {
  Linking,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";

import { useTheme } from "../../../contexts/ThemeContext";
import { db } from "../../../firebase";
import { instagramUrl } from "../../../utils/safeUrls";

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

const parseDate = (value?: string) => {
  if (!value) return new Date(2999, 0, 1);
  const parts = value.split("/");
  if (parts.length !== 3) return new Date(2999, 0, 1);
  const [day, month, year] = parts;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  return Number.isNaN(date.getTime()) ? new Date(2999, 0, 1) : date;
};

export default function TeacherWebExploreScreen() {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const isMobile = width < 700;
  const isNarrow = width < 420;
  const styles = createStyles(colors);

  const [events, setEvents] = useState<EventItem[]>([]);
  const [artists, setArtists] = useState<ArtistItem[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<EventItem | null>(null);
  const [selectedArtist, setSelectedArtist] = useState<ArtistItem | null>(null);

  useEffect(() => {
    const unsubEvents = onSnapshot(collection(db, "events"), (snapshot) => {
      setEvents(
        snapshot.docs.map((item) => ({
          id: item.id,
          ...(item.data() as Omit<EventItem, "id">),
        })),
      );
    });

    const unsubArtists = onSnapshot(collection(db, "artists"), (snapshot) => {
      setArtists(
        snapshot.docs.map((item) => ({
          id: item.id,
          ...(item.data() as Omit<ArtistItem, "id">),
        })),
      );
    });

    return () => {
      unsubEvents();
      unsubArtists();
    };
  }, []);

  const sortedEvents = useMemo(
    () =>
      [...events].sort(
        (a, b) => parseDate(a.startDate).getTime() - parseDate(b.startDate).getTime(),
      ),
    [events],
  );

  const visibleArtists = useMemo(
    () =>
      artists
        .filter((artist) => artist.isVisible !== false)
        .sort((a, b) => (a.name || "").localeCompare(b.name || "")),
    [artists],
  );

  const openInstagram = async (instagram?: string) => {
    if (!instagram?.trim()) return;
    const url = instagramUrl(instagram);
    if (!url) return;

    try {
      await Linking.openURL(url);
    } catch {}
  };

  return (
    <>
      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        contentContainerStyle={[styles.content, isMobile && styles.contentMobile]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.header, isMobile && styles.headerMobile]}>
          <View>
            <Text style={[styles.eyebrow, { color: colors.primary }]}>
              YO SOY EVENTS / WEB MAESTRO
            </Text>
            <Text style={[styles.title, { color: colors.text }]}>Esplora</Text>
            <Text style={[styles.subtitle, { color: colors.secondary }]}>
              Eventi pubblicati, Pack disponibili e artisti presenti.
            </Text>
          </View>

          <TouchableOpacity
            style={[
              styles.homeButton,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
            onPress={() => router.replace("/web/teacher")}
          >
            <Ionicons name="home-outline" size={18} color={colors.primary} />
            <Text style={[styles.homeButtonText, { color: colors.primary }]}>
              Home maestro
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>Eventi</Text>

        {sortedEvents.length === 0 ? (
          <View
            style={[
              styles.emptyBox,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Ionicons name="calendar-outline" size={42} color={colors.secondary} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              Nessun evento pubblicato
            </Text>
          </View>
        ) : (
          <View style={styles.eventsGrid}>
            {sortedEvents.map((event) => (
              <TouchableOpacity
                key={event.id}
                activeOpacity={0.9}
                style={[
                  styles.eventCard, isMobile && styles.eventCardMobile,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
                onPress={() => setSelectedEvent(event)}
              >
                {event.image ? (
                  <Image
                    source={event.image}
                    style={styles.eventImage}
                    contentFit="cover"
                    cachePolicy="memory-disk"
                  />
                ) : (
                  <View
                    style={[
                      styles.eventImage,
                      styles.placeholder,
                      { backgroundColor: colors.background },
                    ]}
                  >
                    <Ionicons
                      name="image-outline"
                      size={34}
                      color={colors.secondary}
                    />
                  </View>
                )}

                <View style={styles.eventBody}>
                  <Text
                    numberOfLines={2}
                    style={[styles.eventTitle, { color: colors.text }]}
                  >
                    {event.title || "Evento"}
                  </Text>
                  <Text style={[styles.eventMeta, { color: colors.secondary }]}>
                    {event.startDate || "-"} → {event.endDate || "-"}
                  </Text>
                  <Text
                    numberOfLines={1}
                    style={[styles.eventMeta, { color: colors.secondary }]}
                  >
                    {event.location || "Location non inserita"}
                  </Text>

                  <View style={styles.eventFooter}>
                    <Text style={[styles.packCount, { color: colors.primary }]}>
                      {event.packs?.length || 0} Pack
                    </Text>
                    <Ionicons
                      name="arrow-forward-outline"
                      size={18}
                      color={colors.secondary}
                    />
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={styles.sectionHeader}>
          <View>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Artisti</Text>
            <Text style={[styles.sectionSubtitle, { color: colors.secondary }]}>
              {visibleArtists.length} artisti pubblicati
            </Text>
          </View>
        </View>

        {visibleArtists.length === 0 ? (
          <View
            style={[
              styles.emptyBox,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Ionicons
              name="musical-notes-outline"
              size={42}
              color={colors.secondary}
            />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              Nessun artista pubblicato
            </Text>
          </View>
        ) : (
          <View style={styles.artistsGrid}>
            {visibleArtists.map((artist) => (
              <TouchableOpacity
                key={artist.id}
                activeOpacity={0.9}
                style={[
                  styles.artistCard, isMobile && styles.artistCardMobile, isNarrow && styles.artistCardNarrow,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
                onPress={() => setSelectedArtist(artist)}
              >
                {artist.image ? (
                  <Image
                    source={artist.image}
                    style={styles.artistImage}
                    contentFit="cover"
                    cachePolicy="memory-disk"
                  />
                ) : (
                  <View
                    style={[
                      styles.artistImage,
                      styles.placeholder,
                      { backgroundColor: colors.background },
                    ]}
                  >
                    <Ionicons
                      name="person-outline"
                      size={30}
                      color={colors.secondary}
                    />
                  </View>
                )}

                <View style={styles.artistBody}>
                  <Text
                    numberOfLines={1}
                    style={[styles.artistName, { color: colors.text }]}
                  >
                    {artist.name || "Artista"}
                  </Text>
                  <Text
                    numberOfLines={1}
                    style={[styles.artistInstagram, { color: colors.primary }]}
                  >
                    {artist.instagram
                      ? artist.instagram.startsWith("@")
                        ? artist.instagram
                        : `@${artist.instagram.replace("https://instagram.com/", "")}`
                      : "Instagram non inserito"}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>

      <Modal
        visible={Boolean(selectedEvent)}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedEvent(null)}
      >
        <View style={[styles.modalOverlay, isMobile && styles.modalOverlayMobile]}>
          <View
            style={[
              styles.eventModal,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setSelectedEvent(null)}
            >
              <Ionicons name="close" size={22} color={colors.text} />
            </TouchableOpacity>

            <ScrollView showsVerticalScrollIndicator={false}>
              {selectedEvent?.image ? (
                <Image
                  source={selectedEvent.image}
                  style={[styles.modalEventImage, isMobile && styles.modalImageMobile]}
                  contentFit="cover"
                />
              ) : null}

              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {selectedEvent?.title || "Evento"}
              </Text>
              <Text style={[styles.modalMeta, { color: colors.secondary }]}>
                {selectedEvent?.startDate || "-"} → {selectedEvent?.endDate || "-"} •{" "}
                {selectedEvent?.location || "Location non inserita"}
              </Text>

              <Text style={[styles.modalSectionTitle, { color: colors.text }]}>
                Descrizione
              </Text>
              <Text style={[styles.modalDescription, { color: colors.secondary }]}>
                {selectedEvent?.description || "Nessuna descrizione disponibile."}
              </Text>

              <Text style={[styles.modalSectionTitle, { color: colors.text }]}>
                Pack a persona
              </Text>

              {selectedEvent?.packs?.length ? (
                <View style={styles.modalPacksGrid}>
                  {selectedEvent.packs.map((pack) => (
                    <View
                      key={pack.id}
                      style={[
                        styles.modalPackCard, isMobile && styles.modalPackCardMobile,
                        { backgroundColor: colors.background, borderColor: colors.border },
                      ]}
                    >
                      <View style={styles.modalPackTop}>
                        <Text style={[styles.modalPackLetter, { color: colors.text }]}>
                          Pack {pack.letter || "-"}
                        </Text>
                        <Text style={[styles.modalPackPrice, { color: colors.success }]}>
                          €{pack.price || "0"}
                        </Text>
                      </View>
                      <Text
                        style={[styles.modalPackDescription, { color: colors.secondary }]}
                      >
                        {pack.description || "Nessuna descrizione."}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={[styles.modalDescription, { color: colors.secondary }]}>
                  Nessun Pack disponibile.
                </Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={Boolean(selectedArtist)}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedArtist(null)}
      >
        <View style={[styles.modalOverlay, isMobile && styles.modalOverlayMobile]}>
          <View
            style={[
              styles.artistModal,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setSelectedArtist(null)}
            >
              <Ionicons name="close" size={22} color={colors.text} />
            </TouchableOpacity>

            {selectedArtist?.image ? (
              <Image
                source={selectedArtist.image}
                style={[styles.modalArtistImage, isMobile && styles.modalImageMobile]}
                contentFit="cover"
              />
            ) : null}

            <Text style={[styles.modalTitle, { color: colors.text }]}>
              {selectedArtist?.name || "Artista"}
            </Text>
            <Text style={[styles.modalDescription, { color: colors.secondary }]}>
              {selectedArtist?.description || "Nessuna descrizione disponibile."}
            </Text>

            {selectedArtist?.instagram ? (
              <TouchableOpacity
                style={[styles.instagramButton, { backgroundColor: colors.primary }]}
                onPress={() => openInstagram(selectedArtist.instagram)}
              >
                <Ionicons name="logo-instagram" size={18} color={colors.onPrimary} />
                <Text
                  style={[styles.instagramButtonText, { color: colors.onPrimary }]}
                >
                  Apri Instagram
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      </Modal>
    </>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: { flex: 1 },
    content: {
      width: "100%",
      maxWidth: 1240,
      alignSelf: "center",
      padding: 30,
      paddingBottom: 80,
    },
    contentMobile: { padding: 14, paddingBottom: 56 },

    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      marginBottom: 26,
    },
    headerMobile: { flexDirection: "column", gap: 12 },
    eyebrow: { fontSize: 9, fontWeight: "900", letterSpacing: 1.2, marginBottom: 6 },
    title: { fontSize: 34, fontWeight: "900" },
    subtitle: { fontSize: 12, fontWeight: "700", marginTop: 6 },

    homeButton: {
      minHeight: 42,
      borderRadius: 14,
      borderWidth: 1,
      paddingHorizontal: 13,
      flexDirection: "row",
      alignItems: "center",
    },
    homeButtonText: { fontSize: 9, fontWeight: "900", marginLeft: 6 },

    sectionHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-end",
      marginTop: 30,
      marginBottom: 12,
    },
    sectionTitle: { fontSize: 22, fontWeight: "900", marginBottom: 12 },
    sectionSubtitle: { fontSize: 9, fontWeight: "700", marginTop: -6 },

    eventsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
    eventCard: {
      width: "32.4%",
      borderWidth: 1,
      borderRadius: 20,
      overflow: "hidden",
    },
    eventCardMobile: { width: "100%" },
    eventImage: { width: "100%", height: 155 },
    placeholder: { alignItems: "center", justifyContent: "center" },
    eventBody: { padding: 14 },
    eventTitle: { fontSize: 15, fontWeight: "900" },
    eventMeta: { fontSize: 9, fontWeight: "700", marginTop: 4 },
    eventFooter: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginTop: 12,
    },
    packCount: { fontSize: 9, fontWeight: "900" },

    artistsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 11 },
    artistCard: {
      width: "19%",
      borderWidth: 1,
      borderRadius: 18,
      overflow: "hidden",
    },
    artistCardMobile: { width: "31%" },
    artistCardNarrow: { width: "47.8%" },
    artistImage: { width: "100%", height: 150 },
    artistBody: { padding: 11 },
    artistName: { fontSize: 12, fontWeight: "900" },
    artistInstagram: { fontSize: 8, fontWeight: "800", marginTop: 4 },

    emptyBox: {
      minHeight: 180,
      borderWidth: 1,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
    },
    emptyTitle: { fontSize: 17, fontWeight: "900", marginTop: 10 },

    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.72)",
      alignItems: "center",
      justifyContent: "center",
      padding: 26,
    },
    modalOverlayMobile: { padding: 12 },
    eventModal: {
      width: "100%",
      maxWidth: 900,
      maxHeight: "88%",
      borderWidth: 1,
      borderRadius: 24,
      padding: 18,
    },
    artistModal: {
      width: "100%",
      maxWidth: 520,
      borderWidth: 1,
      borderRadius: 24,
      padding: 20,
    },
    closeButton: {
      alignSelf: "flex-end",
      width: 38,
      height: 38,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 8,
    },
    modalEventImage: { width: "100%", height: 300, borderRadius: 18 },
    modalArtistImage: {
      width: "100%",
      height: 300,
      borderRadius: 18,
      marginBottom: 16,
    },
    modalImageMobile: { height: 210 },
    modalTitle: { fontSize: 27, fontWeight: "900", marginTop: 16 },
    modalMeta: { fontSize: 10, fontWeight: "800", marginTop: 5 },
    modalSectionTitle: { fontSize: 16, fontWeight: "900", marginTop: 20 },
    modalDescription: { fontSize: 11, lineHeight: 17, fontWeight: "700", marginTop: 7 },
    modalPacksGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 10 },
    modalPackCard: {
      width: "48.8%",
      borderWidth: 1,
      borderRadius: 15,
      padding: 12,
    },
    modalPackCardMobile: { width: "100%" },
    modalPackTop: { flexDirection: "row", justifyContent: "space-between" },
    modalPackLetter: { fontSize: 11, fontWeight: "900" },
    modalPackPrice: { fontSize: 11, fontWeight: "900" },
    modalPackDescription: { fontSize: 9, lineHeight: 13, fontWeight: "700", marginTop: 6 },

    instagramButton: {
      minHeight: 46,
      borderRadius: 14,
      marginTop: 18,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
    },
    instagramButtonText: { fontSize: 10, fontWeight: "900", marginLeft: 7 },
  });
