import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { collection, onSnapshot } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, useWindowDimensions, View } from "react-native";

import { useTheme } from "../../contexts/ThemeContext";
import { db } from "../../firebase";

type TeacherUser = { id: string; username?: string; firstName?: string; lastName?: string; danceSchool?: string; profileImage?: string; isOnline?: boolean; lastSeen?: any };
type PresenceFilter = "all" | "online" | "offline";

const getLastSeenDate = (lastSeen: any) => {
  if (!lastSeen) return null;
  if (typeof lastSeen?.toDate === "function") return lastSeen.toDate();
  if (typeof lastSeen?.toMillis === "function") return new Date(lastSeen.toMillis());
  const date = new Date(lastSeen);
  return Number.isNaN(date.getTime()) ? null : date;
};
const isReallyOnline = (teacher: TeacherUser) => Boolean(teacher.isOnline && getLastSeenDate(teacher.lastSeen) && Date.now() - getLastSeenDate(teacher.lastSeen)!.getTime() < 90 * 1000);
const fullName = (teacher: TeacherUser) => `${teacher.firstName || ""} ${teacher.lastName || ""}`.trim() || teacher.username || "Maestro";
const formatLastSeen = (lastSeen: any) => {
  const date = getLastSeenDate(lastSeen);
  if (!date) return "Ultimo accesso non disponibile";
  const now = new Date();
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
  const time = date.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
  if (date.toDateString() === now.toDateString()) return `Ultimo accesso oggi alle ${time}`;
  if (date.toDateString() === yesterday.toDateString()) return `Ultimo accesso ieri alle ${time}`;
  return `Ultimo accesso ${date.toLocaleDateString("it-IT")} alle ${time}`;
};

export default function AdminTeacherStatusScreen() {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const isMobile = width < 700;
  const [teachers, setTeachers] = useState<TeacherUser[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<PresenceFilter>("all");
  const [brokenTeacherImages, setBrokenTeacherImages] = useState<Record<string, string>>({});

  useEffect(() => onSnapshot(collection(db, "teachers"), (snapshot) => setTeachers(snapshot.docs.map((item) => ({ id: item.id, ...(item.data() as Omit<TeacherUser, "id">) }))), () => setTeachers([])), []);

  const onlineCount = useMemo(() => teachers.filter(isReallyOnline).length, [teachers]);
  const filteredTeachers = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return [...teachers].filter((teacher) => {
      const online = isReallyOnline(teacher);
      if (filter === "online" && !online) return false;
      if (filter === "offline" && online) return false;
      return !needle || [teacher.firstName, teacher.lastName, teacher.username, teacher.danceSchool].filter(Boolean).join(" ").toLowerCase().includes(needle);
    }).sort((a, b) => {
      const presenceOrder = Number(isReallyOnline(b)) - Number(isReallyOnline(a));
      if (presenceOrder) return presenceOrder;
      const activityOrder = (getLastSeenDate(b.lastSeen)?.getTime() || 0) - (getLastSeenDate(a.lastSeen)?.getTime() || 0);
      return activityOrder || fullName(a).localeCompare(fullName(b));
    });
  }, [teachers, search, filter]);

  const filters: { value: PresenceFilter; label: string; count: number }[] = [
    { value: "all", label: "Tutti", count: teachers.length },
    { value: "online", label: "Online", count: onlineCount },
    { value: "offline", label: "Offline", count: teachers.length - onlineCount },
  ];

  return <ScrollView style={[styles.screen, { backgroundColor: colors.background }]} contentContainerStyle={[styles.content, isMobile && styles.contentMobile]}>
    <View style={[styles.header, isMobile && styles.headerMobile]}><View style={styles.headerCopy}><Text style={[styles.eyebrow, { color: colors.primary }]}>PRESENZA IN TEMPO REALE</Text><Text style={[styles.title, isMobile && styles.titleMobile, { color: colors.text }]}>Stato maestri</Text><Text style={[styles.subtitle, { color: colors.secondary }]}>Consulta tutti i maestri e il loro ultimo accesso.</Text></View><TouchableOpacity style={[styles.backButton, { borderColor: colors.border, backgroundColor: colors.card }]} onPress={() => router.push("/admin-web")}><Ionicons name="grid-outline" size={17} color={colors.primary} /><Text style={[styles.backText, { color: colors.text }]}>Dashboard</Text></TouchableOpacity></View>
    <View style={[styles.toolbar, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[styles.searchBox, isMobile && styles.searchMobile, { backgroundColor: colors.background, borderColor: colors.border }]}><Ionicons name="search-outline" size={19} color={colors.secondary} /><TextInput value={search} onChangeText={setSearch} placeholder="Cerca nome, cognome, username o scuola" placeholderTextColor={colors.secondary} style={[styles.searchInput, { color: colors.text }]} /></View>
      <View style={[styles.filters, isMobile && styles.filtersMobile]}>{filters.map((item) => { const active = filter === item.value; return <TouchableOpacity key={item.value} style={[styles.filter, { backgroundColor: active ? colors.primary : colors.background, borderColor: active ? colors.primary : colors.border }]} onPress={() => setFilter(item.value)}><Text style={[styles.filterText, { color: active ? colors.onPrimary : colors.secondary }]}>{item.label} · {item.count}</Text></TouchableOpacity>; })}</View>
    </View>
    <View style={styles.resultsHeader}><Text style={[styles.resultsTitle, { color: colors.text }]}>{filteredTeachers.length} maestri</Text><Text style={[styles.threshold, { color: colors.secondary }]}>Online: attività negli ultimi 90 secondi</Text></View>
    <View style={styles.grid}>{filteredTeachers.map((teacher) => {
      const online = isReallyOnline(teacher);
      const profileImage = teacher.profileImage?.trim() || null;
      const showProfileImage = Boolean(profileImage && brokenTeacherImages[teacher.id] !== profileImage);

      return <View key={teacher.id} style={[styles.teacherCard, isMobile && styles.teacherCardMobile, { backgroundColor: colors.card, borderColor: colors.border }]}><View style={styles.teacherTop}>{showProfileImage ? <Image key={`${teacher.id}-${profileImage}`} source={{ uri: profileImage! }} style={styles.avatar} resizeMode="cover" onError={() => setBrokenTeacherImages((current) => ({ ...current, [teacher.id]: profileImage! }))} /> : <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: `${colors.primary}14` }]}><Ionicons name="person-outline" size={22} color={colors.primary} /></View>}<View style={styles.teacherCopy}><Text numberOfLines={1} style={[styles.name, { color: colors.text }]}>{fullName(teacher)}</Text><Text numberOfLines={1} style={[styles.username, { color: colors.secondary }]}>@{teacher.username || "-"}</Text></View><View style={[styles.badge, { backgroundColor: `${online ? colors.success : colors.danger}14` }]}><View style={[styles.dot, { backgroundColor: online ? colors.success : colors.danger }]} /><Text style={[styles.badgeText, { color: online ? colors.success : colors.danger }]}>{online ? "Online" : "Offline"}</Text></View></View><View style={[styles.info, { borderTopColor: colors.border }]}><View style={styles.infoRow}><Ionicons name="school-outline" size={16} color={colors.primary} /><Text numberOfLines={2} style={[styles.infoText, { color: colors.text }]}>{teacher.danceSchool || "Scuola non inserita"}</Text></View><View style={styles.infoRow}><Ionicons name="time-outline" size={16} color={colors.secondary} /><Text style={[styles.lastSeen, { color: colors.secondary }]}>{formatLastSeen(teacher.lastSeen)}</Text></View></View></View>;
    })}</View>
    {!filteredTeachers.length ? <View style={[styles.empty, { backgroundColor: colors.card, borderColor: colors.border }]}><Ionicons name="people-outline" size={34} color={colors.secondary} /><Text style={[styles.emptyTitle, { color: colors.text }]}>Nessun maestro trovato</Text><Text style={[styles.emptyText, { color: colors.secondary }]}>Modifica ricerca o filtro per vedere altri risultati.</Text></View> : null}
  </ScrollView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 }, content: { width: "100%", maxWidth: 1240, alignSelf: "center", padding: 28, paddingBottom: 70 }, contentMobile: { padding: 14, paddingBottom: 50 }, header: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 16, marginBottom: 20 }, headerMobile: { alignItems: "flex-start", flexDirection: "column" }, headerCopy: { flex: 1, minWidth: 0 }, eyebrow: { fontSize: 9, fontWeight: "900", letterSpacing: 1.1 }, title: { fontSize: 32, lineHeight: 38, fontWeight: "900", marginTop: 5 }, titleMobile: { fontSize: 27, lineHeight: 32 }, subtitle: { fontSize: 11, lineHeight: 16, fontWeight: "700", marginTop: 4 }, backButton: { minHeight: 43, borderWidth: 1, borderRadius: 13, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 7 }, backText: { fontSize: 10, fontWeight: "900" }, toolbar: { borderWidth: 1, borderRadius: 18, padding: 13, marginBottom: 18, flexDirection: "row", alignItems: "center", gap: 12, flexWrap: "wrap" }, searchBox: { flex: 1, minWidth: 300, minHeight: 46, borderWidth: 1, borderRadius: 13, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 8 }, searchMobile: { flexBasis: "100%", minWidth: 0 }, searchInput: { flex: 1, minWidth: 0, fontSize: 11, fontWeight: "700", outlineStyle: "none" as any }, filters: { flexDirection: "row", gap: 7 }, filtersMobile: { width: "100%", flexWrap: "wrap" }, filter: { minHeight: 40, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, alignItems: "center", justifyContent: "center" }, filterText: { fontSize: 10, fontWeight: "900" }, resultsHeader: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 11 }, resultsTitle: { fontSize: 17, fontWeight: "900" }, threshold: { fontSize: 9, fontWeight: "700" }, grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 }, teacherCard: { flexBasis: "48.8%", flexGrow: 1, minWidth: 310, borderWidth: 1, borderRadius: 18, padding: 14 }, teacherCardMobile: { flexBasis: "100%", minWidth: 0 }, teacherTop: { flexDirection: "row", alignItems: "center", minWidth: 0 }, avatar: { width: 44, height: 44, borderRadius: 22, marginRight: 10 }, avatarFallback: { alignItems: "center", justifyContent: "center" }, teacherCopy: { flex: 1, minWidth: 0 }, name: { fontSize: 14, fontWeight: "900" }, username: { fontSize: 10, fontWeight: "800", marginTop: 3 }, badge: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 6, flexDirection: "row", alignItems: "center", gap: 5, marginLeft: 8 }, dot: { width: 7, height: 7, borderRadius: 4 }, badgeText: { fontSize: 9, fontWeight: "900" }, info: { borderTopWidth: 1, marginTop: 12, paddingTop: 11, gap: 8 }, infoRow: { flexDirection: "row", alignItems: "center", gap: 7 }, infoText: { flex: 1, fontSize: 10, fontWeight: "800" }, lastSeen: { flex: 1, fontSize: 9, fontWeight: "700" }, empty: { borderWidth: 1, borderRadius: 18, minHeight: 180, marginTop: 12, alignItems: "center", justifyContent: "center", padding: 22 }, emptyTitle: { fontSize: 16, fontWeight: "900", marginTop: 9 }, emptyText: { fontSize: 10, fontWeight: "700", marginTop: 4, textAlign: "center" },
});
