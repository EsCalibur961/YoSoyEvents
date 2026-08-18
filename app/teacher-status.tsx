import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { collection, onSnapshot } from "firebase/firestore";
import { useCallback, useMemo, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useTheme } from "../contexts/ThemeContext";
import { db } from "../firebase";

type TeacherUser = {
  id: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  danceSchool?: string;
  isOnline?: boolean;
  lastSeen?: any;
};

type PresenceFilter = "all" | "online" | "offline";

export default function TeacherStatusScreen() {
  const { colors, isDark } = useTheme();
  const styles = createStyles(colors, isDark);

  const [teachers, setTeachers] = useState<TeacherUser[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<PresenceFilter>("all");

  useFocusEffect(
    useCallback(() => {
      const unsubscribe = onSnapshot(
        collection(db, "teachers"),
        (snapshot) => {
          const data: TeacherUser[] = snapshot.docs.map((item) => ({
            id: item.id,
            ...(item.data() as Omit<TeacherUser, "id">),
          }));

          setTeachers(data);
        },
        (error) => {
          console.log("Lettura stato maestri non riuscita:", error);
          setTeachers([]);
        },
      );

      return unsubscribe;
    }, []),
  );

  const getTeacherFullName = (teacher: TeacherUser) => {
    const fullName =
      `${teacher.firstName || ""} ${teacher.lastName || ""}`.trim();

    return fullName || teacher.username || "Maestro";
  };

  const getLastSeenDate = (lastSeen: any) => {
    if (!lastSeen) return null;

    if (typeof lastSeen?.toDate === "function") {
      return lastSeen.toDate();
    }

    if (typeof lastSeen?.toMillis === "function") {
      return new Date(lastSeen.toMillis());
    }

    const date = new Date(lastSeen);

    return Number.isNaN(date.getTime()) ? null : date;
  };

  const isTeacherReallyOnline = (teacher: TeacherUser) => {
    if (!teacher.isOnline) return false;

    const lastSeen = getLastSeenDate(teacher.lastSeen);
    if (!lastSeen) return false;

    return Date.now() - lastSeen.getTime() < 90 * 1000;
  };

  const formatLastSeen = (lastSeen: any) => {
    const date = getLastSeenDate(lastSeen);

    if (!date) return "Ultimo accesso non disponibile";

    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);

    const time = date.toLocaleTimeString("it-IT", {
      hour: "2-digit",
      minute: "2-digit",
    });

    if (isToday) {
      return `Ultimo accesso oggi alle ${time}`;
    }

    if (date.toDateString() === yesterday.toDateString()) {
      return `Ultimo accesso ieri alle ${time}`;
    }

    return `Ultimo accesso ${date.toLocaleDateString("it-IT")} alle ${time}`;
  };

  const onlineCount = useMemo(
    () => teachers.filter((teacher) => isTeacherReallyOnline(teacher)).length,
    [teachers],
  );

  const offlineCount = teachers.length - onlineCount;

  const visibleTeachers = useMemo(() => {
    const query = search.trim().toLowerCase();

    return [...teachers]
      .filter((teacher) => {
        const online = isTeacherReallyOnline(teacher);

        if (filter === "online" && !online) return false;
        if (filter === "offline" && online) return false;

        if (!query) return true;

        const haystack = [
          teacher.firstName,
          teacher.lastName,
          teacher.username,
          teacher.danceSchool,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return haystack.includes(query);
      })
      .sort((a, b) => {
        const aOnline = isTeacherReallyOnline(a);
        const bOnline = isTeacherReallyOnline(b);

        if (aOnline !== bOnline) {
          return aOnline ? -1 : 1;
        }

        const aTime = getLastSeenDate(a.lastSeen)?.getTime() || 0;
        const bTime = getLastSeenDate(b.lastSeen)?.getTime() || 0;

        if (aTime !== bTime) {
          return bTime - aTime;
        }

        return getTeacherFullName(a).localeCompare(getTeacherFullName(b));
      });
  }, [teachers, search, filter]);

  const FilterButton = ({
    value,
    label,
    count,
  }: {
    value: PresenceFilter;
    label: string;
    count: number;
  }) => {
    const active = filter === value;

    return (
      <TouchableOpacity
        style={[
          styles.filterButton,
          {
            backgroundColor: active ? colors.primaryDark : colors.card,
            borderColor: active ? colors.primaryDark : colors.border,
          },
        ]}
        onPress={() => setFilter(value)}
      >
        <Text
          style={[
            styles.filterText,
            { color: active ? colors.onPrimary : colors.text },
          ]}
        >
          {label}
        </Text>

        <View
          style={[
            styles.filterCount,
            {
              backgroundColor: active ? "rgba(255,255,255,0.18)" : colors.cardAlt,
            },
          ]}
        >
          <Text
            style={[
              styles.filterCountText,
              { color: active ? colors.onPrimary : colors.secondary },
            ]}
          >
            {count}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
        <Ionicons name="chevron-back-outline" size={23} color={colors.text} />
        <Text style={styles.backText}>Indietro</Text>
      </TouchableOpacity>

      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <Ionicons name="pulse-outline" size={25} color={colors.primary} />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Stato maestri</Text>
          <Text style={styles.subtitle}>
            Presenza live e ultimo accesso di tutti i maestri.
          </Text>
        </View>
      </View>

      <View style={styles.counterRow}>
        <View
          style={[
            styles.counterCard,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <View style={[styles.counterDot, { backgroundColor: colors.success }]} />
          <View>
            <Text style={styles.counterValue}>{onlineCount}</Text>
            <Text style={styles.counterLabel}>Online</Text>
          </View>
        </View>

        <View
          style={[
            styles.counterCard,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <View style={[styles.counterDot, { backgroundColor: colors.danger }]} />
          <View>
            <Text style={styles.counterValue}>{offlineCount}</Text>
            <Text style={styles.counterLabel}>Offline</Text>
          </View>
        </View>
      </View>

      <View
        style={[
          styles.searchBox,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <Ionicons name="search-outline" size={20} color={colors.secondary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Cerca maestro, username o scuola"
          placeholderTextColor={colors.muted}
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
        />
        {search ? (
          <TouchableOpacity onPress={() => setSearch("")}>
            <Ionicons name="close-circle" size={20} color={colors.muted} />
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={styles.filters}>
        <FilterButton value="all" label="Tutti" count={teachers.length} />
        <FilterButton value="online" label="Online" count={onlineCount} />
        <FilterButton value="offline" label="Offline" count={offlineCount} />
      </View>

      {visibleTeachers.length === 0 ? (
        <View
          style={[
            styles.emptyCard,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Ionicons name="people-outline" size={42} color={colors.muted} />
          <Text style={styles.emptyTitle}>Nessun maestro trovato</Text>
          <Text style={styles.emptyText}>
            Prova a cambiare filtro o termine di ricerca.
          </Text>
        </View>
      ) : (
        visibleTeachers.map((teacher) => {
          const online = isTeacherReallyOnline(teacher);

          return (
            <View
              key={teacher.id}
              style={[
                styles.teacherCard,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <View style={styles.teacherTop}>
                <View
                  style={[
                    styles.avatar,
                    {
                      backgroundColor: online
                        ? `${colors.success}18`
                        : colors.cardAlt,
                    },
                  ]}
                >
                  <Ionicons
                    name="person-outline"
                    size={22}
                    color={online ? colors.success : colors.secondary}
                  />
                </View>

                <View style={styles.teacherInfo}>
                  <Text style={styles.teacherName}>
                    {getTeacherFullName(teacher)}
                  </Text>

                  <Text style={styles.teacherMeta}>
                    @{teacher.username || "-"}
                    {teacher.danceSchool
                      ? ` • ${teacher.danceSchool}`
                      : " • Scuola non inserita"}
                  </Text>
                </View>

                <View
                  style={[
                    styles.statusPill,
                    {
                      backgroundColor: online
                        ? `${colors.success}18`
                        : `${colors.danger}14`,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.statusDot,
                      {
                        backgroundColor: online
                          ? colors.success
                          : colors.danger,
                      },
                    ]}
                  />
                  <Text
                    style={[
                      styles.statusText,
                      {
                        color: online ? colors.success : colors.danger,
                      },
                    ]}
                  >
                    {online ? "Online" : "Offline"}
                  </Text>
                </View>
              </View>

              <View
                style={[
                  styles.lastSeenBox,
                  { backgroundColor: colors.cardAlt },
                ]}
              >
                <Ionicons
                  name="time-outline"
                  size={17}
                  color={online ? colors.success : colors.secondary}
                />
                <Text
                  style={[
                    styles.lastSeenText,
                    {
                      color: online ? colors.success : colors.secondary,
                    },
                  ]}
                >
                  {online ? "Online adesso" : formatLastSeen(teacher.lastSeen)}
                </Text>
              </View>
            </View>
          );
        })
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
      paddingTop: 34,
      paddingHorizontal: 16,
      paddingBottom: 48,
    },

    backButton: {
      flexDirection: "row",
      alignItems: "center",
      alignSelf: "flex-start",
      marginBottom: 22,
    },

    backText: {
      color: colors.text,
      fontSize: 15,
      fontWeight: "800",
      marginLeft: 5,
    },

    header: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 20,
    },

    headerIcon: {
      width: 52,
      height: 52,
      borderRadius: 17,
      backgroundColor: `${colors.primary}12`,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 13,
    },

    title: {
      color: colors.text,
      fontSize: 31,
      fontWeight: "900",
      letterSpacing: -0.7,
    },

    subtitle: {
      color: colors.secondary,
      fontSize: 13,
      lineHeight: 18,
      marginTop: 4,
      fontWeight: "600",
    },

    counterRow: {
      flexDirection: "row",
      gap: 10,
      marginBottom: 14,
    },

    counterCard: {
      flex: 1,
      minHeight: 78,
      borderWidth: 1,
      borderRadius: 20,
      paddingHorizontal: 16,
      flexDirection: "row",
      alignItems: "center",
    },

    counterDot: {
      width: 11,
      height: 11,
      borderRadius: 6,
      marginRight: 12,
    },

    counterValue: {
      color: colors.text,
      fontSize: 22,
      fontWeight: "900",
    },

    counterLabel: {
      color: colors.secondary,
      fontSize: 12,
      fontWeight: "800",
      marginTop: 1,
    },

    searchBox: {
      height: 54,
      borderRadius: 18,
      borderWidth: 1,
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 14,
      marginBottom: 12,
    },

    searchInput: {
      flex: 1,
      color: colors.text,
      fontSize: 14,
      fontWeight: "700",
      marginLeft: 9,
      height: "100%",
    },

    filters: {
      flexDirection: "row",
      gap: 8,
      marginBottom: 16,
    },

    filterButton: {
      flex: 1,
      height: 44,
      borderRadius: 15,
      borderWidth: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 9,
    },

    filterText: {
      fontSize: 12,
      fontWeight: "900",
    },

    filterCount: {
      minWidth: 22,
      height: 22,
      borderRadius: 11,
      alignItems: "center",
      justifyContent: "center",
      marginLeft: 6,
      paddingHorizontal: 5,
    },

    filterCountText: {
      fontSize: 10,
      fontWeight: "900",
    },

    teacherCard: {
      borderWidth: 1,
      borderRadius: 22,
      padding: 14,
      marginBottom: 11,
      shadowColor: "#000",
      shadowOpacity: isDark ? 0.12 : 0.04,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 5 },
      elevation: 2,
    },

    teacherTop: {
      flexDirection: "row",
      alignItems: "center",
    },

    avatar: {
      width: 46,
      height: 46,
      borderRadius: 15,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 11,
    },

    teacherInfo: {
      flex: 1,
      paddingRight: 8,
    },

    teacherName: {
      color: colors.text,
      fontSize: 15,
      fontWeight: "900",
    },

    teacherMeta: {
      color: colors.secondary,
      fontSize: 11,
      lineHeight: 16,
      marginTop: 3,
      fontWeight: "700",
    },

    statusPill: {
      borderRadius: 999,
      paddingVertical: 7,
      paddingHorizontal: 9,
      flexDirection: "row",
      alignItems: "center",
    },

    statusDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      marginRight: 5,
    },

    statusText: {
      fontSize: 10,
      fontWeight: "900",
    },

    lastSeenBox: {
      minHeight: 40,
      borderRadius: 14,
      marginTop: 12,
      paddingHorizontal: 12,
      flexDirection: "row",
      alignItems: "center",
    },

    lastSeenText: {
      fontSize: 12,
      fontWeight: "800",
      marginLeft: 7,
    },

    emptyCard: {
      borderWidth: 1,
      borderRadius: 22,
      padding: 28,
      alignItems: "center",
      marginTop: 8,
    },

    emptyTitle: {
      color: colors.text,
      fontSize: 18,
      fontWeight: "900",
      marginTop: 12,
    },

    emptyText: {
      color: colors.secondary,
      fontSize: 13,
      textAlign: "center",
      lineHeight: 19,
      marginTop: 5,
    },
  });
