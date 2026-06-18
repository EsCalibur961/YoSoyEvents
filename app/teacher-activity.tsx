import { Ionicons } from "@expo/vector-icons";
import * as Print from "expo-print";
import { router, useFocusEffect } from "expo-router";
import * as Sharing from "expo-sharing";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { useCallback, useMemo, useState } from "react";
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

type TeacherActivity = {
  id: string;
  teacherUsername: string;
  action: string;
  details: string;
  createdAt: string;
};

type TeacherUser = {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  danceSchool: string;
  isOnline?: boolean;
  lastSeen?: any;
};

type Guest = {
  firstName: string;
  lastName: string;
  birthDate: string;
  birthPlace: string;
  selectedPackId: string;
  selectedPackLetter: string;
  selectedPackPrice: string;
};

type RoomData = {
  id: string;
  teacherUsername: string;
  roomType: RoomType;
  roomIndex: number;
  customName?: string;
  guests: Guest[];
};

const roomTypes: RoomType[] = ["Doppia", "Tripla", "Quadrupla"];

export default function TeacherActivityScreen() {
  const { colors, isDark } = useTheme();
  const styles = createStyles(colors, isDark);
  const [activities, setActivities] = useState<TeacherActivity[]>([]);
  const [teachers, setTeachers] = useState<TeacherUser[]>([]);
  const [roomsData, setRoomsData] = useState<RoomData[]>([]);
  const [selectedTeacher, setSelectedTeacher] = useState<string | null>(null);
  const [loadingPdf, setLoadingPdf] = useState(false);

  useFocusEffect(
    useCallback(() => {
      const activitiesQuery = query(
        collection(db, "teacherActivities"),
        orderBy("createdAtServer", "desc"),
      );

      const unsubActivities = onSnapshot(activitiesQuery, (snapshot) => {
        const data: TeacherActivity[] = snapshot.docs.map((item) => ({
          id: item.id,
          ...(item.data() as Omit<TeacherActivity, "id">),
        }));

        setActivities(data);
      });

      const unsubTeachers = onSnapshot(
        collection(db, "teachers"),
        (snapshot) => {
          const data: TeacherUser[] = snapshot.docs.map((item) => ({
            id: item.id,
            ...(item.data() as Omit<TeacherUser, "id">),
          }));

          setTeachers(data);
        },
      );

      const unsubRooms = onSnapshot(collection(db, "roomsData"), (snapshot) => {
        const data: RoomData[] = snapshot.docs.map((item) => ({
          id: item.id,
          ...(item.data() as Omit<RoomData, "id">),
        }));

        setRoomsData(data);
      });

      return () => {
        unsubActivities();
        unsubTeachers();
        unsubRooms();
      };
    }, []),
  );

  const normalizeGuest = (guest: any): Guest => ({
    firstName: guest.firstName || "",
    lastName: guest.lastName || "",
    birthDate: guest.birthDate || "",
    birthPlace: guest.birthPlace || "",
    selectedPackId: guest.selectedPackId || "",
    selectedPackLetter: guest.selectedPackLetter || "",
    selectedPackPrice: guest.selectedPackPrice || "",
  });

  const normalizeRoom = (room: any): RoomData => ({
    ...room,
    customName: room.customName || "",
    guests: room.guests
      ? room.guests.map((guest: any) => normalizeGuest(guest))
      : [],
  });

  const normalizedRooms = roomsData.map((room) => normalizeRoom(room));

  const selectedTeacherData = teachers.find(
    (teacher) => teacher.username === selectedTeacher,
  );

  const selectedTeacherRooms = useMemo(() => {
    if (!selectedTeacher) return [];

    return normalizedRooms.filter(
      (room) => room.teacherUsername === selectedTeacher,
    );
  }, [normalizedRooms, selectedTeacher]);

  const selectedTeacherActivities = useMemo(() => {
    if (!selectedTeacher) return [];

    return activities.filter(
      (activity) => activity.teacherUsername === selectedTeacher,
    );
  }, [activities, selectedTeacher]);

  const getTeacherName = (username: string) => {
    const teacher = teachers.find((item) => item.username === username);

    if (!teacher) return username;

    return `${teacher.firstName} ${teacher.lastName}`.trim() || username;
  };

  const getTeacherSchool = (username: string) => {
    const teacher = teachers.find((item) => item.username === username);

    return teacher?.danceSchool || "Scuola non disponibile";
  };

  const getGuestFullName = (guest: Guest) => {
    return `${guest.firstName} ${guest.lastName}`.trim();
  };

  const isGuestComplete = (guest: Guest) => {
    return (
      guest.firstName.trim() &&
      guest.lastName.trim() &&
      guest.birthDate.trim() &&
      guest.birthPlace.trim() &&
      guest.selectedPackId.trim()
    );
  };

  const getRoomLabel = (room: RoomData) => {
    if (room.customName?.trim()) return room.customName.trim();

    return `${room.roomType} #${room.roomIndex}`;
  };

  const completeRooms = selectedTeacherRooms.filter((room) =>
    room.guests.some((guest) => isGuestComplete(guest)),
  );

  const completedRoomsCount = completeRooms.length;

  const totalGuests = completeRooms.reduce((sum, room) => {
    return sum + room.guests.filter((guest) => isGuestComplete(guest)).length;
  }, 0);

  const totalPacks = completeRooms.reduce((sum, room) => {
    return sum + room.guests.filter((guest) => guest.selectedPackId).length;
  }, 0);

  const toggleTeacher = (username: string) => {
    if (selectedTeacher === username) {
      setSelectedTeacher(null);
    } else {
      setSelectedTeacher(username);
    }
  };

  const getTimestampMillis = (value: any) => {
    if (!value) return 0;
    if (typeof value?.toMillis === "function") return value.toMillis();
    if (value instanceof Date) return value.getTime();
    if (typeof value === "number") return value;

    const parsed = new Date(value).getTime();
    return Number.isNaN(parsed) ? 0 : parsed;
  };

  const isTeacherOnline = (teacher?: TeacherUser | null) => {
    if (!teacher) return false;

    const lastSeenMillis = getTimestampMillis(teacher.lastSeen);
    const seenRecently = lastSeenMillis > 0 && Date.now() - lastSeenMillis < 90 * 1000;

    return Boolean(teacher.isOnline && seenRecently);
  };

  const generatePdf = async () => {
    if (!selectedTeacher) {
      Alert.alert("Maestro mancante", "Seleziona prima un maestro.");
      return;
    }

    if (completeRooms.length === 0) {
      Alert.alert(
        "Nessuna camera",
        "Questo maestro non ha ancora camere complete da esportare.",
      );
      return;
    }

    try {
      setLoadingPdf(true);
    } catch (error: any) {
      console.log("ERRORE PDF:", error);

      Alert.alert("Errore PDF", String(error?.message || error));
    } finally {
      setLoadingPdf(false);
    }

    const teacherName = getTeacherName(selectedTeacher);
    const teacherSchool = getTeacherSchool(selectedTeacher);

    let html = `
      <html>
      <head>
        <meta charset="utf-8" />
        <style>
          body {
            font-family: Arial, sans-serif;
            padding: 24px;
            color: #111;
          }

          h1 {
            text-align: center;
            margin-bottom: 6px;
            font-size: 26px;
          }

          h2 {
            text-align: center;
            margin-top: 0;
            margin-bottom: 28px;
            font-size: 18px;
            color: #555;
          }

          .teacher-box {
            border: 2px solid #111;
            border-radius: 14px;
            padding: 18px;
            margin-bottom: 26px;
          }

          .teacher-title {
            font-size: 22px;
            font-weight: bold;
            margin-bottom: 6px;
          }

          .teacher-school {
            font-size: 15px;
            color: #555;
            margin-bottom: 10px;
          }

          .summary {
            font-size: 13px;
            color: #333;
          }

          .room-type {
            font-size: 20px;
            font-weight: bold;
            margin: 24px 0 12px;
            padding-bottom: 6px;
            border-bottom: 2px solid #111;
          }

          .room {
            margin-bottom: 22px;
            padding: 14px;
            border: 1px solid #CCC;
            border-radius: 10px;
          }

          .room-title {
            font-size: 17px;
            font-weight: bold;
            margin-bottom: 12px;
          }

          table {
            width: 100%;
            border-collapse: collapse;
          }

          th, td {
            border: 1px solid #DDD;
            padding: 8px;
            text-align: left;
            font-size: 12px;
          }

          th {
            background-color: #EEE;
            font-weight: bold;
          }

          .footer {
            margin-top: 30px;
            text-align: center;
            font-size: 11px;
            color: #777;
          }
        </style>
      </head>

      <body>
        <h1>YO SOY EVENTS</h1>
        <h2>Lista camere maestro</h2>

        <div class="teacher-box">
          <div class="teacher-title">${teacherName}</div>
          <div class="teacher-school">${teacherSchool}</div>
          <div class="summary">
            Camere complete: ${completedRoomsCount} | Ospiti inseriti: ${totalGuests} | Pack selezionati: ${totalPacks}
          </div>
        </div>
      `;

    roomTypes.forEach((type) => {
      const roomsByType = completeRooms.filter(
        (room) => room.roomType === type,
      );

      if (roomsByType.length === 0) return;

      html += `<div class="room-type">${type}</div>`;

      roomsByType.forEach((room) => {
        const completeGuests = room.guests.filter((guest) =>
          isGuestComplete(guest),
        );

        if (completeGuests.length === 0) return;

        html += `
            <div class="room">
              <div class="room-title">${getRoomLabel(room)}</div>

              <table>
                <tr>
                  <th>#</th>
                  <th>Nome</th>
                  <th>Cognome</th>
                  <th>Data nascita</th>
                  <th>Luogo nascita</th>
                  <th>Pack</th>
                </tr>
          `;

        completeGuests.forEach((guest, index) => {
          html += `
              <tr>
                <td>${index + 1}</td>
                <td>${guest.firstName || "-"}</td>
                <td>${guest.lastName || "-"}</td>
                <td>${guest.birthDate || "-"}</td>
                <td>${guest.birthPlace || "-"}</td>
                <td>Pack ${guest.selectedPackLetter} - €${guest.selectedPackPrice}</td>
              </tr>
            `;
        });

        html += `
              </table>
            </div>
          `;
      });
    });

    html += `
        <div class="footer">
          Documento generato da YoSoy Events
        </div>
      </body>
      </html>
      `;
    try {
      const { uri } = await Print.printToFileAsync({ html });

      await Sharing.shareAsync(uri);

      setLoadingPdf(false);
    } catch (error) {
      setLoadingPdf(false);

      Alert.alert("Errore", "Non è stato possibile generare il PDF.");
    }
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

      <Text style={styles.title}>Monitoraggio maestri</Text>

      <Text style={styles.subtitle}>
        Seleziona un maestro, controlla le attività live ed esporta il PDF solo
        del maestro selezionato.
      </Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Seleziona maestro</Text>

        {teachers.length === 0 ? (
          <Text style={styles.emptyText}>Nessun maestro registrato.</Text>
        ) : (
          teachers.map((teacher) => (
            <TouchableOpacity
              key={teacher.id}
              style={[
                styles.teacherButton,
                selectedTeacher === teacher.username &&
                  styles.teacherButtonActive,
              ]}
              onPress={() => toggleTeacher(teacher.username)}
            >
              <View style={styles.teacherButtonInfo}>
                <Text style={styles.teacherButtonName}>
                  {teacher.firstName} {teacher.lastName}
                </Text>

                <Text style={styles.teacherButtonSchool}>
                  @{teacher.username} • {teacher.danceSchool}
                </Text>

                <View style={styles.onlineRow}>
                  <View
                    style={[
                      styles.onlineDot,
                      {
                        backgroundColor: isTeacherOnline(teacher)
                          ? colors.success
                          : colors.danger,
                      },
                    ]}
                  />

                  <Text
                    style={[
                      styles.onlineText,
                      {
                        color: isTeacherOnline(teacher)
                          ? colors.success
                          : colors.danger,
                      },
                    ]}
                  >
                    {isTeacherOnline(teacher) ? "Online" : "Offline"}
                  </Text>
                </View>
              </View>

              <Ionicons
                name={
                  selectedTeacher === teacher.username
                    ? "checkmark-circle"
                    : "ellipse-outline"
                }
                size={24}
                color={
                  selectedTeacher === teacher.username ? colors.primary : colors.secondary
                }
              />
            </TouchableOpacity>
          ))
        )}
      </View>

      {selectedTeacher ? (
        <>
          <View style={styles.teacherCard}>
            <Text style={styles.teacherName}>
              {getTeacherName(selectedTeacher)}
            </Text>

            <Text style={styles.teacherSchool}>
              {getTeacherSchool(selectedTeacher)}
            </Text>

            <View style={styles.selectedOnlineRow}>
              <View
                style={[
                  styles.onlineDot,
                  {
                    backgroundColor: isTeacherOnline(selectedTeacherData)
                      ? colors.success
                      : colors.danger,
                  },
                ]}
              />

              <Text
                style={[
                  styles.onlineText,
                  {
                    color: isTeacherOnline(selectedTeacherData)
                      ? colors.success
                      : colors.danger,
                  },
                ]}
              >
                {isTeacherOnline(selectedTeacherData) ? "Online" : "Offline"}
              </Text>
            </View>

            <View style={styles.liveStats}>
              <View style={styles.liveStatBox}>
                <Text style={styles.liveStatNumber}>{completedRoomsCount}</Text>
                <Text style={styles.liveStatLabel}>Camere complete</Text>
              </View>

              <View style={styles.liveStatBox}>
                <Text style={styles.liveStatNumber}>{totalGuests}</Text>
                <Text style={styles.liveStatLabel}>Ospiti inseriti</Text>
              </View>

              <View style={styles.liveStatBox}>
                <Text style={styles.liveStatNumber}>{totalPacks}</Text>
                <Text style={styles.liveStatLabel}>Pack selezionati</Text>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.pdfButton, loadingPdf && styles.pdfButtonDisabled]}
              onPress={generatePdf}
              disabled={loadingPdf}
            >
              <Ionicons
                name={
                  loadingPdf ? "hourglass-outline" : "document-text-outline"
                }
                size={24}
                color={colors.text}
              />

              <Text style={styles.pdfButtonText}>
                {loadingPdf
                  ? "Generazione PDF..."
                  : "Esporta PDF maestro selezionato"}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.activitiesCard}>
            <Text style={styles.activitiesTitle}>Attività live</Text>

            {selectedTeacherActivities.length === 0 ? (
              <View style={styles.emptyMiniBox}>
                <Text style={styles.emptyText}>
                  Nessuna attività registrata per questo maestro.
                </Text>
              </View>
            ) : (
              selectedTeacherActivities.map((activity) => (
                <View key={activity.id} style={styles.activityCard}>
                  <View style={styles.activityHeader}>
                    <Ionicons name="pulse-outline" size={20} color={colors.primary} />

                    <Text style={styles.activityAction}>{activity.action}</Text>
                  </View>

                  <Text style={styles.activityDetails}>{activity.details}</Text>

                  <Text style={styles.activityDate}>{activity.createdAt}</Text>
                </View>
              ))
            )}
          </View>
        </>
      ) : (
        <View style={styles.emptyBox}>
          <Ionicons name="people-outline" size={50} color={colors.secondary} />

          <Text style={styles.emptyTitle}>Nessun maestro selezionato</Text>

          <Text style={styles.emptyText}>
            Seleziona un maestro per vedere attività ed esportare il PDF.
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const createStyles = (colors: any, isDark: boolean) => StyleSheet.create({
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
    borderRadius: 26,
    padding: 18,
    marginBottom: 22,
  },

  cardTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "900",
    marginBottom: 16,
  },

  teacherButton: {
    backgroundColor: colors.background,
    borderRadius: 18,
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
  },

  teacherButtonInfo: {
    flex: 1,
    paddingRight: 12,
  },

  teacherButtonName: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "900",
  },

  teacherButtonSchool: {
    color: colors.secondary,
    fontSize: 14,
    marginTop: 4,
  },

  onlineRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
  },

  selectedOnlineRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },

  onlineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },

  onlineText: {
    fontSize: 13,
    fontWeight: "900",
  },

  teacherCard: {
    backgroundColor: colors.card,
    borderRadius: 28,
    padding: 20,
    marginBottom: 22,
  },

  teacherName: {
    color: colors.text,
    fontSize: 24,
    fontWeight: "900",
  },

  teacherSchool: {
    color: colors.secondary,
    fontSize: 15,
    marginTop: 5,
    marginBottom: 18,
  },

  liveStats: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 18,
  },

  liveStatBox: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: 18,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
  },

  liveStatNumber: {
    color: colors.primary,
    fontSize: 18,
    fontWeight: "900",
    marginBottom: 4,
  },

  liveStatLabel: {
    color: colors.secondary,
    fontSize: 11,
    fontWeight: "800",
    textAlign: "center",
  },

  pdfButton: {
    backgroundColor: colors.primary,
    borderRadius: 22,
    paddingVertical: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },

  pdfButtonDisabled: {
    opacity: 0.6,
  },

  pdfButtonText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "900",
    marginLeft: 10,
    textAlign: "center",
  },

  activitiesCard: {
    backgroundColor: colors.card,
    borderRadius: 26,
    padding: 18,
    marginBottom: 22,
  },

  activitiesTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "900",
    marginBottom: 16,
  },

  activityCard: {
    backgroundColor: colors.background,
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },

  activityHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },

  activityAction: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "900",
    marginLeft: 8,
  },

  activityDetails: {
    color: colors.secondary,
    fontSize: 14,
    lineHeight: 22,
  },

  activityDate: {
    color: colors.placeholder,
    fontSize: 12,
    marginTop: 12,
    fontWeight: "800",
  },

  emptyBox: {
    backgroundColor: colors.card,
    borderRadius: 26,
    padding: 30,
    alignItems: "center",
  },

  emptyMiniBox: {
    backgroundColor: colors.background,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },

  emptyTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "900",
    marginTop: 14,
    marginBottom: 8,
  },

  emptyText: {
    color: colors.secondary,
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
  },
});
