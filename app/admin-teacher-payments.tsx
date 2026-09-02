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
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useTheme } from "../contexts/ThemeContext";
import { useFeedback } from "../contexts/FeedbackContext";
import { db } from "../firebase";
import { ProfileAvatar } from "../components/ProfileAvatar";
import { getTeacherProfileImage } from "../utils/profileImages";
import { getGuestFinalPrice } from "../utils/packPricing.mjs";

type RoomType = "Doppia" | "Tripla" | "Quadrupla";

type TeacherUser = {
  id: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  danceSchool?: string;
  profileImage?: string;
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
  const { success, error, warning, info, confirm } = useFeedback();
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
  const [teacherSearch, setTeacherSearch] = useState("");
  const [expandedRoomTypes, setExpandedRoomTypes] = useState<Record<RoomType, boolean>>({
    Doppia: false,
    Tripla: false,
    Quadrupla: false,
  });
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
    return getGuestFinalPrice(guest);
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

    const existingPayment = privatePayments.find(
      (payment) => payment.teacherUsername === username,
    );

    setSelectedTeacher(username);
    setAmountToPay(existingPayment?.amountToPay || "");
    setNote(existingPayment?.note || "");
    setExpandedRoomTypes({
      Doppia: false,
      Tripla: false,
      Quadrupla: false,
    });
  };

  const closeTeacher = () => {
    setSelectedTeacher(null);
    setAmountToPay("");
    setNote("");
    setExpandedRoomTypes({
      Doppia: false,
      Tripla: false,
      Quadrupla: false,
    });
  };

  const savePrivatePayment = async () => {
    if (!selectedTeacher) {
      warning("Maestro mancante", "Seleziona prima un maestro.");
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

      success(
        "Appunto salvato",
        "Il pagamento privato del maestro è stato salvato ed è visibile solo all’admin.",
      );
    } catch (error: any) {
      console.log("ERRORE SALVATAGGIO PAGAMENTO:", error);

      error("Salvataggio non riuscito", String(error?.message || error));
    }
  };

  const getRoomsByType = (type: RoomType) => {
    return teacherRooms.filter((room) => room.roomType === type);
  };

  const filteredTeachers = useMemo(() => {
    const query = teacherSearch.trim().toLowerCase();

    return [...teachers]
      .filter((teacher) => {
        if (!query) return true;

        return [
          getTeacherName(teacher),
          teacher.username,
          teacher.danceSchool,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(query);
      })
      .sort((a, b) => getTeacherName(a).localeCompare(getTeacherName(b)));
  }, [teachers, teacherSearch]);

  const toggleRoomType = (type: RoomType) => {
    setExpandedRoomTypes((prev) => ({
      ...prev,
      [type]: !prev[type],
    }));
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

      {!selectedTeacher ? (
        <View style={styles.card}>
          <View style={styles.teacherPickerHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Seleziona maestro</Text>
              <Text style={styles.teacherPickerSubtitle}>
                Cerca il maestro, poi visualizza solo i suoi dati.
              </Text>
            </View>

            <View style={styles.teacherCountPill}>
              <Text style={styles.teacherCountText}>{filteredTeachers.length}</Text>
            </View>
          </View>

          <View style={styles.teacherSearchBox}>
            <Ionicons name="search-outline" size={18} color={colors.secondary} />
            <TextInput
              style={styles.teacherSearchInput}
              value={teacherSearch}
              onChangeText={setTeacherSearch}
              placeholder="Cerca nome, username o scuola"
              placeholderTextColor={colors.placeholder}
              autoCapitalize="none"
            />
            {teacherSearch ? (
              <TouchableOpacity onPress={() => setTeacherSearch("")}>
                <Ionicons name="close-circle" size={18} color={colors.secondary} />
              </TouchableOpacity>
            ) : null}
          </View>

          {filteredTeachers.length === 0 ? (
            <Text style={styles.emptyText}>Nessun maestro trovato.</Text>
          ) : (
            filteredTeachers.map((teacher) => (
              <TouchableOpacity
                key={teacher.id}
                style={styles.compactTeacherButton}
                onPress={() => selectTeacher(teacher)}
              >
                <ProfileAvatar uri={getTeacherProfileImage(teacher as unknown as Record<string, unknown>)} size={40} color={colors.primary} backgroundColor={colors.cardAlt} style={styles.compactTeacherAvatar} />

                <View style={styles.teacherInfo}>
                  <Text style={styles.compactTeacherName} numberOfLines={1}>
                    {getTeacherName(teacher)}
                  </Text>

                  <Text style={styles.compactTeacherSchool} numberOfLines={1}>
                    @{teacher.username || "-"} • {teacher.danceSchool || "Scuola non inserita"}
                  </Text>
                </View>

                <Ionicons
                  name="chevron-forward-outline"
                  size={20}
                  color={colors.secondary}
                />
              </TouchableOpacity>
            ))
          )}
        </View>
      ) : (
        <>
          <View style={styles.selectedTeacherBar}>
            <View style={{ flex: 1 }}>
              <Text style={styles.selectedTeacherEyebrow}>MAESTRO SELEZIONATO</Text>
              <Text style={styles.selectedTeacherName}>
                {selectedTeacherData
                  ? getTeacherName(selectedTeacherData)
                  : selectedTeacher}
              </Text>
              <Text style={styles.selectedTeacherSchool}>
                @{selectedTeacher} • {selectedTeacherData?.danceSchool || "Scuola non inserita"}
              </Text>
            </View>

            <TouchableOpacity style={styles.changeTeacherButton} onPress={closeTeacher}>
              <Ionicons name="people-outline" size={17} color={colors.onPrimary} />
              <Text style={styles.changeTeacherText}>Cambia</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.summaryCard}>
            <Text style={styles.summarySectionLabel}>RIEPILOGO</Text>

            <View style={styles.statsGrid}>
              <View style={styles.statBox}>
                <Text style={styles.statNumber}>€{safeTotalRevenue}</Text>
                <Text style={styles.statLabel}>Totale generato</Text>
              </View>

              <View style={styles.statBox}>
                <Text style={[styles.statNumber, { color: colors.success }]}>
                  €{safeAmountPaid}
                </Text>
                <Text style={styles.statLabel}>Pagato</Text>
              </View>

              <View style={styles.statBox}>
                <Text style={styles.statNumber}>{safeCompletedGuests}</Text>
                <Text style={styles.statLabel}>Persone</Text>
              </View>

              <View style={styles.statBox}>
                <Text style={styles.statNumber}>{safeCompletedRooms}</Text>
                <Text style={styles.statLabel}>Camere</Text>
              </View>
            </View>

            <View
              style={[
                styles.paymentStatusBox,
                paymentStatus === "PAGATO" && styles.paymentStatusPaid,
                paymentStatus === "PARZIALE" && styles.paymentStatusPartial,
                paymentStatus === "NON PAGATO" && styles.paymentStatusUnpaid,
              ]}
            >
              <View style={styles.paymentStatusTop}>
                <View
                  style={[
                    styles.paymentStatusDot,
                    {
                      backgroundColor:
                        paymentStatus === "PAGATO"
                          ? "#22C55E"
                          : paymentStatus === "PARZIALE"
                            ? "#F59E0B"
                            : "#EF4444",
                    },
                  ]}
                />

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
              </View>

              <View style={styles.paymentAmountsRow}>
                <View style={styles.paymentAmountBox}>
                  <Text style={styles.paymentAmountLabel}>Pagato</Text>
                  <Text style={styles.paymentAmountValue}>€{safeAmountPaid}</Text>
                </View>

                <View style={styles.paymentAmountDivider} />

                <View style={styles.paymentAmountBox}>
                  <Text style={styles.paymentAmountLabel}>Residuo</Text>
                  <Text style={styles.paymentAmountValue}>€{safeRemainingAmount}</Text>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Appunto pagamento</Text>

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
              <Ionicons name="save-outline" size={20} color={colors.onPrimary} />
              <Text style={styles.saveButtonText}>Salva appunto</Text>
            </TouchableOpacity>

            {selectedPayment ? (
              <View style={styles.savedNoteBox}>
                <Text style={styles.savedNoteTitle}>Appunto salvato</Text>
                <Text style={styles.savedNoteText}>
                  Pagare: €{selectedPayment.amountToPay || "0"}
                </Text>

                {selectedPayment.note ? (
                  <Text style={styles.savedNoteText}>
                    {selectedPayment.note}
                  </Text>
                ) : null}
              </View>
            ) : null}
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Camere e pack</Text>
            <Text style={styles.roomDetailsHelp}>
              Tocca una tipologia per vedere camere e persone.
            </Text>

            {completedGuests.length === 0 ? (
              <Text style={styles.emptyText}>
                Nessuna persona completa trovata per questo maestro.
              </Text>
            ) : (
              roomTypes.map((type) => {
                const rooms = getRoomsByType(type).filter((room) =>
                  (room.guests || []).some((guest) => isGuestComplete(guest)),
                );

                if (rooms.length === 0) return null;

                const guestCount = rooms.reduce(
                  (sum, room) =>
                    sum +
                    (room.guests || []).filter((guest) => isGuestComplete(guest)).length,
                  0,
                );

                const expanded = expandedRoomTypes[type];

                return (
                  <View key={type} style={styles.roomTypeAccordion}>
                    <TouchableOpacity
                      style={styles.roomTypeHeader}
                      onPress={() => toggleRoomType(type)}
                    >
                      <View style={styles.roomTypeIconBox}>
                        <Ionicons name="bed-outline" size={18} color={colors.primary} />
                      </View>

                      <View style={{ flex: 1 }}>
                        <Text style={styles.roomTypeTitle}>{type}</Text>
                        <Text style={styles.roomTypeMeta}>
                          {rooms.length} {rooms.length === 1 ? "camera" : "camere"} • {guestCount} persone
                        </Text>
                      </View>

                      <Ionicons
                        name={expanded ? "chevron-up-outline" : "chevron-down-outline"}
                        size={20}
                        color={colors.secondary}
                      />
                    </TouchableOpacity>

                    {expanded ? (
                      <View style={styles.roomTypeContent}>
                        {rooms.map((room) => {
                          const guests = (room.guests || []).filter((guest) =>
                            isGuestComplete(guest),
                          );

                          return (
                            <View key={room.id} style={styles.compactRoomBox}>
                              <Text style={styles.compactRoomTitle}>
                                {getRoomLabel(room)}
                              </Text>

                              {guests.map((guest, index) => (
                                <View
                                  key={`${room.id}-${index}`}
                                  style={[
                                    styles.compactGuestRow,
                                    index > 0 && styles.compactGuestRowBorder,
                                  ]}
                                >
                                  <View style={styles.guestInfo}>
                                    <Text style={styles.compactGuestName}>
                                      {getGuestFullName(guest)}
                                    </Text>
                                    <Text style={styles.compactGuestPack}>
                                      Pack {guest.selectedPackLetter || "-"} • €{guest.selectedPackPrice || "0"}
                                    </Text>
                                  </View>

                                  <Text style={styles.compactGuestPrice}>
                                    €{getGuestPrice(guest)}
                                  </Text>
                                </View>
                              ))}
                            </View>
                          );
                        })}
                      </View>
                    ) : null}
                  </View>
                );
              })
            )}
          </View>
        </>
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
      paddingBottom: 100,
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
      fontSize: 29,
      fontWeight: "900",
      marginBottom: 10,
    },

    subtitle: {
      color: colors.secondary,
      fontSize: 12,
      lineHeight: 18,
      marginBottom: 16,
    },

    card: {
      backgroundColor: colors.card,
      borderRadius: 20,
      padding: 14,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },

    cardTitle: {
      color: colors.text,
      fontSize: 17,
      fontWeight: "900",
      marginBottom: 12,
    },

    teacherPickerHeader: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      marginBottom: 12,
    },

    teacherPickerSubtitle: {
      color: colors.secondary,
      fontSize: 11,
      lineHeight: 16,
      fontWeight: "700",
      marginTop: -10,
    },

    teacherCountPill: {
      minWidth: 34,
      height: 34,
      borderRadius: 11,
      backgroundColor: `${colors.primary}16`,
      alignItems: "center",
      justifyContent: "center",
      marginLeft: 10,
    },

    teacherCountText: {
      color: colors.primary,
      fontSize: 12,
      fontWeight: "900",
    },

    teacherSearchBox: {
      height: 46,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
      paddingHorizontal: 12,
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 10,
    },

    teacherSearchInput: {
      flex: 1,
      color: colors.text,
      fontSize: 12,
      fontWeight: "700",
      marginLeft: 7,
    },

    compactTeacherButton: {
      minHeight: 62,
      borderRadius: 15,
      padding: 8,
      marginBottom: 7,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
      flexDirection: "row",
      alignItems: "center",
    },

    compactTeacherAvatar: {
      width: 42,
      height: 42,
      borderRadius: 13,
      backgroundColor: `${colors.primary}12`,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 9,
    },

    compactTeacherName: {
      color: colors.text,
      fontSize: 13,
      fontWeight: "900",
    },

    compactTeacherSchool: {
      color: colors.secondary,
      fontSize: 9,
      fontWeight: "700",
      marginTop: 3,
    },

    selectedTeacherBar: {
      backgroundColor: colors.card,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 13,
      marginBottom: 12,
      flexDirection: "row",
      alignItems: "center",
    },

    selectedTeacherEyebrow: {
      color: colors.primary,
      fontSize: 8,
      fontWeight: "900",
      letterSpacing: 1,
      marginBottom: 3,
    },

    selectedTeacherName: {
      color: colors.text,
      fontSize: 16,
      fontWeight: "900",
    },

    selectedTeacherSchool: {
      color: colors.secondary,
      fontSize: 9,
      fontWeight: "700",
      marginTop: 3,
    },

    changeTeacherButton: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      minHeight: 38,
      paddingHorizontal: 10,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      marginLeft: 9,
    },

    changeTeacherText: {
      color: colors.onPrimary,
      fontSize: 9,
      fontWeight: "900",
      marginLeft: 4,
    },

    summarySectionLabel: {
      color: colors.primary,
      fontSize: 8,
      fontWeight: "900",
      letterSpacing: 1.2,
      marginBottom: 9,
    },

    paymentStatusTop: {
      flexDirection: "row",
      alignItems: "center",
    },

    paymentStatusDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      marginRight: 7,
    },

    paymentAmountsRow: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 10,
    },

    paymentAmountBox: {
      flex: 1,
    },

    paymentAmountDivider: {
      width: 1,
      height: 28,
      backgroundColor: colors.border,
      marginHorizontal: 12,
    },

    paymentAmountLabel: {
      color: colors.secondary,
      fontSize: 9,
      fontWeight: "800",
    },

    paymentAmountValue: {
      color: colors.text,
      fontSize: 14,
      fontWeight: "900",
      marginTop: 2,
    },

    roomDetailsHelp: {
      color: colors.secondary,
      fontSize: 10,
      lineHeight: 15,
      fontWeight: "700",
      marginTop: -10,
      marginBottom: 12,
    },

    roomTypeAccordion: {
      backgroundColor: colors.background,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 8,
      overflow: "hidden",
    },

    roomTypeHeader: {
      minHeight: 58,
      paddingHorizontal: 11,
      paddingVertical: 9,
      flexDirection: "row",
      alignItems: "center",
    },

    roomTypeIconBox: {
      width: 36,
      height: 36,
      borderRadius: 11,
      backgroundColor: `${colors.primary}12`,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 9,
    },

    roomTypeMeta: {
      color: colors.secondary,
      fontSize: 9,
      fontWeight: "700",
      marginTop: 2,
    },

    roomTypeContent: {
      borderTopWidth: 1,
      borderTopColor: colors.border,
      padding: 8,
    },

    compactRoomBox: {
      backgroundColor: colors.card,
      borderRadius: 13,
      padding: 9,
      marginBottom: 7,
    },

    compactRoomTitle: {
      color: colors.text,
      fontSize: 12,
      fontWeight: "900",
      marginBottom: 5,
    },

    compactGuestRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 7,
    },

    compactGuestRowBorder: {
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },

    compactGuestName: {
      color: colors.text,
      fontSize: 11,
      fontWeight: "900",
    },

    compactGuestPack: {
      color: colors.secondary,
      fontSize: 9,
      fontWeight: "700",
      marginTop: 2,
    },

    compactGuestPrice: {
      color: colors.success,
      fontSize: 11,
      fontWeight: "900",
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
      borderRadius: 20,
      padding: 13,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.border,
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
      flexWrap: "wrap",
      justifyContent: "space-between",
      rowGap: 8,
    },

    statBox: {
      width: "48.5%",
      backgroundColor: colors.background,
      borderRadius: 14,
      paddingVertical: 10,
      paddingHorizontal: 7,
      alignItems: "center",
      borderWidth: 1,
      borderColor: colors.border,
    },

    statNumber: {
      color: colors.primary,
      fontSize: 18,
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
      minHeight: 78,
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
      borderRadius: 14,
      padding: 11,
      marginTop: 9,
      borderWidth: 1,
      borderColor: colors.border,
    },

    paymentStatusText: {
      color: colors.primary,
      fontSize: 15,
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
