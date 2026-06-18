import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { doc, onSnapshot } from "firebase/firestore";
import { useEffect, useState } from "react";
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { db } from "../firebase";
import { useTheme } from "../contexts/ThemeContext";

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

export default function EventDetailsScreen() {
  const { colors, isDark } = useTheme();
  const styles = createStyles(colors, isDark);
  const params = useLocalSearchParams();
  const id = typeof params.id === "string" ? params.id : "";

  const [event, setEvent] = useState<EventItem | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      setEvent(null);
      return;
    }

    const unsubscribe = onSnapshot(
      doc(db, "events", id),
      (snapshot) => {
        if (!snapshot.exists()) {
          setEvent(null);
          setLoading(false);
          return;
        }

        setEvent({
          id: snapshot.id,
          ...(snapshot.data() as Omit<EventItem, "id">),
        });

        setLoading(false);
      },
      () => {
        setEvent(null);
        setLoading(false);
      },
    );

    return unsubscribe;
  }, [id]);

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.loadingText}>Caricamento evento...</Text>
      </View>
    );
  }

  if (!event) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="alert-circle" size={50} color={colors.secondary} />

        <Text style={styles.emptyTitle}>Evento non trovato</Text>

        <Text style={styles.emptyText}>
          L’evento potrebbe essere stato eliminato o non essere più disponibile.
        </Text>

        <TouchableOpacity
          style={styles.backFullButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backFullButtonText}>Torna indietro</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const packs = Array.isArray(event.packs) ? event.packs : [];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
        <Ionicons name="chevron-back" size={24} color={colors.text} />
        <Text style={styles.backText}>Indietro</Text>
      </TouchableOpacity>

      {event.image ? (
        <Image source={{ uri: event.image }} style={styles.image} />
      ) : (
        <View style={styles.imagePlaceholder}>
          <Ionicons name="image" size={48} color={colors.placeholder} />
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.title}>{event.title || "Evento senza titolo"}</Text>

        <View style={styles.infoRow}>
          <Ionicons name="calendar" size={20} color={colors.primary} />
          <Text style={styles.infoText}>
            Dal {event.startDate || "-"} al {event.endDate || "-"}
          </Text>
        </View>

        <View style={styles.infoRow}>
          <Ionicons name="location" size={20} color={colors.primary} />
          <Text style={styles.infoText}>
            {event.location || "Location non inserita"}
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Descrizione</Text>

        <Text style={styles.description}>
          {event.description || "Nessuna descrizione disponibile."}
        </Text>
      </View>

      <View style={styles.packCard}>
        <Text style={styles.sectionTitle}>Pack a persona</Text>

        {packs.length === 0 ? (
          <View style={styles.emptyPackBox}>
            <Text style={styles.emptyPackText}>Nessun pack disponibile.</Text>
          </View>
        ) : (
          packs.map((pack) => (
            <View key={pack.id} style={styles.packRow}>
              <View style={styles.packLetterBox}>
                <Text style={styles.packLetter}>{pack.letter || "-"}</Text>
              </View>

              <View style={styles.packInfo}>
                <Text style={styles.packName}>
                  Pack {pack.letter || "-"} • €{pack.price || "0"}
                </Text>

                <Text style={styles.packDescription}>
                  {pack.description || "Nessuna descrizione."}
                </Text>
              </View>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const createStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  content: {
    paddingTop: 52,
    paddingHorizontal: 22,
    paddingBottom: 120,
  },

  centerContainer: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },

  loadingText: {
    color: colors.secondary,
    fontSize: 16,
    fontWeight: "800",
  },

  backButton: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 22,
  },

  backText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "800",
    marginLeft: 6,
  },

  image: {
    width: "100%",
    height: 260,
    borderRadius: 28,
    marginBottom: 22,
    backgroundColor: colors.card,
  },

  imagePlaceholder: {
    width: "100%",
    height: 260,
    borderRadius: 28,
    marginBottom: 22,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },

  card: {
    backgroundColor: colors.card,
    borderRadius: 28,
    padding: 20,
    marginBottom: 20,
  },

  title: {
    color: colors.text,
    fontSize: 32,
    fontWeight: "900",
    marginBottom: 18,
  },

  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },

  infoText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "800",
    marginLeft: 10,
    flex: 1,
    lineHeight: 21,
  },

  sectionTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "900",
    marginBottom: 14,
  },

  description: {
    color: colors.secondary,
    fontSize: 15,
    lineHeight: 23,
  },

  packCard: {
    backgroundColor: colors.card,
    borderRadius: 28,
    padding: 20,
  },

  packRow: {
    backgroundColor: colors.background,
    borderRadius: 20,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: "row",
    alignItems: "center",
  },

  packLetterBox: {
    width: 48,
    height: 48,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },

  packLetter: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "900",
  },

  packInfo: {
    flex: 1,
  },

  packName: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "900",
    marginBottom: 4,
  },

  packDescription: {
    color: colors.secondary,
    fontSize: 14,
    lineHeight: 20,
  },

  emptyPackBox: {
    backgroundColor: colors.background,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },

  emptyPackText: {
    color: colors.secondary,
    fontSize: 15,
    fontWeight: "800",
  },

  emptyTitle: {
    color: colors.text,
    fontSize: 24,
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
    marginBottom: 22,
  },

  backFullButton: {
    backgroundColor: colors.primary,
    borderRadius: 20,
    paddingVertical: 15,
    paddingHorizontal: 24,
  },

  backFullButtonText: {
    color: colors.onPrimary,
    fontSize: 15,
    fontWeight: "900",
  },
});
