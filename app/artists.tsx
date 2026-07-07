import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { collection, onSnapshot } from "firebase/firestore";
import { useCallback, useMemo, useState } from "react";
import {
  Linking,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Image } from "expo-image";
import { useTheme } from "../contexts/ThemeContext";
import { db } from "../firebase";

type ArtistItem = {
  id: string;
  name?: string;
  description?: string;
  instagram?: string;
  image?: string;
  imagePath?: string;
  isVisible?: boolean;
};

export default function ArtistsScreen() {
  const { colors, isDark } = useTheme();
  const styles = createStyles(colors, isDark);
  const [artists, setArtists] = useState<ArtistItem[]>([]);
  const [selectedArtist, setSelectedArtist] = useState<ArtistItem | null>(null);

  useFocusEffect(
    useCallback(() => {
      const unsubscribe = onSnapshot(
        collection(db, "artists"),
        (snapshot) => {
          const data: ArtistItem[] = snapshot.docs.map((item) => ({
            id: item.id,
            ...(item.data() as Omit<ArtistItem, "id">),
          }));

          setArtists(data);
        },
        () => setArtists([]),
      );

      return unsubscribe;
    }, []),
  );

  const visibleArtists = useMemo(() => {
    return artists
      .filter((artist) => artist.isVisible !== false)
      .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  }, [artists]);

  const openInstagram = async (instagram?: string) => {
    if (!instagram?.trim()) return;

    const clean = instagram.replace("@", "").trim();
    const url = clean.startsWith("http")
      ? clean
      : `https://instagram.com/${clean}`;

    try {
      await Linking.openURL(url);
    } catch {}
  };

  const formatInstagram = (instagram?: string) => {
    if (!instagram?.trim()) return "";

    return instagram.startsWith("@")
      ? instagram
      : `@${instagram.replace("https://instagram.com/", "")}`;
  };

  const getImageUri = (uri?: string) => {
    return uri?.trim() || "";
  };

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews
      >
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back-outline" size={24} color={colors.text} />
          <Text style={styles.backText}>Indietro</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Artisti</Text>

        <Text style={styles.subtitle}>
          Tocca un artista per vedere foto, descrizione e Instagram.
        </Text>

        {visibleArtists.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons
              name="musical-notes-outline"
              size={54}
              color={colors.secondary}
            />

            <Text style={styles.emptyTitle}>Nessun artista pubblicato</Text>

            <Text style={styles.emptyText}>
              Quando l’admin pubblicherà gli artisti, compariranno qui.
            </Text>
          </View>
        ) : (
          <View style={styles.grid}>
            {visibleArtists.map((artist) => (
              <TouchableOpacity
                key={artist.id}
                activeOpacity={0.9}
                style={styles.artistCard}
                onPress={() => setSelectedArtist(artist)}
              >
                {artist.image ? (
                  <Image
                    source={getImageUri(artist.image)}
                    style={styles.artistImage}
                    contentFit="cover"
                    cachePolicy="memory-disk"
                    transition={0}
                  />
                ) : (
                  <View style={styles.artistPlaceholder}>
                    <Ionicons name="person-outline" size={24} color={colors.muted} />
                  </View>
                )}

                <Text numberOfLines={2} style={styles.artistName}>
                  {artist.name || "Artista"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>

      <Modal
        visible={Boolean(selectedArtist)}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedArtist(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setSelectedArtist(null)}
            >
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>

            <ScrollView showsVerticalScrollIndicator={false}>
              {selectedArtist?.image ? (
                <Image
                  source={getImageUri(selectedArtist.image)}
                  style={styles.modalImage}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                  transition={0}
                />
              ) : (
                <View style={styles.modalPlaceholder}>
                  <Ionicons name="person-outline" size={64} color={colors.muted} />
                </View>
              )}

              <Text style={styles.modalName}>
                {selectedArtist?.name || "Artista"}
              </Text>

              {selectedArtist?.instagram?.trim() ? (
                <TouchableOpacity
                  style={styles.instagramButton}
                  onPress={() => openInstagram(selectedArtist.instagram)}
                >
                  <Ionicons name="logo-instagram" size={20} color={colors.onPrimary} />
                  <Text style={styles.instagramText}>
                    {formatInstagram(selectedArtist.instagram)}
                  </Text>
                </TouchableOpacity>
              ) : null}

              <Text style={styles.modalDescription}>
                {selectedArtist?.description?.trim()
                  ? selectedArtist.description
                  : "Nessuna descrizione disponibile."}
              </Text>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
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
      paddingHorizontal: 14,
      paddingBottom: 130,
    },

    backButton: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 24,
      paddingHorizontal: 4,
    },

    backText: {
      color: colors.text,
      fontSize: 16,
      fontWeight: "800",
      marginLeft: 6,
    },

    title: {
      color: colors.text,
      fontSize: 40,
      fontWeight: "900",
      marginBottom: 10,
      paddingHorizontal: 4,
    },

    subtitle: {
      color: colors.secondary,
      fontSize: 16,
      lineHeight: 23,
      marginBottom: 24,
      paddingHorizontal: 4,
    },

    grid: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "space-between",
      rowGap: 14,
    },

    artistCard: {
      width: "23.5%",
      backgroundColor: colors.card,
      borderRadius: 16,
      overflow: "hidden",
      borderWidth: 1,
      borderColor: colors.border,
    },

    artistImage: {
      width: "100%",
      aspectRatio: 0.78,
      backgroundColor: colors.cardAlt,
    },

    artistPlaceholder: {
      width: "100%",
      aspectRatio: 0.78,
      backgroundColor: colors.cardAlt,
      alignItems: "center",
      justifyContent: "center",
    },

    artistName: {
      color: colors.text,
      fontSize: 10,
      fontWeight: "900",
      textAlign: "center",
      paddingHorizontal: 4,
      paddingVertical: 7,
      minHeight: 42,
    },

    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.72)",
      justifyContent: "flex-end",
    },

    modalCard: {
      maxHeight: "88%",
      backgroundColor: colors.card,
      borderTopLeftRadius: 34,
      borderTopRightRadius: 34,
      padding: 20,
      borderWidth: 1,
      borderColor: colors.border,
    },

    closeButton: {
      width: 42,
      height: 42,
      borderRadius: 16,
      backgroundColor: colors.background,
      alignItems: "center",
      justifyContent: "center",
      alignSelf: "flex-end",
      marginBottom: 12,
    },

    modalImage: {
      width: "100%",
      height: 360,
      borderRadius: 26,
      backgroundColor: colors.background,
      marginBottom: 18,
    },

    modalPlaceholder: {
      width: "100%",
      height: 360,
      borderRadius: 26,
      backgroundColor: colors.cardAlt,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 18,
    },

    modalName: {
      color: colors.text,
      fontSize: 32,
      fontWeight: "900",
      marginBottom: 12,
    },

    instagramButton: {
      alignSelf: "flex-start",
      backgroundColor: colors.primaryDark,
      borderRadius: 16,
      paddingVertical: 11,
      paddingHorizontal: 14,
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 16,
    },

    instagramText: {
      color: colors.onPrimary,
      fontSize: 15,
      fontWeight: "900",
      marginLeft: 7,
    },

    modalDescription: {
      color: colors.secondary,
      fontSize: 16,
      lineHeight: 24,
      fontWeight: "700",
      marginBottom: 20,
    },

    emptyBox: {
      backgroundColor: colors.card,
      borderRadius: 28,
      padding: 30,
      alignItems: "center",
      borderWidth: 1,
      borderColor: colors.border,
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
