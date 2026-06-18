import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useFocusEffect } from "expo-router";
import {
  collection,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { db } from "../firebase";
import { useTheme } from "../contexts/ThemeContext";

type RoomType = "Doppia" | "Tripla" | "Quadrupla";

type RoomAssignment = {
  id: string;
  teacherUsername: string;
  danceSchool?: string;
  teacherFullName?: string;
  quantities?: {
    Doppia?: number;
    Tripla?: number;
    Quadrupla?: number;
  };
};

type Guest = {
  firstName?: string;
  lastName?: string;
  birthDate?: string;
  birthPlace?: string;
  selectedPackId?: string;
  selectedPackLetter?: string;
  selectedPackPrice?: string;
};

type SavedRoom = {
  id: string;
  teacherUsername?: string;
  roomType: RoomType;
  roomIndex: number;
  customName?: string;
  guests?: Guest[];
  isSaved?: boolean;
  savedAt?: any;
  paymentVisible?: boolean;
};

type RoomPayment = {
  id: string;
  roomKey: string;
  teacherUsername: string;
  roomType: RoomType;
  roomIndex: number;
  paid: boolean;
  lockedPrice: number;
  paidAt?: any;
};

type BuiltRoom = {
  type: RoomType;
  index: number;
  price: number;
  roomKey: string;
  label: string;
  guestsCount: number;
};

const roomTypes: RoomType[] = ["Doppia", "Tripla", "Quadrupla"];

export default function TeacherPaymentsScreen() {
  const { colors, isDark } = useTheme();
  const styles = createStyles(colors, isDark);
  const [teacherUsername, setTeacherUsername] = useState<string | null>(null);
  const [assignments, setAssignments] = useState<RoomAssignment[]>([]);
  const [savedRooms, setSavedRooms] = useState<SavedRoom[]>([]);
  const [payments, setPayments] = useState<RoomPayment[]>([]);

  useFocusEffect(
    useCallback(() => {
      loadUser();
    }, []),
  );

  useEffect(() => {
    const unsubAssignments = onSnapshot(
      collection(db, "roomAssignments"),
      (snapshot) => {
        const data: RoomAssignment[] = snapshot.docs.map((item) => ({
          id: item.id,
          ...(item.data() as Omit<RoomAssignment, "id">),
        }));

        setAssignments(data);
      },
    );

    const unsubRooms = onSnapshot(collection(db, "roomsData"), (snapshot) => {
      const data: SavedRoom[] = snapshot.docs.map((item) => ({
        id: item.id,
        ...(item.data() as Omit<SavedRoom, "id">),
      }));

      setSavedRooms(data);
    });

    const unsubPayments = onSnapshot(
      collection(db, "roomPayments"),
      (snapshot) => {
        const data: RoomPayment[] = snapshot.docs.map((item) => ({
          id: item.id,
          ...(item.data() as Omit<RoomPayment, "id">),
        }));

        setPayments(data);
      },
    );

    return () => {
      unsubAssignments();
      unsubRooms();
      unsubPayments();
    };
  }, []);

  const loadUser = async () => {
    const savedTeacherUsername = await AsyncStorage.getItem("teacherUsername");
    setTeacherUsername(savedTeacherUsername);
  };

  const assignment =
    assignments.find((item) => item.teacherUsername === teacherUsername) ||
    null;

  const formatCurrency = (value: number) => {
    return `€${Number(value || 0).toFixed(2)}`;
  };

  const formatPaidAt = (paidAt: any) => {
    if (!paidAt) return "";

    const date = typeof paidAt?.toDate === "function" ? paidAt.toDate() : null;

    if (!date) return "";

    return date.toLocaleDateString("it-IT", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const getTypeAccent = (type: RoomType) => {
    if (type === "Doppia") return colors.primary;
    if (type === "Tripla") return "#3B82F6";
    return "#A855F7";
  };

  const getRoomKey = (type: RoomType, index: number) => {
    return `${teacherUsername}-${type}-${index}`;
  };

  const getPayment = (roomKey: string) => {
    return payments.find((item) => item.roomKey === roomKey);
  };

  const isPaid = (roomKey: string) => {
    return getPayment(roomKey)?.paid || false;
  };

  const isGuestComplete = (guest: Guest) => {
    return Boolean(
      guest.firstName?.trim() &&
      guest.lastName?.trim() &&
      guest.birthDate?.trim() &&
      guest.birthPlace?.trim() &&
      guest.selectedPackId?.trim(),
    );
  };

  const isRoomSavedForPayment = (room: SavedRoom) => {
    if (!teacherUsername) return false;
    if (room.teacherUsername !== teacherUsername) return false;
    if (!Array.isArray(room.guests) || room.guests.length === 0) return false;

    // IMPORTANTISSIMO:
    // Non usiamo paymentVisible/isSaved/savedAt perché nei tuoi dati attuali
    // rooms.tsx non li sta salvando in modo affidabile.
    // Per il riepilogo pagamenti consideriamo solo le camere realmente complete:
    // tutti i posti della camera devono avere dati ospite + pack selezionato.
    return room.guests.every((guest) => isGuestComplete(guest));
  };

  const getSavedRoomPrice = (room: SavedRoom) => {
    return (room.guests || []).reduce((sum, guest) => {
      if (!isGuestComplete(guest)) return sum;

      const price = Number(guest.selectedPackPrice || 0);
      return sum + (Number.isNaN(price) ? 0 : price);
    }, 0);
  };

  const getSavedRoomLabel = (room: SavedRoom) => {
    if (room.customName?.trim()) return room.customName.trim();
    return `${room.roomType} #${room.roomIndex}`;
  };

  const applyTogglePaid = async (room: BuiltRoom) => {
    if (!teacherUsername) return;

    const payment = getPayment(room.roomKey);
    const nextPaid = !payment?.paid;

    await setDoc(
      doc(db, "roomPayments", room.roomKey),
      {
        roomKey: room.roomKey,
        teacherUsername,
        roomType: room.type,
        roomIndex: room.index,
        paid: nextPaid,
        lockedPrice: nextPaid ? room.price : payment?.lockedPrice || room.price,
        paidAt: nextPaid ? serverTimestamp() : null,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  };

  const togglePaid = (room: BuiltRoom) => {
    const paid = isPaid(room.roomKey);

    Alert.alert(
      paid ? "Rimuovere saldo?" : "Confermare saldo?",
      paid
        ? `Vuoi segnare ${room.label} come non saldata?`
        : `Vuoi segnare ${room.label} come saldata? Il prezzo verrà bloccato.`,
      [
        {
          text: "Annulla",
          style: "cancel",
        },
        {
          text: paid ? "Rimuovi" : "Conferma",
          style: paid ? "destructive" : "default",
          onPress: () => applyTogglePaid(room),
        },
      ],
    );
  };

  const rooms = useMemo(() => {
    if (!teacherUsername) return [];

    const result: BuiltRoom[] = savedRooms
      .filter((room) => isRoomSavedForPayment(room))
      .map((room) => {
        const roomKey = getRoomKey(room.roomType, room.roomIndex);
        const payment = getPayment(roomKey);
        const currentPrice = getSavedRoomPrice(room);
        const paid = Boolean(payment?.paid);

        return {
          type: room.roomType,
          index: Number(room.roomIndex || 1),
          price: paid
            ? Number(payment?.lockedPrice || currentPrice)
            : currentPrice,
          roomKey,
          label: getSavedRoomLabel(room),
          guestsCount: Array.isArray(room.guests) ? room.guests.length : 0,
        };
      });

    return result.sort((a, b) => {
      const aPaid = isPaid(a.roomKey) ? 1 : 0;
      const bPaid = isPaid(b.roomKey) ? 1 : 0;

      if (aPaid !== bPaid) return aPaid - bPaid;
      if (a.type !== b.type)
        return roomTypes.indexOf(a.type) - roomTypes.indexOf(b.type);
      return a.index - b.index;
    });
  }, [savedRooms, payments, teacherUsername]);

  const totalAmount = rooms.reduce((sum, room) => sum + room.price, 0);

  const paidRooms = rooms.filter((room) => isPaid(room.roomKey)).length;
  const unpaidRooms = rooms.length - paidRooms;

  const paidAmount = rooms.reduce((sum, room) => {
    return isPaid(room.roomKey) ? sum + room.price : sum;
  }, 0);

  const remainingAmount = totalAmount - paidAmount;

  const progressPercent =
    totalAmount > 0 ? Math.round((paidAmount / totalAmount) * 100) : 0;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
        <Ionicons name="chevron-back-outline" size={24} color={colors.text} />
        <Text style={styles.backText}>Indietro</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Totale Pagamenti</Text>

      <Text style={styles.subtitle}>
        Qui compaiono solo le camere complete salvate dal maestro. Spunta le
        camere saldate: il prezzo resta bloccato al momento del saldo.
      </Text>

      <View style={styles.summaryCard}>
        <View style={styles.summaryHeader}>
          <View>
            <Text style={styles.summaryTitle}>Riepilogo</Text>
            <Text style={styles.summarySubtitle}>
              {assignment?.danceSchool || "Nessuna scuola selezionata"}
            </Text>
          </View>

          <View style={styles.progressBadge}>
            <Text style={styles.progressBadgeText}>{progressPercent}%</Text>
          </View>
        </View>

        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              { width: `${Math.min(progressPercent, 100)}%` },
            ]}
          />
        </View>

        <View style={styles.quickStatsGrid}>
          <View style={styles.quickStatBox}>
            <Text style={styles.quickStatNumber}>{rooms.length}</Text>
            <Text style={styles.quickStatLabel}>Camere salvate</Text>
          </View>

          <View style={styles.quickStatBox}>
            <Text style={styles.quickStatNumber}>{paidRooms}</Text>
            <Text style={styles.quickStatLabel}>Saldate</Text>
          </View>

          <View style={styles.quickStatBox}>
            <Text style={styles.quickStatNumber}>{unpaidRooms}</Text>
            <Text style={styles.quickStatLabel}>Da saldare</Text>
          </View>
        </View>

        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Totale camere salvate</Text>
          <Text style={styles.summaryValue}>{formatCurrency(totalAmount)}</Text>
        </View>

        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Totale saldato</Text>
          <Text style={styles.paidValue}>{formatCurrency(paidAmount)}</Text>
        </View>

        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Totale da saldare</Text>
          <Text style={styles.remainingValue}>
            {formatCurrency(remainingAmount)}
          </Text>
        </View>
      </View>

      {rooms.length === 0 ? (
        <View style={styles.emptyBox}>
          <Ionicons name="bed" size={44} color={colors.secondary} />
          <Text style={styles.emptyTitle}>Nessuna camera salvata</Text>
          <Text style={styles.emptyText}>
            Le camere compariranno qui solo dopo che il maestro le avrà salvate
            complete con ospiti e pack.
          </Text>
        </View>
      ) : (
        roomTypes.map((type) => {
          const typeRooms = rooms.filter((room) => room.type === type);

          if (typeRooms.length === 0) return null;

          const typeTotal = typeRooms.reduce(
            (sum, room) => sum + room.price,
            0,
          );

          const typePaid = typeRooms.reduce(
            (sum, room) => (isPaid(room.roomKey) ? sum + room.price : sum),
            0,
          );

          const typePaidRooms = typeRooms.filter((room) =>
            isPaid(room.roomKey),
          ).length;

          return (
            <View key={type} style={styles.typeCard}>
              <View style={styles.typeHeader}>
                <View>
                  <Text style={styles.typeTitle}>{type}</Text>

                  <Text style={styles.typeSubtitle}>
                    {typePaidRooms}/{typeRooms.length} saldate • Totale{" "}
                    {formatCurrency(typeTotal)}
                  </Text>
                </View>

                <View
                  style={[
                    styles.typeDot,
                    { backgroundColor: getTypeAccent(type) },
                  ]}
                />
              </View>

              <Text style={styles.typePaidText}>
                Saldato: {formatCurrency(typePaid)} • Da saldare:{" "}
                {formatCurrency(typeTotal - typePaid)}
              </Text>

              {typeRooms.map((room) => {
                const paid = isPaid(room.roomKey);
                const payment = getPayment(room.roomKey);
                const paidAt = formatPaidAt(payment?.paidAt);
                const accent = getTypeAccent(room.type);

                return (
                  <TouchableOpacity
                    key={room.roomKey}
                    style={[
                      styles.roomRow,
                      paid && styles.roomRowPaid,
                      paid && { borderColor: accent },
                    ]}
                    onPress={() => togglePaid(room)}
                  >
                    <View style={styles.roomLeft}>
                      <Text style={styles.roomTitle}>{room.label}</Text>

                      <Text style={styles.roomPrice}>
                        {formatCurrency(room.price)}
                      </Text>

                      {paid ? (
                        <Text style={[styles.lockedText, { color: accent }]}>
                          Prezzo bloccato{paidAt ? ` • ${paidAt}` : ""}
                        </Text>
                      ) : (
                        <Text style={styles.currentText}>
                          {room.guestsCount} ospiti • Prezzo attuale
                        </Text>
                      )}
                    </View>

                    <View
                      style={[
                        styles.statusBadge,
                        paid && { backgroundColor: accent },
                      ]}
                    >
                      <Ionicons
                        name={paid ? "checkmark-circle" : "ellipse-outline"}
                        size={20}
                        color={colors.text}
                      />

                      <Text style={styles.statusText}>
                        {paid ? "Saldato" : "Non saldato"}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

const createStyles = (colors: any, isDark: boolean) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },

    content: {
      paddingTop: 52,
      paddingHorizontal: 22,
      paddingBottom: 130,
    },

    backButton: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 26,
    },

    backText: {
      color: colors.text,
      fontSize: 16,
      fontWeight: "800",
      marginLeft: 6,
    },

    title: {
      color: colors.text,
      fontSize: 38,
      fontWeight: "900",
      marginBottom: 10,
    },

    subtitle: {
      color: colors.secondary,
      fontSize: 16,
      lineHeight: 23,
      marginBottom: 24,
    },

    summaryCard: {
      backgroundColor: colors.card,
      borderRadius: 28,
      padding: 20,
      marginBottom: 22,
    },

    summaryHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      marginBottom: 16,
    },

    summaryTitle: {
      color: colors.text,
      fontSize: 22,
      fontWeight: "900",
    },

    summarySubtitle: {
      color: colors.secondary,
      marginTop: 5,
      fontWeight: "700",
    },

    progressBadge: {
      backgroundColor: colors.primary,
      borderRadius: 18,
      paddingHorizontal: 14,
      paddingVertical: 8,
    },

    progressBadgeText: {
      color: colors.text,
      fontWeight: "900",
    },

    progressTrack: {
      height: 10,
      borderRadius: 999,
      backgroundColor: colors.background,
      overflow: "hidden",
      marginBottom: 16,
    },

    progressFill: {
      height: "100%",
      borderRadius: 999,
      backgroundColor: colors.primary,
    },

    quickStatsGrid: {
      flexDirection: "row",
      gap: 10,
      marginBottom: 18,
    },

    quickStatBox: {
      flex: 1,
      backgroundColor: colors.background,
      borderRadius: 18,
      paddingVertical: 14,
      alignItems: "center",
      borderWidth: 1,
      borderColor: colors.border,
    },

    quickStatNumber: {
      color: colors.text,
      fontSize: 20,
      fontWeight: "900",
    },

    quickStatLabel: {
      color: colors.secondary,
      marginTop: 4,
      fontSize: 12,
      fontWeight: "800",
    },

    summaryRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 10,
    },

    summaryLabel: {
      color: colors.secondary,
      fontSize: 16,
      fontWeight: "800",
    },

    summaryValue: {
      color: colors.text,
      fontSize: 17,
      fontWeight: "900",
    },

    paidValue: {
      color: "#3DD598",
      fontSize: 17,
      fontWeight: "900",
    },

    remainingValue: {
      color: colors.primary,
      fontSize: 18,
      fontWeight: "900",
    },

    typeCard: {
      backgroundColor: colors.card,
      borderRadius: 28,
      padding: 18,
      marginBottom: 18,
    },

    typeHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 8,
    },

    typeTitle: {
      color: colors.text,
      fontSize: 24,
      fontWeight: "900",
      marginBottom: 6,
    },

    typeSubtitle: {
      color: colors.secondary,
      fontSize: 14,
      fontWeight: "800",
    },

    typePaidText: {
      color: colors.placeholder,
      fontSize: 13,
      fontWeight: "800",
      marginBottom: 16,
    },

    typeDot: {
      width: 18,
      height: 18,
      borderRadius: 999,
    },

    roomRow: {
      backgroundColor: colors.background,
      borderRadius: 22,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.border,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },

    roomRowPaid: {
      borderWidth: 2,
    },

    roomLeft: {
      flex: 1,
      paddingRight: 12,
    },

    roomTitle: {
      color: colors.text,
      fontSize: 17,
      fontWeight: "900",
    },

    roomPrice: {
      color: colors.secondary,
      fontSize: 14,
      fontWeight: "800",
      marginTop: 4,
    },

    lockedText: {
      fontSize: 12,
      fontWeight: "900",
      marginTop: 4,
    },

    currentText: {
      color: colors.placeholder,
      fontSize: 12,
      fontWeight: "800",
      marginTop: 4,
    },

    statusBadge: {
      backgroundColor: colors.border,
      borderRadius: 16,
      paddingVertical: 9,
      paddingHorizontal: 12,
      flexDirection: "row",
      alignItems: "center",
    },

    statusText: {
      color: colors.text,
      fontSize: 13,
      fontWeight: "900",
      marginLeft: 6,
    },

    emptyBox: {
      backgroundColor: colors.card,
      borderRadius: 26,
      padding: 28,
      alignItems: "center",
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
