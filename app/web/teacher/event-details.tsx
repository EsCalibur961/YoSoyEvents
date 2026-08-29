import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { collection, doc, onSnapshot } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { Linking, ScrollView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from "react-native";

import { useTheme } from "../../../contexts/ThemeContext";
import { db } from "../../../firebase";

type EventPack = { id: string; letter?: string; price?: string; description?: string; supplementDoppia?: string; supplementTripla?: string; supplementQuadrupla?: string };
type EventItem = { id: string; title?: string; description?: string; startDate?: string; endDate?: string; location?: string; image?: string; packs?: EventPack[]; allowStayDateSelection?: boolean };
type ArtistItem = { id: string; name?: string; instagram?: string; image?: string; isVisible?: boolean };

const parseDate = (value?: string) => {
  if (!value) return null;
  const [day, month, year] = value.split("/");
  const result = new Date(Number(year), Number(month) - 1, Number(day));
  return Number.isNaN(result.getTime()) ? null : result;
};

const countdownText = (startDate?: string) => {
  const start = parseDate(startDate);
  if (!start) return "Data da definire";
  const days = Math.ceil((start.getTime() - Date.now()) / 86400000);
  if (days > 1) return `Mancano ${days} giorni`;
  if (days === 1) return "Manca 1 giorno";
  if (days === 0) return "Inizia oggi";
  return "Evento iniziato";
};

export default function TeacherEventDetailsScreen() {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const isMobile = width < 700;
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const eventId = Array.isArray(params.id) ? params.id[0] : params.id;
  const [event, setEvent] = useState<EventItem | null>(null);
  const [artists, setArtists] = useState<ArtistItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!eventId) { setLoading(false); return; }
    const unsubscribeEvent = onSnapshot(doc(db, "events", eventId), (snapshot) => {
      setEvent(snapshot.exists() ? { id: snapshot.id, ...(snapshot.data() as Omit<EventItem, "id">) } : null);
      setLoading(false);
    }, () => setLoading(false));
    const unsubscribeArtists = onSnapshot(collection(db, "artists"), (snapshot) => {
      setArtists(snapshot.docs.map((item) => ({ id: item.id, ...(item.data() as Omit<ArtistItem, "id">) })));
    });
    return () => { unsubscribeEvent(); unsubscribeArtists(); };
  }, [eventId]);

  const visibleArtists = useMemo(() => artists.filter((artist) => artist.isVisible !== false).sort((a, b) => (a.name || "").localeCompare(b.name || "")), [artists]);
  const openInstagram = async (instagram?: string) => {
    if (!instagram?.trim()) return;
    const clean = instagram.replace("@", "").trim();
    await Linking.openURL(clean.startsWith("http") ? clean : `https://instagram.com/${clean}`);
  };

  if (loading || !event) return <View style={[styles.center, { backgroundColor: colors.background }]}><Ionicons name={loading ? "hourglass-outline" : "calendar-outline"} size={34} color={colors.primary} /><Text style={[styles.centerText, { color: colors.text }]}>{loading ? "Caricamento evento..." : "Evento non disponibile"}</Text><TouchableOpacity onPress={() => router.replace("/web/teacher")}><Text style={[styles.backLink, { color: colors.primary }]}>Torna alla Home Maestro</Text></TouchableOpacity></View>;

  return <ScrollView style={[styles.screen, { backgroundColor: colors.background }]} contentContainerStyle={[styles.content, isMobile && styles.contentMobile]}>
    <View style={styles.navigation}><TouchableOpacity style={[styles.navButton, { borderColor: colors.border, backgroundColor: colors.card }]} onPress={() => router.back()}><Ionicons name="arrow-back-outline" size={18} color={colors.primary} /><Text style={[styles.navText, { color: colors.text }]}>Indietro</Text></TouchableOpacity><TouchableOpacity style={[styles.navButton, { borderColor: colors.border, backgroundColor: colors.card }]} onPress={() => router.replace("/web/teacher")}><Ionicons name="home-outline" size={18} color={colors.primary} /><Text style={[styles.navText, { color: colors.text }]}>Home Maestro</Text></TouchableOpacity></View>
    <View style={[styles.hero, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {event.image ? <Image source={{ uri: event.image }} style={[styles.heroImage, isMobile && styles.heroImageMobile]} contentFit="cover" /> : <View style={[styles.heroImage, styles.placeholder, { backgroundColor: `${colors.primary}12` }]}><Ionicons name="image-outline" size={42} color={colors.primary} /></View>}
      <View style={[styles.heroBody, isMobile && styles.heroBodyMobile]}><View style={[styles.countdown, { backgroundColor: `${colors.primary}16` }]}><Ionicons name="time-outline" size={16} color={colors.primary} /><Text style={[styles.countdownText, { color: colors.primary }]}>{countdownText(event.startDate)}</Text></View><Text style={[styles.title, isMobile && styles.titleMobile, { color: colors.text }]}>{event.title || "Evento"}</Text><View style={[styles.metaGrid, isMobile && styles.stack]}><Meta icon="calendar-outline" label="Data inizio" value={event.startDate || "-"} colors={colors} /><Meta icon="calendar-number-outline" label="Data fine" value={event.endDate || "-"} colors={colors} /><Meta icon="location-outline" label="Location" value={event.location || "Non inserita"} colors={colors} /></View>{event.allowStayDateSelection ? <View style={[styles.stayNotice, { backgroundColor: `${colors.primary}10` }]}><Ionicons name="calendar-outline" size={17} color={colors.primary} /><Text style={[styles.stayNoticeText, { color: colors.primary }]}>Selezione dei giorni di permanenza disponibile</Text></View> : null}<Text style={[styles.description, { color: colors.secondary }]}>{event.description || "Nessuna descrizione disponibile."}</Text></View>
    </View>
    <Text style={[styles.sectionTitle, { color: colors.text }]}>Pack disponibili</Text>
    <View style={styles.grid}>{event.packs?.length ? event.packs.map((pack) => <View key={pack.id} style={[styles.packCard, isMobile && styles.fullCard, { backgroundColor: colors.card, borderColor: colors.border }]}><View style={styles.packHeader}><Text style={[styles.packName, { color: colors.text }]}>Pack {pack.letter || "-"}</Text><Text style={[styles.price, { color: colors.success }]}>€{pack.price || "0"}</Text></View><Text style={[styles.packDescription, { color: colors.secondary }]}>{pack.description || "Nessuna descrizione."}</Text><View style={[styles.supplements, { borderTopColor: colors.border }]}><Text style={[styles.supplementTitle, { color: colors.text }]}>Supplementi camera</Text><Text style={[styles.supplementText, { color: colors.secondary }]}>Doppia €{pack.supplementDoppia || "0"}  •  Tripla €{pack.supplementTripla || "0"}  •  Quadrupla €{pack.supplementQuadrupla || "0"}</Text></View></View>) : <Text style={[styles.empty, { color: colors.secondary }]}>Nessun Pack disponibile.</Text>}</View>
    <Text style={[styles.sectionTitle, { color: colors.text }]}>Artisti presenti</Text>
    <View style={styles.grid}>{visibleArtists.length ? visibleArtists.map((artist) => <View key={artist.id} style={[styles.artistCard, isMobile && styles.artistCardMobile, { backgroundColor: colors.card, borderColor: colors.border }]}>{artist.image ? <Image source={{ uri: artist.image }} style={styles.artistImage} contentFit="cover" /> : <View style={[styles.artistImage, styles.placeholder, { backgroundColor: `${colors.primary}12` }]}><Ionicons name="person-outline" size={28} color={colors.primary} /></View>}<Text style={[styles.artistName, { color: colors.text }]}>{artist.name || "Artista"}</Text>{artist.instagram ? <TouchableOpacity style={styles.instagram} onPress={() => openInstagram(artist.instagram)}><Ionicons name="logo-instagram" size={16} color={colors.primary} /><Text style={[styles.instagramText, { color: colors.primary }]}>{artist.instagram}</Text></TouchableOpacity> : null}</View>) : <Text style={[styles.empty, { color: colors.secondary }]}>Nessun artista visibile.</Text>}</View>
  </ScrollView>;
}

function Meta({ icon, label, value, colors }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string; colors: any }) { return <View style={[styles.meta, { backgroundColor: colors.background, borderColor: colors.border }]}><Ionicons name={icon} size={19} color={colors.primary} /><View><Text style={[styles.metaLabel, { color: colors.secondary }]}>{label}</Text><Text style={[styles.metaValue, { color: colors.text }]}>{value}</Text></View></View>; }

const styles = StyleSheet.create({
  screen: { flex: 1 }, content: { width: "100%", maxWidth: 1180, alignSelf: "center", padding: 28, paddingBottom: 70 }, contentMobile: { padding: 14, paddingBottom: 50 }, center: { flex: 1, minHeight: "100vh" as any, alignItems: "center", justifyContent: "center", gap: 12 }, centerText: { fontSize: 18, fontWeight: "900" }, backLink: { fontSize: 12, fontWeight: "900" }, navigation: { flexDirection: "row", flexWrap: "wrap", gap: 9, marginBottom: 14 }, navButton: { minHeight: 42, borderWidth: 1, borderRadius: 13, paddingHorizontal: 13, flexDirection: "row", alignItems: "center", gap: 7 }, navText: { fontSize: 11, fontWeight: "900" }, hero: { borderWidth: 1, borderRadius: 24, overflow: "hidden", marginBottom: 28 }, heroImage: { width: "100%", height: 350 }, heroImageMobile: { height: 220 }, placeholder: { alignItems: "center", justifyContent: "center" }, heroBody: { padding: 24 }, heroBodyMobile: { padding: 16 }, countdown: { alignSelf: "flex-start", borderRadius: 999, paddingHorizontal: 11, paddingVertical: 7, flexDirection: "row", alignItems: "center", gap: 6 }, countdownText: { fontSize: 10, fontWeight: "900" }, title: { fontSize: 34, lineHeight: 40, fontWeight: "900", marginTop: 13 }, titleMobile: { fontSize: 26, lineHeight: 31 }, metaGrid: { flexDirection: "row", gap: 10, marginTop: 16 }, stack: { flexDirection: "column" }, meta: { flex: 1, minWidth: 0, borderWidth: 1, borderRadius: 14, padding: 11, flexDirection: "row", alignItems: "center", gap: 9 }, metaLabel: { fontSize: 9, fontWeight: "800" }, metaValue: { fontSize: 11, fontWeight: "900", marginTop: 2 }, stayNotice: { alignSelf: "flex-start", borderRadius: 12, paddingHorizontal: 11, paddingVertical: 8, marginTop: 12, flexDirection: "row", alignItems: "center", gap: 7 }, stayNoticeText: { fontSize: 10, fontWeight: "900" }, description: { fontSize: 13, lineHeight: 21, fontWeight: "600", marginTop: 18 }, sectionTitle: { fontSize: 22, fontWeight: "900", marginBottom: 12 }, grid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 28 }, packCard: { flexBasis: "49%", flexGrow: 1, minWidth: 280, borderWidth: 1, borderRadius: 18, padding: 16 }, fullCard: { flexBasis: "100%", minWidth: 0 }, packHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 }, packName: { fontSize: 16, fontWeight: "900" }, price: { fontSize: 18, fontWeight: "900" }, packDescription: { fontSize: 11, lineHeight: 17, fontWeight: "700", marginTop: 10 }, supplements: { borderTopWidth: 1, marginTop: 13, paddingTop: 11 }, supplementTitle: { fontSize: 10, fontWeight: "900", marginBottom: 5 }, supplementText: { fontSize: 10, lineHeight: 16, fontWeight: "700" }, artistCard: { width: 180, borderWidth: 1, borderRadius: 18, padding: 12 }, artistCardMobile: { width: "47.8%", flexGrow: 1, minWidth: 145 }, artistImage: { width: "100%", aspectRatio: 1, borderRadius: 14 }, artistName: { fontSize: 13, fontWeight: "900", marginTop: 10 }, instagram: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 7 }, instagramText: { flex: 1, fontSize: 10, fontWeight: "800" }, empty: { fontSize: 12, fontWeight: "700" },
});
