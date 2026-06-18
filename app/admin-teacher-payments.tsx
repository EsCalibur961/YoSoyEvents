import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { useCallback, useMemo, useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useTheme } from "../contexts/ThemeContext";
import { db } from "../firebase";

type RoomType = "Doppia" | "Tripla" | "Quadrupla";

type TeacherUser = {
  id: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  danceSchool?: string;
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

type RoomData = {
  id: string;
  teacherUsername?: string;
  roomType?: RoomType;
  roomIndex?: number;
  customName?: string;
  guests?: Guest[];
};

type TeacherPrivatePayment = {
  id: string;
  teacherUsername?: string;
  amountToPay?: string;
  note?: string;
};

const roomTypes: RoomType[] = ["Doppia", "Tripla", "Quadrupla"];

export default function AdminTeacherPaymentsScreen() {
  const { colors, isDark } = useTheme();
  const styles = createStyles(colors, isDark);
  const [teachers, setTeachers] = useState<TeacherUser[]>([]);
  const [roomsData, setRoomsData] = useState<RoomData[]>([]);
  const [privatePayments, setPrivatePayments] = useState<
    TeacherPrivatePayment[]
  >([]);

  const safeText = (value: any) => String(value ?? "").trim();
  const safeNumber = (value: any) => {
    const number = Number(value || 0);
    return Number.isNaN(number) ? 0 : number;
  };

  const [selectedTeacher, setSelectedTeacher] = useState<string | null>(null);
  const [amountToPay, setAmountToPay] = useState("");
  const [note, setNote] = useState("");

  useFocusEffect(
    useCallback(() => {
      let unsubTeachers: (() => void) | null = null;
      let unsubRooms: (() => void) | null = null;

      try {
        unsubTeachers = onSnapshot(collection(db, "teachers"), (snapshot) => {
          const data: TeacherUser[] = snapshot.docs.map((item) => ({
            id: item.id,
            ...(item.data() as Omit<TeacherUser, "id">),
          }));

          setTeachers(data);
        });

        unsubRooms = onSnapshot(collection(db, "roomsData"), (snapshot) => {
          const data: RoomData[] = snapshot.docs.map((item) => ({
            id: item.id,
            ...(item.data() as Omit<RoomData, "id">),
          }));

          setRoomsData(data);
        });

        getDocs(collection(db, "teacherPrivatePayments"))
          .then((snapshot) => {
            const data: TeacherPrivatePayment[] = snapshot.docs.map((item) => ({
              id: item.id,
              ...(item.data() as Omit<TeacherPrivatePayment, "id">),
            }));

            setPrivatePayments(data);
          })
          .catch(() => {
            setPrivatePayments([]);
          });
      } catch {
        setTeachers([]);
        setRoomsData([]);
        setPrivatePayments([]);
      }

      return () => {
        if (unsubTeachers) unsubTeachers();
        if (unsubRooms) unsubRooms();
      };
    }, []),
  );

  const getTeacherName = (teacher: TeacherUser) => {
    const fullName =
      `${teacher.firstName || ""} ${teacher.lastName || ""}`.trim();

    return fullName || teacher.username || "Maestro";
  };

  const selectedTeacherData = teachers.find(
    (teacher) => teacher.username === selectedTeacher,
  );

  const selectedPayment = privatePayments.find(
    (payment) => payment.teacherUsername === selectedTeacher,
  );

  const normalizeGuest = (guest: any): Guest => ({
    firstName: safeText(guest?.firstName),
    lastName: safeText(guest?.lastName),
    birthDate: safeText(guest?.birthDate),
    birthPlace: safeText(guest?.birthPlace),
    selectedPackId: safeText(guest?.selectedPackId),
    selectedPackLetter: guest?.selectedPackLetter || "",
    selectedPackPrice: guest?.selectedPackPrice || "",
  });

  const teacherRooms = useMemo(() => {
    if (!selectedTeacher) return [];

    return roomsData
      .filter((room) => room.teacherUsername === selectedTeacher)
      .map((room) => ({
        ...room,
        guests: Array.isArray(room.guests || [])
          ? (room.guests || []).map((guest) => normalizeGuest(guest))
          : [],
      }));
  }, [roomsData, selectedTeacher]);

  const isGuestComplete = (guest: Guest) => {
    return Boolean(
      guest.firstName?.trim() &&
      guest.lastName?.trim() &&
      guest.birthDate?.trim() &&
      guest.birthPlace?.trim() &&
      guest.selectedPackId?.trim(),
    );
  };

  const getGuestFullName = (guest: Guest) => {
    return `${guest.firstName || ""} ${guest.lastName || ""}`.trim();
  };

  const getRoomLabel = (room: RoomData) => {
    if (room.customName?.trim()) return room.customName.trim();

    return `${room.roomType || "Camera"} #${room.roomIndex || "-"}`;
  };

  const getGuestPrice = (guest: Guest) => {
    const price = Number(guest.selectedPackPrice || 0);

    return Number.isNaN(price) ? 0 : price;
  };

  const completedGuests = teacherRooms.flatMap((room) =>
    (room.guests || [])
      .filter((guest) => isGuestComplete(guest))
      .map((guest) => ({
        guest,
        room,
      })),
  );

  const totalRevenue = completedGuests.reduce((sum, item) => {
    return safeNumber(sum) + safeNumber(getGuestPrice(item.guest));
  }, 0);

  const amountPaid = safeNumber(amountToPay);
  const remainingAmount = Math.max(totalRevenue - amountPaid, 0);

  const paymentStatus =
    amountPaid <= 0
      ? "NON PAGATO"
      : amountPaid > totalRevenue
        ? "PARZIALE"
        : "PAGATO";

  const safeTotalRevenue = Number(totalRevenue || 0);
  const safeAmountPaid = Number(amountPaid || 0);
  const safeRemainingAmount = Number(remainingAmount || 0);
  const safeCompletedGuests = Number(completedGuests.length || 0);
  const completedRooms = teacherRooms.filter((room) =>
    (room.guests || []).some((guest) => isGuestComplete(guest)),
  ).length;

  const safeCompletedRooms = Number(completedRooms || 0);
  const selectTeacher = (teacher: TeacherUser) => {
    const username = teacher.username || "";

    if (!username) return;

    if (selectedTeacher === username) {
      setSelectedTeacher(null);
      setAmountToPay("");
      setNote("");
      return;
    }

    const existingPayment = privatePayments.find(
      (payment) => payment.teacherUsername === username,
    );

    setSelectedTeacher(username);
    setAmountToPay(existingPayment?.amountToPay || "");
    setNote(existingPayment?.note || "");
  };

  const savePrivatePayment = async () => {
    if (!selectedTeacher) {
      Alert.alert("Maestro mancante", "Seleziona prima un maestro.");
      return;
    }

    try {
      await setDoc(
        doc(db, "teacherPrivatePayments", selectedTeacher),
        {
          teacherUsername: selectedTeacher,
          teacherFullName: selectedTeacherData
            ? getTeacherName(selectedTeacherData)
            : selectedTeacher,
          danceSchool: selectedTeacherData?.danceSchool || "",
          totalRevenue,
          amountToPay: amountToPay.trim(),
          note: note.trim(),
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );

      Alert.alert(
        "Appunto salvato",
        "Il pagamento privato del maestro è stato salvato solo per l’admin.",
      );
    } catch (error: any) {
      console.log("ERRORE SALVATAGGIO PAGAMENTO:", error);

      Alert.alert("Errore salvataggio", String(error?.message || error));
    }
  };

  const getRoomsByType = (type: RoomType) => {
    return teacherRooms.filter((room) => room.roomType === type);
  };

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

      <Text style={styles.title}>Pagamenti maestri</Text>

      <Text style={styles.subtitle}>
        Sezione privata admin: calcola il totale generato dal maestro e annota
        quanto pagarlo. I maestri non vedono questi dati.
      </Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Seleziona maestro</Text>

        {teachers.length === 0 ? (
          <Text style={styles.emptyText}>Nessun maestro registrato.</Text>
        ) : (
          teachers.map((teacher) => {
            const selected = selectedTeacher === teacher.username;

            return (
              <TouchableOpacity
                key={teacher.id}
                style={[
                  styles.teacherButton,
                  selected && styles.teacherButtonActive,
                ]}
                onPress={() => selectTeacher(teacher)}
              >
                <View style={styles.teacherInfo}>
                  <Text style={styles.teacherName}>
                    {getTeacherName(teacher)}
                  </Text>

                  <Text style={styles.teacherSchool}>
                    @{teacher.username || "-"} •{" "}
                    {teacher.danceSchool || "Scuola non inserita"}
                  </Text>
                </View>

                <Ionicons
                  name={selected ? "checkmark-circle" : "ellipse-outline"}
                  size={24}
                  color={selected ? colors.primary : colors.secondary}
                />
              </TouchableOpacity>
            );
          })
        )}
      </View>

      {selectedTeacher ? (
        <>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>
              {selectedTeacherData
                ? getTeacherName(selectedTeacherData)
                : selectedTeacher}
            </Text>

            <Text style={styles.summarySchool}>
              {selectedTeacherData?.danceSchool || "Scuola non inserita"}
            </Text>

            <View style={styles.statsGrid}>
              <View style={styles.statBox}>
                <Text style={styles.statNumber}>€{safeTotalRevenue}</Text>
                <Text style={styles.statLabel}>Totale generato</Text>
              </View>

              <View
                style={[
                  styles.paymentStatusBox,
                  paymentStatus === "PAGATO" && styles.paymentStatusPaid,
                  paymentStatus === "PARZIALE" && styles.paymentStatusPartial,
                  paymentStatus === "NON PAGATO" && styles.paymentStatusUnpaid,
                ]}
              >
                <Text
                  style={[
                    styles.paymentStatusText,
                    paymentStatus === "PAGATO" && { color: "#22C55E" },
                    paymentStatus === "PARZIALE" && { color: "#F59E0B" },
                    paymentStatus === "NON PAGATO" && { color: "#EF4444" },
                  ]}
                >
                  {paymentStatus}
                </Text>

                <Text style={styles.paymentStatusSubtext}>
                  {`Pagato €${safeAmountPaid} • Residuo €${safeRemainingAmount}`}
                </Text>
              </View>

              <View style={styles.statBox}>
                <Text style={styles.statNumber}>{safeCompletedGuests}</Text>
                <Text style={styles.statLabel}>Persone complete</Text>
              </View>

              <View style={styles.statBox}>
                <Text style={styles.statNumber}>{safeCompletedRooms}</Text>
                <Text style={styles.statLabel}>Camere usate</Text>
              </View>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Appunto pagamento privato</Text>

            <TextInput
              style={styles.input}
              placeholder="Quanto pagare al maestro es. 300"
              placeholderTextColor={colors.placeholder}
              value={amountToPay}
              onChangeText={setAmountToPay}
              keyboardType="numeric"
            />

            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Nota privata admin"
              placeholderTextColor={colors.placeholder}
              value={note}
              onChangeText={setNote}
              multiline
            />

            <TouchableOpacity
              style={styles.saveButton}
              onPress={savePrivatePayment}
            >
              <Ionicons name="save-outline" size={22} color={colors.text} />
              <Text style={styles.saveButtonText}>Salva appunto privato</Text>
            </TouchableOpacity>

            {selectedPayment ? (
              <View style={styles.savedNoteBox}>
                <Text style={styles.savedNoteTitle}>Appunto salvato</Text>

                <Text style={styles.savedNoteText}>
                  Pagare: €{selectedPayment.amountToPay || "0"}
                </Text>

                {selectedPayment.note ? (
                  <Text style={styles.savedNoteText}>
                    Nota: {selectedPayment.note}
                  </Text>
                ) : null}
              </View>
            ) : null}
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Dettaglio camere e pack</Text>

            {completedGuests.length === 0 ? (
              <Text style={styles.emptyText}>
                Nessuna persona completa trovata per questo maestro.
              </Text>
            ) : (
              roomTypes.map((type) => {
                const rooms = getRoomsByType(type);

                if (rooms.length === 0) return null;

                return (
                  <View key={type} style={styles.roomTypeBlock}>
                    <Text style={styles.roomTypeTitle}>{type}</Text>

                    {rooms.map((room) => {
                      const guests = (room.guests || []).filter((guest) =>
                        isGuestComplete(guest),
                      );

                      if (guests.length === 0) return null;

                      return (
                        <View key={room.id} style={styles.roomBox}>
                          <Text style={styles.roomTitle}>
                            {getRoomLabel(room)}
                          </Text>

                          {guests.map((guest, index) => (
                            <View
                              key={`${room.id}-${index}`}
                              style={styles.guestRow}
                            >
                              <View style={styles.guestInfo}>
                                <Text style={styles.guestName}>
                                  {getGuestFullName(guest)}
                                </Text>

                                <Text style={styles.guestPack}>
                                  Pack {guest.selectedPackLetter || "-"} • €
                                  {guest.selectedPackPrice || "0"}
                                </Text>
                              </View>

                              <Text style={styles.guestPrice}>
                                €{getGuestPrice(guest)}
                              </Text>
                            </View>
                          ))}
                        </View>
                      );
                    })}
                  </View>
                );
              })
            )}
          </View>
        </>
      ) : (
        <View style={styles.emptyBox}>
          <Ionicons name="cash-outline" size={50} color={colors.secondary} />

          <Text style={styles.emptyTitle}>Nessun maestro selezionato</Text>

          <Text style={styles.emptyText}>
            Seleziona un maestro per visualizzare totale e appunti pagamento.
          </Text>
        </View>
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
      paddingTop: 52,
      paddingHorizontal: 22,
      paddingBottom: 120,
    },

    backButton: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 24,
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
      lineHeight: 24,
      marginBottom: 24,
    },

    card: {
      backgroundColor: colors.card,
      borderRadius: 28,
      padding: 20,
      marginBottom: 22,
    },

    cardTitle: {
      color: colors.text,
      fontSize: 23,
      fontWeight: "900",
      marginBottom: 18,
    },

    teacherButton: {
      backgroundColor: colors.background,
      borderRadius: 20,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.border,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },

    teacherButtonActive: {
      borderColor: colors.primary,
      backgroundColor: "#f4f4f4",
    },

    teacherInfo: {
      flex: 1,
      paddingRight: 12,
    },

    teacherName: {
      color: colors.text,
      fontSize: 17,
      fontWeight: "900",
      marginBottom: 4,
    },

    teacherSchool: {
      color: colors.secondary,
      fontSize: 14,
      fontWeight: "800",
    },

    summaryCard: {
      backgroundColor: colors.card,
      borderRadius: 28,
      padding: 20,
      marginBottom: 22,
    },

    summaryTitle: {
      color: colors.text,
      fontSize: 24,
      fontWeight: "900",
    },

    summarySchool: {
      color: colors.secondary,
      fontSize: 15,
      marginTop: 5,
      marginBottom: 18,
    },

    statsGrid: {
      flexDirection: "row",
      gap: 10,
    },

    statBox: {
      flex: 1,
      backgroundColor: colors.background,
      borderRadius: 18,
      padding: 14,
      alignItems: "center",
      borderWidth: 1,
      borderColor: colors.border,
    },

    statNumber: {
      color: colors.primary,
      fontSize: 20,
      fontWeight: "900",
      marginBottom: 4,
    },

    statLabel: {
      color: colors.secondary,
      fontSize: 11,
      fontWeight: "800",
      textAlign: "center",
    },

    input: {
      backgroundColor: colors.background,
      borderRadius: 18,
      paddingVertical: 16,
      paddingHorizontal: 16,
      color: colors.text,
      fontSize: 16,
      marginBottom: 14,
      borderWidth: 1,
      borderColor: colors.border,
    },

    textArea: {
      minHeight: 110,
      textAlignVertical: "top",
    },

    saveButton: {
      backgroundColor: colors.primary,
      borderRadius: 20,
      paddingVertical: 17,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
    },

    saveButtonText: {
      color: colors.onPrimary,
      fontSize: 16,
      fontWeight: "900",
      marginLeft: 8,
    },

    savedNoteBox: {
      backgroundColor: colors.background,
      borderRadius: 18,
      padding: 14,
      marginTop: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },

    savedNoteTitle: {
      color: colors.text,
      fontSize: 16,
      fontWeight: "900",
      marginBottom: 8,
    },

    savedNoteText: {
      color: colors.secondary,
      fontSize: 14,
      lineHeight: 21,
      marginBottom: 4,
    },

    roomTypeBlock: {
      marginBottom: 18,
    },

    roomTypeTitle: {
      color: colors.text,
      fontSize: 20,
      fontWeight: "900",
      marginBottom: 12,
    },

    roomBox: {
      backgroundColor: colors.background,
      borderRadius: 20,
      padding: 14,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },

    roomTitle: {
      color: colors.text,
      fontSize: 17,
      fontWeight: "900",
      marginBottom: 12,
    },

    guestRow: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 12,
      marginBottom: 10,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },

    guestInfo: {
      flex: 1,
      paddingRight: 10,
    },

    guestName: {
      color: colors.text,
      fontSize: 15,
      fontWeight: "900",
    },

    guestPack: {
      color: colors.secondary,
      fontSize: 13,
      fontWeight: "800",
      marginTop: 4,
    },

    guestPrice: {
      color: colors.success,
      fontSize: 15,
      fontWeight: "900",
    },

    emptyBox: {
      backgroundColor: colors.card,
      borderRadius: 28,
      padding: 30,
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
    paymentStatusBox: {
      backgroundColor: colors.background,
      borderRadius: 18,
      padding: 14,
      marginTop: 14,
      borderWidth: 1,
      borderColor: colors.border,
    },

    paymentStatusText: {
      color: colors.primary,
      fontSize: 18,
      fontWeight: "900",
    },

    paymentStatusSubtext: {
      color: colors.secondary,
      fontSize: 14,
      fontWeight: "800",
      marginTop: 6,
    },

    paymentStatusPaid: {
      borderColor: "#22C55E",
    },

    paymentStatusPartial: {
      borderColor: "#F59E0B",
    },

    paymentStatusUnpaid: {
      borderColor: "#EF4444",
    },
  });
