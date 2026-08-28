import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useFocusEffect } from "expo-router";
import { collection, doc, onSnapshot } from "firebase/firestore";
import { useCallback, useMemo, useState } from "react";
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

type NotificationDeleted = {
  id: string;
  notificationId?: string;
  username?: string;
  deleted?: boolean;
};

export default function TeacherWebProfileScreen() {
  const { colors, isDark } = useTheme();
  const { width } = useWindowDimensions();
  const styles = createStyles(colors, isDark, width < 700, width < 420);
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
  const [deletedNotifications, setDeletedNotifications] = useState<NotificationDeleted[]>([]);

  useFocusEffect(
    useCallback(() => {
      loadLocalUser();

      let unsubAdmin: (() => void) | null = null;
      let unsubTeachers: (() => void) | null = null;
      let unsubNotifications: (() => void) | null = null;
      let unsubRoomRequests: (() => void) | null = null;
      let unsubReads: (() => void) | null = null;
      let unsubDeletes: (() => void) | null = null;

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

        unsubDeletes = onSnapshot(
          collection(db, "notificationDeletes"),
          (snapshot) => {
            const data: NotificationDeleted[] = snapshot.docs.map((item) => ({
              id: item.id,
              ...(item.data() as Omit<NotificationDeleted, "id">),
            }));

            setDeletedNotifications(data);
          },
        );
      } catch {
        setTeachers([]);
        setNotifications([]);
        setRoomRequests([]);
        setReads([]);
        setDeletedNotifications([]);
      }

      return () => {
        if (unsubAdmin) unsubAdmin();
        if (unsubTeachers) unsubTeachers();
        if (unsubNotifications) unsubNotifications();
        if (unsubRoomRequests) unsubRoomRequests();
        if (unsubReads) unsubReads();
        if (unsubDeletes) unsubDeletes();
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
      const deletedForCurrentUser = deletedNotifications.some(
        (deleted) =>
          deleted.notificationId === notification.id &&
          deleted.username === currentUsername &&
          deleted.deleted,
      );

      if (deletedForCurrentUser) return false;

      // Le richieste/modifiche camere dell'admin NON entrano nelle notifiche generali.
      // Sono contate solo nel badge "Richieste modifiche camere" qui sotto.
      if (notification.type === "room" && notification.targetRole === "admin") {
        return false;
      }

      if (!notification.targetRole && !notification.targetUsername) return true;
      if (notification.targetUsername) return notification.targetUsername === currentUsername;

      return notification.targetRole === role;
    });
  }, [notifications, deletedNotifications, currentUsername, role]);

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

    router.replace("/web/login");
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
          onPress={() => router.push("/web/teacher/notifications")}
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

      <View style={styles.webHeader}>
        <View>
          <Text style={[styles.webEyebrow, { color: colors.primary }]}>
            YO SOY EVENTS / WEB MAESTRO
          </Text>
          <Text style={[styles.title, { color: colors.text }]}>Profilo</Text>
          <Text style={[styles.subtitle, { color: colors.secondary }]}>
            Dati personali, scuola e funzioni del tuo account maestro.
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.homeWebButton, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => router.replace("/web/teacher")}
        >
          <Ionicons name="home-outline" size={18} color={colors.primary} />
          <Text style={[styles.homeWebText, { color: colors.primary }]}>Home maestro</Text>
        </TouchableOpacity>
      </View>

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
              source={require("../../../assets/images/icon.png")}
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
          onPress={() => router.push("/web/teacher/edit-profile")}
        >
          <Text style={styles.editButtonText}>
            {role === "teacher" ? "Modifica foto profilo" : "Modifica profilo"}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          {role === "admin" ? "Gestione" : "Area personale"}
        </Text>
        <Text style={[styles.sectionCaption, { color: colors.secondary }]}>
          {role === "admin"
            ? "Accesso rapido agli strumenti amministrativi."
            : "Le funzioni del tuo account maestro."}
        </Text>
      </View>

      <View style={styles.menuGrid}>
        <MenuItem icon="bed-outline" title="Le mie stanze" onPress={() => router.push("/web/teacher/rooms")} />
        <MenuItem icon="list-outline" title="Lista camere" onPress={() => router.push("/web/teacher/room-list")} />
        <MenuItem icon="wallet-outline" title="Pagamenti" onPress={() => router.push("/web/teacher/payments")} />
        <MenuItem icon="git-pull-request-outline" title="Richieste" badgeCount={pendingRoomRequestsCount} onPress={() => router.push("/web/teacher/requests")} />
        <MenuItem icon="compass-outline" title="Eventi" onPress={() => router.push("/web/teacher/explore")} />
        <MenuItem icon="notifications-outline" title="Notifiche" onPress={() => router.push("/web/teacher/notifications")} />
        <MenuItem icon="settings-outline" title="Impostazioni" onPress={() => router.push("/web/teacher/settings")} />
      </View>

      {width >= 700 ? <TouchableOpacity
        style={[
          styles.logoutButton,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
        onPress={handleLogout}
      >
        <View style={styles.logoutLeft}>
          <View style={[styles.logoutIconBox, { backgroundColor: `${colors.danger}14` }]}>
            <Ionicons name="log-out-outline" size={21} color={colors.danger} />
          </View>
          <Text style={[styles.logoutText, { color: colors.danger }]}>Logout</Text>
        </View>
        <Ionicons name="chevron-forward-outline" size={20} color={colors.secondary} />
      </TouchableOpacity> : null}
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
  const { width } = useWindowDimensions();
  const styles = createStyles(colors, isDark, width < 700, width < 420);

  return (
    <TouchableOpacity
      activeOpacity={0.86}
      style={[
        styles.menuItem,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
      onPress={onPress}
    >
      <View style={[styles.menuIconBox, { backgroundColor: `${colors.primary}12` }]}>
        <Ionicons name={icon} size={23} color={colors.primary} />
      </View>

      {badgeCount > 0 ? (
        <View style={[styles.menuBadge, { backgroundColor: colors.danger }]}>
          <Text style={styles.menuBadgeText}>
            {badgeCount > 99 ? "99+" : badgeCount}
          </Text>
        </View>
      ) : null}

      <View style={styles.menuCardBottom}>
        <Text numberOfLines={2} style={[styles.menuText, { color: colors.text }]}>
          {title}
        </Text>
        <Ionicons name="arrow-forward-outline" size={17} color={colors.secondary} />
      </View>
    </TouchableOpacity>
  );
}

const createStyles = (colors: any, isDark: boolean, isMobile: boolean, isMobileSmall: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },

    content: {
      width: "100%",
      maxWidth: 1120,
      alignSelf: "center",
      paddingTop: 30,
      paddingHorizontal: isMobile ? 14 : 28,
      paddingBottom: 90,
    },

    webHeader: {
      flexDirection: isMobile ? "column" : "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: 20,
      marginBottom: 8,
    },

    webEyebrow: {
      fontSize: 9,
      fontWeight: "900",
      letterSpacing: 1.2,
      marginBottom: 5,
    },

    homeWebButton: {
      minHeight: 42,
      borderRadius: 14,
      borderWidth: 1,
      paddingHorizontal: 13,
      flexDirection: "row",
      alignItems: "center",
    },

    homeWebText: {
      fontSize: 9,
      fontWeight: "900",
      marginLeft: 6,
    },

    notificationWrapper: {
      position: "absolute",
      top: 24,
      right: 16,
      zIndex: 10,
    },

    notificationButton: {
      width: 46,
      height: 46,
      borderRadius: 15,
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
      color: colors.onPrimary,
      fontSize: 11,
      fontWeight: "900",
    },

    title: {
      color: colors.text,
      fontSize: 32,
      fontWeight: "900",
      letterSpacing: -0.8,
      marginBottom: 6,
    },

    subtitle: {
      color: colors.secondary,
      fontSize: 14,
      lineHeight: 20,
      marginBottom: 18,
      paddingRight: 64,
    },

    profileCard: {
      backgroundColor: colors.card,
      borderRadius: 28,
      paddingVertical: 24,
      paddingHorizontal: 24,
      alignItems: "center",
      marginBottom: 22,
    },

    avatarContainer: {
      width: 92,
      height: 92,
      borderRadius: 46,
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
      fontSize: 24,
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

    sectionHeader: {
      marginTop: 2,
      marginBottom: 14,
    },

    sectionTitle: {
      fontSize: 20,
      fontWeight: "900",
      letterSpacing: -0.3,
    },

    sectionCaption: {
      fontSize: 13,
      lineHeight: 18,
      marginTop: 4,
    },

    menuGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "space-between",
      rowGap: 12,
      marginBottom: 14,
    },

    menuItem: {
      width: isMobileSmall ? "100%" : isMobile ? "48.5%" : "32.3%",
      minHeight: 118,
      borderRadius: 22,
      padding: 14,
      borderWidth: 1,
      position: "relative",
      justifyContent: "space-between",
      shadowColor: "#000",
      shadowOpacity: isDark ? 0.16 : 0.05,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
      elevation: 3,
    },

    menuIconBox: {
      width: 44,
      height: 44,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
    },

    menuCardBottom: {
      flexDirection: "row",
      alignItems: "flex-end",
      justifyContent: "space-between",
      gap: 8,
      marginTop: 16,
    },

    menuBadge: {
      position: "absolute",
      top: 11,
      right: 11,
      minWidth: 24,
      height: 24,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 7,
    },

    menuBadgeText: {
      color: colors.onPrimary,
      fontSize: 11,
      fontWeight: "900",
    },

    menuText: {
      flex: 1,
      fontSize: 15,
      lineHeight: 18,
      fontWeight: "900",
    },

    logoutButton: {
      minHeight: 66,
      borderRadius: 20,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderWidth: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },

    logoutLeft: {
      flexDirection: "row",
      alignItems: "center",
    },

    logoutIconBox: {
      width: 40,
      height: 40,
      borderRadius: 13,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 12,
    },

    logoutText: {
      fontSize: 15,
      fontWeight: "900",
    },
  });
