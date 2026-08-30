import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { Slot, router, usePathname } from "expo-router";
import { doc, onSnapshot } from "firebase/firestore";
import { useEffect, useState } from "react";
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from "react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { db } from "../../firebase";
import { getAdminProfileImage } from "../../utils/profileImages";

const MENU = [
  ["Dashboard", "grid-outline", "/admin-web"], ["Eventi e artisti", "calendar-outline", "/admin-web/events"],
  ["Gestione stanze", "bed-outline", "/admin-web/rooms"], ["Maestri", "people-outline", "/admin-web/teachers"],
  ["Stato maestri", "radio-outline", "/admin-web/teacher-status"],
  ["Camere maestri", "business-outline", "/admin-web/teacher-rooms"], ["Pagamenti", "wallet-outline", "/admin-web/payments"],
  ["Monitoraggio", "pulse-outline", "/admin-web/monitoring"], ["Richieste", "git-pull-request-outline", "/admin-web/requests"],
  ["Notifiche", "notifications-outline", "/admin-web/notifications"],
  ["Impostazioni", "settings-outline", "/admin-web/settings"],
] as const;

export default function AdminWebLayout() {
  const { colors } = useTheme();
  const pathname = usePathname();
  const { width } = useWindowDimensions();
  const isMobile = width < 820;
  const [adminName, setAdminName] = useState("Amministratore");
  const [adminImage, setAdminImage] = useState("");
  const [adminImageFailed, setAdminImageFailed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [sessionAuthorized, setSessionAuthorized] = useState(false);

  useEffect(() => {
    let active = true;

    const verifySession = async () => {
      try {
        const values = await AsyncStorage.multiGet(["isLogged", "loggedUser"]);
        if (!active) return;

        const session = Object.fromEntries(values);
        if (session.isLogged !== "true" || !session.loggedUser) {
          router.replace("/web/login");
          return;
        }

        if (session.loggedUser === "teacher") {
          router.replace("/web/teacher");
          return;
        }

        if (session.loggedUser !== "admin") {
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

    return onSnapshot(
        doc(db, "settings", "adminProfile"),
        (snapshot) => {
          const data = snapshot.exists() ? snapshot.data() : null;
          setAdminName(data?.name || "Amministratore");
          setAdminImage(getAdminProfileImage(data as Record<string, unknown> | null));
          setAdminImageFailed(false);
        },
        () => {
          setAdminName("Amministratore");
          setAdminImage("");
        },
      );
  }, [sessionAuthorized]);
  useEffect(() => setMenuOpen(false), [pathname]);

  const goTo = (route: string) => { setMenuOpen(false); router.replace(route as never); };
  const handleLogout = async () => {
    try {
      await AsyncStorage.multiRemove(["isLogged", "loggedUser", "teacherUsername", "teacherId", "teacherName", "teacherFullName", "danceSchool", "loggedUserName", "adminName", "adminProfileImage", "profileImage"]);
    } finally { setMenuOpen(false); router.replace("/web/login"); }
  };

  const renderMenu = () => MENU.map(([label, icon, route]) => {
    const active = route === "/admin-web" ? pathname === route : pathname.startsWith(route);
    return <TouchableOpacity key={route} style={[styles.item, { backgroundColor: active ? `${colors.primary}16` : "transparent", borderColor: active ? `${colors.primary}35` : "transparent" }]} onPress={() => goTo(route)}>
      <View style={[styles.itemIcon, { backgroundColor: active ? colors.primary : `${colors.primary}10` }]}><Ionicons name={icon} size={18} color={active ? colors.onPrimary : colors.primary} /></View>
      <Text style={[styles.itemText, { color: active ? colors.text : colors.secondary }]}>{label}</Text>
    </TouchableOpacity>;
  });
  const renderBrand = (compact = true) => <View style={[styles.brand, !compact && styles.desktopBrand]}>
    <View style={[styles.brandIcon, { backgroundColor: `${colors.primary}18` }]}><Ionicons name="sparkles" size={21} color={colors.primary} /></View>
    <View style={styles.brandCopy}><Text style={[styles.brandTitle, { color: colors.text }]}>YoSoyEvents</Text><Text style={[styles.brandSub, { color: colors.secondary }]}>Admin Web</Text></View>
  </View>;
  const renderAccount = () => <View style={[styles.accountFooter, { borderTopColor: colors.border }]}>
    <View style={styles.accountRow}>{adminImage && !adminImageFailed ? <Image source={{ uri: adminImage }} style={styles.avatar} resizeMode="cover" onError={() => setAdminImageFailed(true)} /> : <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: `${colors.primary}16` }]}><Ionicons name="person-outline" size={19} color={colors.primary} /></View>}
      <View style={styles.accountInfo}><Text numberOfLines={1} style={[styles.accountName, { color: colors.text }]}>{adminName}</Text><Text style={[styles.accountRole, { color: colors.secondary }]}>Amministratore</Text></View>
    </View>
    <TouchableOpacity style={[styles.logout, { backgroundColor: `${colors.danger}10`, borderColor: `${colors.danger}35` }]} onPress={handleLogout}><Ionicons name="log-out-outline" size={18} color={colors.danger} /><Text style={[styles.logoutText, { color: colors.danger }]}>Esci</Text></TouchableOpacity>
  </View>;

  if (!sessionAuthorized) {
    return <View style={[styles.authLoader, { backgroundColor: colors.background }]}><ActivityIndicator size="small" color={colors.primary} /></View>;
  }

  if (isMobile) return <View style={[styles.mobileScreen, { backgroundColor: colors.background }]}>
    <View style={[styles.mobileHeader, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>{renderBrand(true)}<TouchableOpacity accessibilityLabel="Apri menu amministratore" style={[styles.menuButton, { backgroundColor: `${colors.primary}12`, borderColor: colors.border }]} onPress={() => setMenuOpen(true)}><Ionicons name="menu-outline" size={27} color={colors.primary} /></TouchableOpacity></View>
    <View style={styles.content}><Slot /></View>
    <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}><View style={styles.modalRoot}><Pressable style={styles.overlay} onPress={() => setMenuOpen(false)} /><View style={[styles.drawer, { backgroundColor: colors.card, borderColor: colors.border }]}><View style={styles.drawerHeader}>{renderBrand()}<TouchableOpacity style={[styles.closeButton, { backgroundColor: `${colors.primary}10` }]} onPress={() => setMenuOpen(false)}><Ionicons name="close-outline" size={25} color={colors.text} /></TouchableOpacity></View><ScrollView style={styles.drawerScroll} contentContainerStyle={styles.drawerContent} showsVerticalScrollIndicator={false}>{renderMenu()}</ScrollView>{renderAccount()}</View></View></Modal>
  </View>;

  return <View style={[styles.screen, { backgroundColor: colors.background }]}><View style={[styles.sidebar, { backgroundColor: colors.card, borderColor: colors.border }]}>{renderBrand(false)}<View style={styles.menu}>{renderMenu()}</View>{renderAccount()}</View><View style={styles.content}><Slot /></View></View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, flexDirection: "row", minHeight: "100vh" as any }, sidebar: { width: 245, borderRightWidth: 1, padding: 14 },
  brand: { flex: 1, flexDirection: "row", alignItems: "center" }, desktopBrand: { flex: 0, marginBottom: 18 }, brandCopy: { flex: 1, minWidth: 0 }, brandIcon: { width: 43, height: 43, borderRadius: 14, alignItems: "center", justifyContent: "center", marginRight: 10 }, brandTitle: { fontSize: 16, fontWeight: "900" }, brandSub: { fontSize: 10, fontWeight: "800", marginTop: 2 },
  menu: { flex: 1, paddingTop: 18 }, item: { minHeight: 47, borderRadius: 14, borderWidth: 1, paddingHorizontal: 8, marginBottom: 4, flexDirection: "row", alignItems: "center" }, itemIcon: { width: 33, height: 33, borderRadius: 10, alignItems: "center", justifyContent: "center", marginRight: 8 }, itemText: { flex: 1, fontSize: 11, fontWeight: "900" },
  accountFooter: { borderTopWidth: 1, paddingTop: 11 }, accountRow: { minHeight: 50, flexDirection: "row", alignItems: "center", marginBottom: 8 }, avatar: { width: 40, height: 40, borderRadius: 20, marginRight: 9 }, avatarFallback: { alignItems: "center", justifyContent: "center" }, accountInfo: { flex: 1, minWidth: 0 }, accountName: { fontSize: 11, fontWeight: "900" }, accountRole: { fontSize: 9, fontWeight: "700", marginTop: 2 }, logout: { minHeight: 44, borderRadius: 12, borderWidth: 1, flexDirection: "row", alignItems: "center", justifyContent: "center" }, logoutText: { fontSize: 10, fontWeight: "900", marginLeft: 6 },
  content: { flex: 1, width: "100%", minWidth: 0 }, mobileScreen: { flex: 1, minHeight: "100vh" as any, width: "100%" }, mobileHeader: { minHeight: 66, borderBottomWidth: 1, paddingHorizontal: 14, paddingVertical: 10, flexDirection: "row", alignItems: "center", position: "sticky" as any, top: 0, zIndex: 50 }, menuButton: { width: 44, height: 44, borderRadius: 13, borderWidth: 1, alignItems: "center", justifyContent: "center", marginLeft: 10 },
  modalRoot: { flex: 1, flexDirection: "row" }, overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.58)" }, drawer: { width: "86%", maxWidth: 345, height: "100%", borderRightWidth: 1, padding: 14, zIndex: 2 }, drawerHeader: { minHeight: 50, flexDirection: "row", alignItems: "center", marginBottom: 12 }, closeButton: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center", marginLeft: 8 }, drawerScroll: { flex: 1 }, drawerContent: { paddingBottom: 12 },
  authLoader: { flex: 1, minHeight: "100vh" as any, width: "100%", alignItems: "center", justifyContent: "center" },
});
