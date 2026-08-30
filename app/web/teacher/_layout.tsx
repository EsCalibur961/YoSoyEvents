import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { Slot, router, usePathname } from "expo-router";
import { doc, onSnapshot, serverTimestamp, updateDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";

import { useTheme } from "../../../contexts/ThemeContext";
import { db } from "../../../firebase";
import { getTeacherProfileImage } from "../../../utils/profileImages";

const MENU = [
  ["Home", "home-outline", "/web/teacher"],
  ["Esplora", "compass-outline", "/web/teacher/explore"],
  ["Le mie stanze", "bed-outline", "/web/teacher/rooms"],
  ["Lista camere", "list-outline", "/web/teacher/room-list"],
  ["Pagamenti", "wallet-outline", "/web/teacher/payments"],
  ["Richieste", "git-pull-request-outline", "/web/teacher/requests"],
  ["Notifiche", "notifications-outline", "/web/teacher/notifications"],
  ["Profilo", "person-circle-outline", "/web/teacher/profile"],
  ["Impostazioni", "settings-outline", "/web/teacher/settings"],
] as const;

type TeacherProfile = {
  id: string;
  firstName?: string;
  lastName?: string;
  username?: string;
  danceSchool?: string;
  profileImage?: string;
};

export default function TeacherWebLayout() {
  const { colors } = useTheme();
  const pathname = usePathname();
  const { width } = useWindowDimensions();

  const isMobile = width < 820;

  const [teacher, setTeacher] = useState<TeacherProfile | null>(null);
  const [teacherImageFailed, setTeacherImageFailed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [sessionAuthorized, setSessionAuthorized] = useState(false);

  useEffect(() => {
    let active = true;

    const verifySession = async () => {
      try {
        const values = await AsyncStorage.multiGet([
          "isLogged",
          "loggedUser",
          "teacherId",
          "teacherUsername",
        ]);
        if (!active) return;

        const session = Object.fromEntries(values);
        if (session.isLogged !== "true" || !session.loggedUser) {
          router.replace("/web/login");
          return;
        }

        if (session.loggedUser === "admin") {
          router.replace("/admin-web");
          return;
        }

        const hasTeacherIdentity = Boolean(session.teacherId || session.teacherUsername);
        if (session.loggedUser !== "teacher" || !hasTeacherIdentity) {
          router.replace("/web/login");
          return;
        }

        setSessionAuthorized(true);
      } catch {
        if (active) router.replace("/web/login");
      }
    };

    verifySession();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!sessionAuthorized) return;

    let unsubscribe = () => {};

    const subscribeTeacher = async () => {
      try {
        const teacherId = await AsyncStorage.getItem("teacherId");
        const teacherUsername = await AsyncStorage.getItem("teacherUsername");

        if (teacherId) {
          unsubscribe = onSnapshot(doc(db, "teachers", teacherId), (snapshot) => {
            setTeacher(snapshot.exists() ? {
              id: snapshot.id,
              ...(snapshot.data() as Omit<TeacherProfile, "id">),
            } : null);
            setTeacherImageFailed(false);
          }, () => setTeacher(null));
          return;
        }

        if (teacherUsername) {
          setTeacher({
            id: "",
            username: teacherUsername,
          });
        }
      } catch {
        setTeacher(null);
      }
    };

    subscribeTeacher();
    return () => unsubscribe();
  }, [sessionAuthorized]);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  const teacherName =
    `${teacher?.firstName || ""} ${teacher?.lastName || ""}`.trim() ||
    teacher?.username ||
    "Maestro";

  const handleLogout = async () => {
    try {
      const teacherId =
        teacher?.id || (await AsyncStorage.getItem("teacherId"));

      if (teacherId) {
        try {
          await updateDoc(doc(db, "teachers", teacherId), {
            isOnline: false,
            lastSeen: serverTimestamp(),
          });
        } catch (error) {
          console.log("Stato offline non aggiornato al logout:", error);
        }
      }

      await AsyncStorage.multiRemove([
        "isLogged",
        "loggedUser",
        "teacherUsername",
        "teacherId",
        "teacherName",
        "teacherFullName",
        "danceSchool",
        "loggedUserName",
        "profileImage",
      ]);
    } finally {
      setMenuOpen(false);
      router.replace("/web/login");
    }
  };

  const goTo = (route: string) => {
    setMenuOpen(false);
    router.replace(route as never);
  };

  const renderMenuItems = () => (
    <>
      {MENU.map(([label, icon, route]) => {
        const active =
          route === "/web/teacher"
            ? pathname === "/web/teacher"
            : pathname.startsWith(route);

        return (
          <TouchableOpacity
            key={route}
            style={[
              styles.item,
              {
                backgroundColor: active
                  ? `${colors.primary}16`
                  : "transparent",
                borderColor: active
                  ? `${colors.primary}35`
                  : "transparent",
              },
            ]}
            onPress={() => goTo(route)}
          >
            <View
              style={[
                styles.itemIcon,
                {
                  backgroundColor: active
                    ? colors.primary
                    : `${colors.primary}10`,
                },
              ]}
            >
              <Ionicons
                name={icon}
                size={18}
                color={active ? colors.onPrimary : colors.primary}
              />
            </View>

            <Text
              style={[
                styles.itemText,
                { color: active ? colors.text : colors.secondary },
              ]}
            >
              {label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </>
  );

  const renderAccount = () => (
    <View
      style={[
        styles.accountFooter,
        { borderTopColor: colors.border },
      ]}
    >
      <TouchableOpacity
        style={styles.accountRow}
        onPress={() => goTo("/web/teacher/profile")}
      >
        {getTeacherProfileImage(teacher as unknown as Record<string, unknown>) && !teacherImageFailed ? (
          <Image key={getTeacherProfileImage(teacher as unknown as Record<string, unknown>)} source={{ uri: getTeacherProfileImage(teacher as unknown as Record<string, unknown>) }} style={styles.avatar} resizeMode="cover" onError={() => setTeacherImageFailed(true)} />
        ) : (
          <View
            style={[
              styles.avatarFallback,
              { backgroundColor: `${colors.primary}16` },
            ]}
          >
            <Ionicons
              name="person-outline"
              size={19}
              color={colors.primary}
            />
          </View>
        )}

        <View style={styles.accountInfo}>
          <Text
            numberOfLines={1}
            style={[styles.accountName, { color: colors.text }]}
          >
            {teacherName}
          </Text>

          <Text
            numberOfLines={1}
            style={[styles.accountSchool, { color: colors.secondary }]}
          >
            {teacher?.danceSchool || "Maestro"}
          </Text>
        </View>

        <Ionicons
          name="chevron-forward-outline"
          size={15}
          color={colors.secondary}
        />
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.logoutButton,
          {
            backgroundColor: `${colors.danger}10`,
            borderColor: `${colors.danger}35`,
          },
        ]}
        onPress={handleLogout}
      >
        <Ionicons
          name="log-out-outline"
          size={17}
          color={colors.danger}
        />
        <Text style={[styles.logoutText, { color: colors.danger }]}>
          Esci
        </Text>
      </TouchableOpacity>
    </View>
  );

  if (!sessionAuthorized) {
    return <View style={[styles.authLoader, { backgroundColor: colors.background }]}><ActivityIndicator size="small" color={colors.primary} /></View>;
  }

  if (pathname === "/web/teacher/change-password") {
    return <Slot />;
  }

  if (isMobile) {
    return (
      <View style={[styles.mobileScreen, { backgroundColor: colors.background }]}>
        <View
          style={[
            styles.mobileHeader,
            { backgroundColor: colors.card, borderBottomColor: colors.border },
          ]}
        >
          <View style={styles.mobileBrand}>
            <View
              style={[
                styles.mobileBrandIcon,
                { backgroundColor: `${colors.primary}18` },
              ]}
            >
              <Ionicons name="sparkles" size={20} color={colors.primary} />
            </View>

            <View style={{ flex: 1 }}>
              <Text style={[styles.mobileBrandTitle, { color: colors.text }]}>
                YoSoyEvents
              </Text>
              <Text style={[styles.mobileBrandSub, { color: colors.secondary }]}>
                Web Maestro
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={[
              styles.menuButton,
              { backgroundColor: `${colors.primary}12`, borderColor: colors.border },
            ]}
            onPress={() => setMenuOpen(true)}
          >
            <Ionicons name="menu-outline" size={26} color={colors.primary} />
          </TouchableOpacity>
        </View>

        <View style={styles.mobileContent}>
          <Slot />
        </View>

        <Modal
          visible={menuOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setMenuOpen(false)}
        >
          <View style={styles.modalRoot}>
            <Pressable
              style={styles.overlay}
              onPress={() => setMenuOpen(false)}
            />

            <View
              style={[
                styles.mobileDrawer,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <View style={styles.drawerHeader}>
                <View style={styles.mobileBrand}>
                  <View
                    style={[
                      styles.mobileBrandIcon,
                      { backgroundColor: `${colors.primary}18` },
                    ]}
                  >
                    <Ionicons
                      name="sparkles"
                      size={20}
                      color={colors.primary}
                    />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        styles.mobileBrandTitle,
                        { color: colors.text },
                      ]}
                    >
                      YoSoyEvents
                    </Text>
                    <Text
                      style={[
                        styles.mobileBrandSub,
                        { color: colors.secondary },
                      ]}
                    >
                      Web Maestro
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={[
                    styles.closeButton,
                    { backgroundColor: `${colors.primary}10` },
                  ]}
                  onPress={() => setMenuOpen(false)}
                >
                  <Ionicons name="close-outline" size={24} color={colors.text} />
                </TouchableOpacity>
              </View>

              <ScrollView
                style={styles.drawerScroll}
                contentContainerStyle={styles.drawerScrollContent}
                showsVerticalScrollIndicator={false}
              >
                {renderMenuItems()}
              </ScrollView>

              {renderAccount()}
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.sidebar,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <View style={styles.brand}>
          <View
            style={[
              styles.brandIcon,
              { backgroundColor: `${colors.primary}18` },
            ]}
          >
            <Ionicons name="sparkles" size={22} color={colors.primary} />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={[styles.brandTitle, { color: colors.text }]}>
              YoSoyEvents
            </Text>
            <Text style={[styles.brandSub, { color: colors.secondary }]}>
              Web Maestro
            </Text>
          </View>
        </View>

        <View style={styles.menu}>{renderMenuItems()}</View>
        {renderAccount()}
      </View>

      <View style={styles.content}>
        <Slot />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  authLoader: {
    flex: 1,
    minHeight: "100vh" as any,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  screen: {
    flex: 1,
    flexDirection: "row",
    minHeight: "100vh" as any,
  },

  sidebar: {
    width: 245,
    borderRightWidth: 1,
    padding: 14,
  },

  brand: {
    flexDirection: "row",
    alignItems: "center",
    padding: 5,
    marginBottom: 15,
  },

  brandIcon: {
    width: 43,
    height: 43,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },

  brandTitle: {
    fontSize: 16,
    fontWeight: "900",
  },

  brandSub: {
    fontSize: 9,
    fontWeight: "800",
    marginTop: 2,
  },

  menu: {
    flex: 1,
  },

  item: {
    minHeight: 47,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 8,
    marginBottom: 4,
    flexDirection: "row",
    alignItems: "center",
  },

  itemIcon: {
    width: 33,
    height: 33,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },

  itemText: {
    flex: 1,
    fontSize: 10,
    fontWeight: "900",
  },

  accountFooter: {
    borderTopWidth: 1,
    paddingTop: 11,
  },

  accountRow: {
    minHeight: 50,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },

  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 9,
  },

  avatarFallback: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 9,
    alignItems: "center",
    justifyContent: "center",
  },

  accountInfo: {
    flex: 1,
    minWidth: 0,
    paddingRight: 5,
  },

  accountName: {
    fontSize: 10,
    fontWeight: "900",
  },

  accountSchool: {
    fontSize: 8,
    fontWeight: "700",
    marginTop: 2,
  },

  logoutButton: {
    minHeight: 39,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },

  logoutText: {
    fontSize: 9,
    fontWeight: "900",
    marginLeft: 6,
  },

  content: {
    flex: 1,
    minWidth: 0,
  },

  mobileScreen: {
    flex: 1,
    minHeight: "100vh" as any,
  },

  mobileHeader: {
    minHeight: 66,
    borderBottomWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    position: "sticky" as any,
    top: 0,
    zIndex: 50,
  },

  mobileBrand: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },

  mobileBrandIcon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 9,
  },

  mobileBrandTitle: {
    fontSize: 16,
    fontWeight: "900",
  },

  mobileBrandSub: {
    fontSize: 9,
    fontWeight: "800",
    marginTop: 1,
  },

  menuButton: {
    width: 44,
    height: 44,
    borderRadius: 13,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 10,
  },

  mobileContent: {
    flex: 1,
    width: "100%",
    minWidth: 0,
  },

  modalRoot: {
    flex: 1,
    flexDirection: "row",
  },

  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.58)",
  },

  mobileDrawer: {
    width: "86%",
    maxWidth: 345,
    height: "100%",
    borderRightWidth: 1,
    padding: 14,
    zIndex: 2,
  },

  drawerHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },

  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },

  drawerScroll: {
    flex: 1,
  },

  drawerScrollContent: {
    paddingBottom: 12,
  },
});
