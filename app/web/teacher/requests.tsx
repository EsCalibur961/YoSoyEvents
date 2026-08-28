import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useFocusEffect } from "expo-router";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { useCallback, useMemo, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { useTheme } from "../../../contexts/ThemeContext";
import { db } from "../../../firebase";

type RoomChangeRequest = {
  id: string;
  teacherUsername?: string;
  teacherFullName?: string;
  danceSchool?: string;
  requestType?: string;
  status?: "pending" | "approved" | "rejected";
  rejectionReason?: string;
  roomLabel?: string;
  guestPosition?: number;
  changedFields?: string[];
  oldData?: any;
  newData?: any;
  createdAt?: string;
  reviewedAt?: string;
};

const requestTypeLabel = (type?: string) => {
  if (type === "room_name_updated") return "Nome camera modificato";
  if (type === "guest_moved") return "Spostamento ospite";
  if (type === "guest_pack_updated") return "Pack modificato";
  if (type === "guest_stay_dates_updated") return "Giorni permanenza modificati";
  if (type === "guest_updated") return "Nominativo modificato";
  if (type === "guest_added") return "Nuovo nominativo";
  if (type === "guest_cleared") return "Nominativo rimosso";
  if (type === "room_cleared") return "Eliminazione dati camera";
  return "Nominativo modificato";
};

const statusLabel = (status?: string) => {
  if (status === "approved") return "Approvata";
  if (status === "rejected") return "Rifiutata";
  return "In attesa";
};

const formatGuestName = (guest?: any) => {
  const name = `${guest?.firstName || ""} ${guest?.lastName || ""}`.trim();
  return name || "Non inserito";
};

export default function TeacherWebRequestsScreen() {
  const { colors, isDark } = useTheme();
  const { width } = useWindowDimensions();
  const styles = createStyles(colors, isDark, width < 700);
  const [teacherUsername, setTeacherUsername] = useState<string | null>(null);
  const [requests, setRequests] = useState<RoomChangeRequest[]>([]);

  useFocusEffect(
    useCallback(() => {
      loadUser();

      const requestsQuery = query(
        collection(db, "roomChangeRequests"),
        orderBy("createdAtServer", "desc"),
      );

      const unsubscribe = onSnapshot(requestsQuery, (snapshot) => {
        const data: RoomChangeRequest[] = snapshot.docs.map((item) => ({
          id: item.id,
          ...(item.data() as Omit<RoomChangeRequest, "id">),
        }));

        setRequests(data);
      });

      return unsubscribe;
    }, []),
  );

  const loadUser = async () => {
    const savedTeacherUsername = await AsyncStorage.getItem("teacherUsername");
    setTeacherUsername(savedTeacherUsername);
  };

  const myRequests = useMemo(() => {
    if (!teacherUsername) return [];
    return requests.filter((item) => item.teacherUsername === teacherUsername);
  }, [requests, teacherUsername]);

  const getStatusColor = (status?: string) => {
    if (status === "approved") return colors.success;
    if (status === "rejected") return colors.danger;
    return colors.warning;
  };

  const renderRequestData = (label: string, data: any) => {
    if (!data) return null;

    if (Array.isArray(data.guests)) {
      const filledGuests = data.guests.filter(
        (guest: any) =>
          guest?.firstName ||
          guest?.lastName ||
          guest?.selectedPackId ||
          guest?.notes ||
          (Array.isArray(guest?.selectedStayDates) && guest.selectedStayDates.length),
      );

      return (
        <View style={styles.dataBox}>
          <Text style={styles.dataBoxTitle}>{label}</Text>
          <Text style={styles.dataLine}>
            Nome camera: {data.customName || "-"}
          </Text>
          <Text style={styles.dataLine}>
            Ospiti presenti: {filledGuests.length}
          </Text>
          {filledGuests.map((guest: any, index: number) => (
            <Text key={`${label}-${index}`} style={styles.dataLine}>
              {index + 1}. {formatGuestName(guest)}
              {guest.selectedPackLetter ? ` • Pack ${guest.selectedPackLetter}` : ""}
              {guest.selectedStayDates?.length
                ? ` • ${guest.selectedStayDates.join(" • ")}`
                : ""}
            </Text>
          ))}
        </View>
      );
    }

    if (data.guest) {
      return (
        <View style={styles.dataBox}>
          <Text style={styles.dataBoxTitle}>{label}</Text>
          <Text style={styles.dataLine}>Ospite: {formatGuestName(data.guest)}</Text>
          <Text style={styles.dataLine}>Da: {data.fromRoomLabel || "-"} posto {data.fromGuestPosition || "-"}</Text>
          <Text style={styles.dataLine}>A: {data.toRoomLabel || "-"} posto {data.toGuestPosition || "-"}</Text>
        </View>
      );
    }

    return (
      <View style={styles.dataBox}>
        <Text style={styles.dataBoxTitle}>{label}</Text>
        {typeof data.customName !== "undefined" ? (
          <Text style={styles.dataLine}>Nome camera: {data.customName || "-"}</Text>
        ) : (
          <>
            <Text style={styles.dataLine}>Nome: {data.firstName || "-"}</Text>
            <Text style={styles.dataLine}>Cognome: {data.lastName || "-"}</Text>
            <Text style={styles.dataLine}>Data nascita: {data.birthDate || "-"}</Text>
            <Text style={styles.dataLine}>Luogo nascita: {data.birthPlace || "-"}</Text>
            <Text style={styles.dataLine}>Pack: {data.selectedPackLetter || "-"} • €{data.selectedPackPrice || "0"}</Text>
          </>
        )}
      </View>
    );
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.webHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.webEyebrow}>YO SOY EVENTS / WEB MAESTRO</Text>
          <Text style={styles.title}>Le mie richieste</Text>
          <Text style={styles.subtitle}>
            Modifiche inviate all’admin e stato di approvazione.
          </Text>
        </View>

        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.replace("/web/teacher")}
        >
          <Ionicons name="home-outline" size={19} color={colors.primary} />
          <Text style={[styles.backText, { color: colors.primary }]}>Home maestro</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <Text style={[styles.summaryValue, { color: colors.warning }]}>
            {myRequests.filter((item) => (item.status || "pending") === "pending").length}
          </Text>
          <Text style={styles.summaryLabel}>In attesa</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={[styles.summaryValue, { color: colors.success }]}>
            {myRequests.filter((item) => item.status === "approved").length}
          </Text>
          <Text style={styles.summaryLabel}>Approvate</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={[styles.summaryValue, { color: colors.danger }]}>
            {myRequests.filter((item) => item.status === "rejected").length}
          </Text>
          <Text style={styles.summaryLabel}>Rifiutate</Text>
        </View>
      </View>

      {myRequests.length === 0 ? (
        <View style={styles.emptyBox}>
          <Ionicons name="clipboard-outline" size={50} color={colors.secondary} />
          <Text style={styles.emptyTitle}>Nessuna richiesta</Text>
          <Text style={styles.emptyText}>
            Quando modificherai camere o nominativi, le richieste compariranno qui.
          </Text>
        </View>
      ) : (
        myRequests.map((request) => (
          <View key={request.id} style={styles.requestCard}>
            <View style={styles.requestHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.requestType}>{requestTypeLabel(request.requestType)}</Text>
                <Text style={styles.requestMeta}>{request.roomLabel || "Camera"}{request.guestPosition ? ` • Ospite ${request.guestPosition}` : ""}</Text>
                {request.createdAt ? <Text style={styles.requestMeta}>{request.createdAt}</Text> : null}
              </View>
              <View style={[styles.statusBadge, { backgroundColor: getStatusColor(request.status) }]}>
                <Text style={styles.statusBadgeText}>{statusLabel(request.status)}</Text>
              </View>
            </View>

            {Array.isArray(request.changedFields) && request.changedFields.length > 0 ? (
              <Text style={styles.changedFields}>Campi modificati: {request.changedFields.join(", ")}</Text>
            ) : null}

            {renderRequestData("Prima", request.oldData)}
            {renderRequestData("Dopo", request.newData)}

            {request.status === "rejected" ? (
              <View style={styles.reasonBox}>
                <Text style={styles.reasonTitle}>Motivazione rifiuto</Text>
                <Text style={styles.reasonText}>{request.rejectionReason || "Nessuna motivazione inserita."}</Text>
              </View>
            ) : null}

            {request.status === "approved" && request.reviewedAt ? (
              <Text style={styles.reviewedText}>Approvata il {request.reviewedAt}</Text>
            ) : null}
          </View>
        ))
      )}
    </ScrollView>
  );
}

const createStyles = (colors: any, isDark: boolean, isMobile: boolean) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: {
      width: "100%",
      maxWidth: 1080,
      alignSelf: "center",
      paddingTop: 30,
      paddingHorizontal: isMobile ? 14 : 28,
      paddingBottom: 90,
    },
    webHeader: {
      flexDirection: isMobile ? "column" : "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      gap: 20,
      marginBottom: 20,
    },
    webEyebrow: {
      color: colors.primary,
      fontSize: 9,
      fontWeight: "900",
      letterSpacing: 1.2,
      marginBottom: 6,
    },
    backButton: {
      minHeight: 42,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      paddingHorizontal: 13,
      flexDirection: isMobile ? "column" : "row",
      alignItems: "center",
    },
    backText: { fontSize: 9, fontWeight: "900", marginLeft: 6 },
    summaryRow: {
      flexDirection: "row",
      gap: 10,
      marginBottom: 18,
    },
    summaryCard: {
      flex: 1,
      minHeight: 82,
      backgroundColor: colors.card,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
      justifyContent: "center",
    },
    summaryValue: {
      fontSize: 24,
      fontWeight: "900",
    },
    summaryLabel: {
      color: colors.secondary,
      fontSize: 9,
      fontWeight: "800",
      marginTop: 3,
    },
    title: { color: colors.text, fontSize: 31, fontWeight: "900", marginBottom: 8 },
    subtitle: { color: colors.secondary, fontSize: 12, lineHeight: 18, marginTop: 5 },
    requestCard: {
      width: "100%",
      backgroundColor: colors.card,
      borderRadius: 20,
      padding: 18,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    requestHeader: { flexDirection: "row", alignItems: "flex-start", marginBottom: 12 },
    requestType: { color: colors.text, fontSize: 18, fontWeight: "900", marginBottom: 4 },
    requestMeta: { color: colors.secondary, fontSize: 13, fontWeight: "800", marginBottom: 2 },
    statusBadge: { borderRadius: 12, paddingVertical: 6, paddingHorizontal: 10 },
    statusBadgeText: { color: "#FFFFFF", fontSize: 12, fontWeight: "900" },
    changedFields: { color: colors.text, fontSize: 13, fontWeight: "800", marginBottom: 10 },
    dataBox: { backgroundColor: colors.background, borderRadius: 16, padding: 12, marginTop: 10, borderWidth: 1, borderColor: colors.border },
    dataBoxTitle: { color: colors.primaryDark, fontSize: 14, fontWeight: "900", marginBottom: 8 },
    dataLine: { color: colors.text, fontSize: 13, fontWeight: "700", marginBottom: 4 },
    reasonBox: { marginTop: 12, backgroundColor: isDark ? "rgba(255,59,48,0.14)" : "rgba(217,54,48,0.10)", borderRadius: 16, padding: 12, borderWidth: 1, borderColor: colors.danger },
    reasonTitle: { color: colors.danger, fontSize: 14, fontWeight: "900", marginBottom: 6 },
    reasonText: { color: colors.text, fontSize: 14, lineHeight: 20 },
    reviewedText: { color: colors.success, fontSize: 13, fontWeight: "900", marginTop: 12 },
    emptyBox: { backgroundColor: colors.card, borderRadius: 22, padding: 30, alignItems: "center" },
    emptyTitle: { color: colors.text, fontSize: 22, fontWeight: "900", marginTop: 14, marginBottom: 8 },
    emptyText: { color: colors.secondary, fontSize: 15, textAlign: "center", lineHeight: 22 },
  });
