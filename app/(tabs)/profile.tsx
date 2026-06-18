import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useFocusEffect } from "expo-router";
import { collection, doc, onSnapshot } from "firebase/firestore";
import { useCallback, useMemo, useState } from "react";
import {
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { useTheme } from "../../contexts/ThemeContext";
import { db } from "../../firebase";

type TeacherUser = {
  id: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  danceSchool?: string;
  profileImage?: string;
};

type AdminProfile = {
  name?: string;
  image?: string;
};

type AppNotification = {
  id: string;
  type?: "event" | "room" | "system";
  targetRole?: "admin" | "teacher";
  targetUsername?: string;
};

type RoomChangeRequest = {
  id: string;
  status?: "pending" | "approved" | "rejected";
};

type NotificationRead = {
  id: string;
  notificationId?: string;
  username?: string;
  read?: boolean;
};

export default function ProfileScreen() {
  const { colors, isDark } = useTheme();
  const styles = createStyles(colors, isDark);
  const [role, setRole] = useState<string | null>(null);
  const [teacherUsername, setTeacherUsername] = useState<string | null>(null);

  const [adminProfile, setAdminProfile] = useState<AdminProfile>({
    name: "YoSoyEvents",
    image: "",
  });

  const [teachers, setTeachers] = useState<TeacherUser[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [roomRequests, setRoomRequests] = useState<RoomChangeRequest[]>([]);
  const [reads, setReads] = useState<NotificationRead[]>([]);

  useFocusEffect(
    useCallback(() => {
      loadLocalUser();

      let unsubAdmin: (() => void) | null = null;
      let unsubTeachers: (() => void) | null = null;
      let unsubNotifications: (() => void) | null = null;
      let unsubRoomRequests: (() => void) | null = null;
      let unsubReads: (() => void) | null = null;

      try {
        unsubAdmin = onSnapshot(
          doc(db, "settings", "adminProfile"),
          (snapshot) => {
            if (snapshot.exists()) {
              const data = snapshot.data() as AdminProfile;

              setAdminProfile({
                name: data.name || "YoSoyEvents",
                image: data.image || "",
              });
            }
          },
        );

        unsubTeachers = onSnapshot(collection(db, "teachers"), (snapshot) => {
          const data: TeacherUser[] = snapshot.docs.map((item) => ({
            id: item.id,
            ...(item.data() as Omit<TeacherUser, "id">),
          }));

          setTeachers(data);
        });

        unsubNotifications = onSnapshot(
          collection(db, "notifications"),
          (snapshot) => {
            const data: AppNotification[] = snapshot.docs.map((item) => ({
              id: item.id,
              ...(item.data() as Omit<AppNotification, "id">),
            }));

            setNotifications(data);
          },
        );

        unsubRoomRequests = onSnapshot(
          collection(db, "roomChangeRequests"),
          (snapshot) => {
            const data: RoomChangeRequest[] = snapshot.docs.map((item) => ({
              id: item.id,
              ...(item.data() as Omit<RoomChangeRequest, "id">),
            }));

            setRoomRequests(data);
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
        setTeachers([]);
        setNotifications([]);
        setRoomRequests([]);
        setReads([]);
      }

      return () => {
        if (unsubAdmin) unsubAdmin();
        if (unsubTeachers) unsubTeachers();
        if (unsubNotifications) unsubNotifications();
        if (unsubRoomRequests) unsubRoomRequests();
        if (unsubReads) unsubReads();
      };
    }, []),
  );

  const loadLocalUser = async () => {
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

  const currentTeacher = teachers.find(
    (teacher) => teacher.username === teacherUsername,
  );

  const currentUsername = role === "admin" ? "admin" : teacherUsername || "";

  const generalNotifications = useMemo(() => {
    if (!currentUsername) return [];

    return notifications.filter((notification) => {
      // Le richieste/modifiche camere dell'admin NON entrano nelle notifiche generali.
      // Sono contate solo nel badge "Richieste modifiche camere" qui sotto.
      if (notification.type === "room" && notification.targetRole === "admin") {
        return false;
      }

      if (!notification.targetRole && !notification.targetUsername) return true;
      if (notification.targetUsername) return notification.targetUsername === currentUsername;

      return notification.targetRole === role;
    });
  }, [notifications, currentUsername, role]);

  const unreadCount = useMemo(() => {
    if (!currentUsername) return 0;

    return generalNotifications.filter((notification) => {
      return !reads.some(
        (read) =>
          read.notificationId === notification.id &&
          read.username === currentUsername &&
          read.read,
      );
    }).length;
  }, [generalNotifications, reads, currentUsername]);

  const pendingRoomRequestsCount = useMemo(() => {
    if (role !== "admin") return 0;
    return roomRequests.filter((request) => (request.status || "pending") === "pending").length;
  }, [roomRequests, role]);

  const handleLogout = async () => {
    await AsyncStorage.multiRemove([
      "isLogged",
      "loggedUser",
      "teacherUsername",
      "teacherId",
      "teacherFullName",
      "danceSchool",
    ]);

    router.replace("/login");
  };

  const displayName =
    role === "teacher"
      ? currentTeacher
        ? `${currentTeacher.firstName || ""} ${
            currentTeacher.lastName || ""
          }`.trim() || "Maestro"
        : "Maestro"
      : adminProfile.name || "YoSoyEvents";

  const displayRole = role === "teacher" ? "Maestro" : "Admin";

  const displaySchool =
    role === "teacher"
      ? currentTeacher?.danceSchool || "Scuola non inserita"
      : "YoSoy Events";

  const profileImage =
    role === "teacher"
      ? currentTeacher?.profileImage || ""
      : adminProfile.image || "";

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.notificationWrapper}>
        <TouchableOpacity
          style={[
            styles.notificationButton,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
          onPress={() => router.push("/notifications")}
        >
          <Ionicons
            name="notifications"
            size={24}
            color={isDark ? "#FFFFFF" : colors.primaryDark}
          />
        </TouchableOpacity>

        {unreadCount > 0 ? (
          <View
            style={[
              styles.notificationBadge,
              { backgroundColor: colors.primary },
            ]}
          >
            <Text style={styles.notificationBadgeText}>
              {unreadCount > 99 ? "99+" : unreadCount}
            </Text>
          </View>
        ) : null}
      </View>

      <Text style={[styles.title, { color: colors.text }]}>Profilo</Text>

      <Text style={[styles.subtitle, { color: colors.secondary }]}>
        {role === "teacher"
          ? "Area personale maestro."
          : "Dashboard gestionale YoSoy Events."}
      </Text>

      <View style={[styles.profileCard, { backgroundColor: colors.card }]}>
        <View
          style={[
            styles.avatarContainer,
            { backgroundColor: colors.cardAlt, borderColor: colors.border },
          ]}
        >
          {profileImage ? (
            <Image source={{ uri: profileImage }} style={styles.avatar} />
          ) : role === "admin" ? (
            <Image
              source={require("../../assets/images/icon.png")}
              style={styles.avatar}
              resizeMode="contain"
            />
          ) : (
            <Ionicons name="person" size={58} color={colors.secondary} />
          )}
        </View>

        <Text style={[styles.name, { color: colors.text }]}>{displayName}</Text>

        <Text
          style={[
            styles.role,
            { color: isDark ? "#FFFFFF" : colors.primaryDark },
          ]}
        >
          {displayRole}
        </Text>

        <View style={[styles.schoolBadge, { backgroundColor: colors.cardAlt }]}>
          <Ionicons name="business-outline" size={16} color={colors.text} />
          <Text style={[styles.schoolText, { color: colors.text }]}>
            {displaySchool}
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.editButton, { backgroundColor: colors.primaryDark }]}
          onPress={() => router.push("/edit-profile")}
        >
          <Text style={styles.editButtonText}>
            {role === "teacher" ? "Modifica foto profilo" : "Modifica profilo"}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.menuContainer}>
        {role === "admin" ? (
          <>
            <MenuItem
              icon="calendar"
              title="Gestione eventi"
              onPress={() => router.push("/manage-events")}
            />

            <MenuItem
              icon="people"
              title="Gestione utenti"
              onPress={() => router.push("/manage-users")}
            />
            <MenuItem
              icon="cash"
              title="Pagamenti maestri"
              onPress={() => router.push("/admin-teacher-payments")}
            />

            <MenuItem
              icon="bed"
              title="Gestione stanze"
              onPress={() => router.push("/manage-rooms")}
            />

            <MenuItem
              icon="eye"
              title="Monitoraggio maestri"
              onPress={() => router.push("/teacher-activity")}
            />

            <MenuItem
              icon="albums-outline"
              title="Camere inserite dai maestri"
              onPress={() => router.push("/admin-teacher-rooms")}
            />

            <MenuItem
              icon="clipboard-outline"
              title="Richieste modifiche camere"
              badgeCount={pendingRoomRequestsCount}
              onPress={() => router.push("/notifications?mode=roomRequests")}
            />

            <MenuItem
              icon="notifications"
              title="Notifiche"
              onPress={() => router.push("/notifications")}
            />

            <MenuItem
              icon="settings"
              title="Impostazioni"
              onPress={() => router.push("/settings")}
            />
          </>
        ) : (
          <>
            <MenuItem
              icon="bed"
              title="Le mie stanze"
              onPress={() => router.push("/(tabs)/rooms")}
            />

            <MenuItem
              icon="list-outline"
              title="Lista camere"
              onPress={() => router.push("/teacher-room-list")}
            />

            <MenuItem
              icon="cash-outline"
              title="Totale pagamenti"
              onPress={() => router.push("/teacher-payments")}
            />

            <MenuItem
              icon="clipboard-outline"
              title="Le mie richieste di modifiche"
              onPress={() => router.push("/my-room-requests")}
            />

            <MenuItem
              icon="search-outline"
              title="Eventi pubblicati"
              onPress={() => router.push("/(tabs)/events")}
            />

            <MenuItem
              icon="notifications"
              title="Notifiche"
              onPress={() => router.push("/notifications")}
            />

            <MenuItem
              icon="settings"
              title="Impostazioni"
              onPress={() => router.push("/settings")}
            />
          </>
        )}

        <TouchableOpacity
          style={[styles.menuItem, { backgroundColor: colors.card }]}
          onPress={handleLogout}
        >
          <View style={styles.menuLeft}>
            <Ionicons name="log-out-outline" size={22} color={colors.danger} />
            <Text style={[styles.logoutText, { color: colors.danger }]}>
              Logout
            </Text>
          </View>

          <Ionicons
            name="chevron-forward-outline"
            size={22}
            color={colors.secondary}
          />
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

function MenuItem({
  icon,
  title,
  onPress,
  badgeCount = 0,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  onPress: () => void;
  badgeCount?: number;
}) {
  const { colors, isDark } = useTheme();
  const styles = createStyles(colors, isDark);

  return (
    <TouchableOpacity
      style={[styles.menuItem, { backgroundColor: colors.card }]}
      onPress={onPress}
    >
      <View style={styles.menuLeft}>
        {Platform.OS === "web" ? (
          <Text style={{ fontSize: 20 }}>
            {icon === "bed" || icon === "bed-outline"
              ? "🛏️"
              : icon === "calendar" || icon === "calendar-outline"
                ? "📅"
                : icon === "person" || icon === "person-outline"
                  ? "👤"
                  : icon === "settings" || icon === "settings-outline"
                    ? "⚙️"
                    : icon === "notifications" ||
                        icon === "notifications-outline"
                      ? "🔔"
                      : icon === "home" || icon === "home-outline"
                        ? "🏠"
                        : "✨"}
          </Text>
        ) : (
          <Ionicons name={icon} size={22} color={colors.text} />
        )}
        <Text style={[styles.menuText, { color: colors.text }]}>{title}</Text>
      </View>

      <View style={styles.menuRight}>
        {badgeCount > 0 ? (
          <View style={[styles.menuBadge, { backgroundColor: colors.primary }]}>
            <Text style={styles.menuBadgeText}>
              {badgeCount > 99 ? "99+" : badgeCount}
            </Text>
          </View>
        ) : null}

        <Ionicons
          name="chevron-forward-outline"
          size={22}
          color={colors.secondary}
        />
      </View>
    </TouchableOpacity>
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
      paddingHorizontal: 24,
      paddingBottom: 130,
    },

    notificationWrapper: {
      position: "absolute",
      top: 26,
      right: 24,
      zIndex: 10,
    },

    notificationButton: {
      width: 56,
      height: 56,
      borderRadius: 18,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
    },

    notificationBadge: {
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

    notificationBadgeText: {
      color: colors.text,
      fontSize: 11,
      fontWeight: "900",
    },

    title: {
      color: colors.text,
      fontSize: 40,
      fontWeight: "900",
      marginBottom: 10,
    },

    subtitle: {
      color: colors.secondary,
      fontSize: 17,
      marginBottom: 28,
      paddingRight: 70,
    },

    profileCard: {
      backgroundColor: colors.card,
      borderRadius: 30,
      paddingVertical: 34,
      paddingHorizontal: 22,
      alignItems: "center",
      marginBottom: 24,
    },

    avatarContainer: {
      width: 120,
      height: 120,
      borderRadius: 60,
      backgroundColor: colors.background,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 18,
      overflow: "hidden",
      borderWidth: 1,
      borderColor: colors.border,
    },

    avatar: {
      width: "100%",
      height: "100%",
    },

    name: {
      color: colors.text,
      fontSize: 28,
      fontWeight: "900",
      marginBottom: 8,
      textAlign: "center",
    },

    role: {
      color: colors.primary,
      fontSize: 16,
      fontWeight: "900",
      marginBottom: 14,
    },

    schoolBadge: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.border,
      borderRadius: 16,
      paddingVertical: 9,
      paddingHorizontal: 14,
      marginBottom: 22,
    },

    schoolText: {
      color: colors.text,
      fontSize: 14,
      fontWeight: "800",
      marginLeft: 7,
    },

    editButton: {
      backgroundColor: colors.primary,
      paddingVertical: 14,
      paddingHorizontal: 28,
      borderRadius: 18,
    },

    editButtonText: {
      color: colors.onPrimary,
      fontSize: 15,
      fontWeight: "900",
    },

    menuContainer: {
      gap: 14,
    },

    menuItem: {
      backgroundColor: colors.card,
      borderRadius: 22,
      paddingVertical: 20,
      paddingHorizontal: 20,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },

    menuLeft: {
      flexDirection: "row",
      alignItems: "center",
      flex: 1,
    },

    menuRight: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },

    menuBadge: {
      minWidth: 24,
      height: 24,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 7,
    },

    menuBadgeText: {
      color: colors.onPrimary || "#FFFFFF",
      fontSize: 12,
      fontWeight: "900",
    },

    menuText: {
      color: colors.text,
      fontSize: 17,
      fontWeight: "800",
      marginLeft: 14,
    },

    logoutText: {
      color: colors.primary,
      fontSize: 17,
      fontWeight: "900",
      marginLeft: 14,
    },
  });
