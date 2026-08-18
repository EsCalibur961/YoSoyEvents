import { Ionicons } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system/legacy";
import * as Print from "expo-print";
import { router, useFocusEffect } from "expo-router";
import * as Sharing from "expo-sharing";
import * as XLSX from "xlsx";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { useCallback, useMemo, useState } from "react";
import {
  Alert,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { db } from "../firebase";
import { useTheme } from "../contexts/ThemeContext";

type RoomType = "Doppia" | "Tripla" | "Quadrupla";

type ActivityGuestSnapshot = {
  position?: number;
  firstName?: string;
  lastName?: string;
  birthDate?: string;
  birthPlace?: string;
  selectedPackId?: string;
  selectedPackLetter?: string;
  selectedPackPrice?: string;
  notes?: string;
  isComplete?: boolean;
};

type ActivityRoomSnapshot = {
  roomId?: string;
  roomType?: RoomType;
  roomIndex?: number;
  roomLabel?: string;
  occupiedPlaces?: number;
  completeGuests?: number;
  isComplete?: boolean;
  guests?: ActivityGuestSnapshot[];
};

type TeacherActivity = {
  id: string;
  teacherUsername: string;
  action: string;
  details: string;
  createdAt: string;
  completedRooms?: number;
  totalRooms?: number;
  occupiedPlaces?: number;
  roomSnapshot?: ActivityRoomSnapshot[];
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
  notes?: string;
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
  const [teacherPickerOpen, setTeacherPickerOpen] = useState(false);
  const [teacherSearch, setTeacherSearch] = useState("");
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [loadingExcel, setLoadingExcel] = useState(false);

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
    notes: guest.notes || "",
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

  const filteredTeachers = useMemo(() => {
    const search = teacherSearch.trim().toLowerCase();

    return [...teachers]
      .filter((teacher) => {
        if (!search) return true;

        return [
          teacher.firstName,
          teacher.lastName,
          teacher.username,
          teacher.danceSchool,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(search);
      })
      .sort((a, b) => {
        const aOnline = isTeacherOnline(a);
        const bOnline = isTeacherOnline(b);

        if (aOnline !== bOnline) return aOnline ? -1 : 1;

        return `${a.firstName} ${a.lastName}`.localeCompare(
          `${b.firstName} ${b.lastName}`,
        );
      });
  }, [teachers, teacherSearch]);

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

  const getActivityGuestName = (guest: ActivityGuestSnapshot) => {
    const name = `${guest.firstName || ""} ${guest.lastName || ""}`.trim();
    return name || `Posto ${guest.position || "-"}`;
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

  const sanitizeFileName = (value: string) => {
    return value
      .replace(/[\\/:*?"<>|]/g, "-")
      .replace(/\s+/g, " ")
      .trim();
  };

  const generateExcel = async () => {
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
      setLoadingExcel(true);

      const teacherName = getTeacherName(selectedTeacher);
      const teacherSchool = getTeacherSchool(selectedTeacher);
      const exportDate = new Date();

      const sheetRows: any[][] = [];

      sheetRows.push(["YO SOY EVENTS"]);
      sheetRows.push(["Lista camere maestro"]);
      sheetRows.push([]);
      sheetRows.push(["Maestro", teacherName]);
      sheetRows.push(["Scuola", teacherSchool]);
      sheetRows.push(["Data esportazione", exportDate.toLocaleString("it-IT")]);
      sheetRows.push(["Camere complete", completedRoomsCount]);
      sheetRows.push(["Ospiti inseriti", totalGuests]);
      sheetRows.push(["Pack selezionati", totalPacks]);
      sheetRows.push([]);

      roomTypes.forEach((type) => {
        const roomsByType = completeRooms
          .filter((room) => room.roomType === type)
          .sort((a, b) => {
            const labelCompare = getRoomLabel(a).localeCompare(getRoomLabel(b));
            if (labelCompare !== 0) return labelCompare;
            return a.roomIndex - b.roomIndex;
          });

        if (roomsByType.length === 0) return;

        sheetRows.push([type.toUpperCase()]);
        sheetRows.push([]);

        roomsByType.forEach((room) => {
          const completeGuests = room.guests.filter((guest) =>
            isGuestComplete(guest),
          );

          if (completeGuests.length === 0) return;

          sheetRows.push([getRoomLabel(room)]);
          sheetRows.push([
            "#",
            "Nome",
            "Cognome",
            "Data nascita",
            "Luogo nascita",
            "Pack",
            "Prezzo",
            "Note / Allergie / Esigenze",
          ]);

          completeGuests.forEach((guest, index) => {
            sheetRows.push([
              index + 1,
              guest.firstName || "",
              guest.lastName || "",
              guest.birthDate || "",
              guest.birthPlace || "",
              guest.selectedPackLetter
                ? `Pack ${guest.selectedPackLetter}`
                : "",
              guest.selectedPackPrice || "",
              guest.notes || "",
            ]);
          });

          sheetRows.push([]);
        });

        sheetRows.push([]);
      });

      const worksheet = XLSX.utils.aoa_to_sheet(sheetRows);

      worksheet["!cols"] = [
        { wch: 6 },
        { wch: 18 },
        { wch: 18 },
        { wch: 16 },
        { wch: 22 },
        { wch: 14 },
        { wch: 12 },
        { wch: 36 },
      ];

      worksheet["!merges"] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 7 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: 7 } },
      ];

      const range = XLSX.utils.decode_range(worksheet["!ref"] || "A1:H1");

      for (let row = range.s.r; row <= range.e.r; row++) {
        const firstCellAddress = XLSX.utils.encode_cell({ r: row, c: 0 });
        const firstCell = worksheet[firstCellAddress];
        const firstValue = firstCell?.v ? String(firstCell.v) : "";

        const isMainTitle = row === 0;
        const isSubTitle = row === 1;
        const isRoomType = roomTypes
          .map((type) => type.toUpperCase())
          .includes(firstValue);
        const isRoomTitle =
          firstValue &&
          row > 9 &&
          !["#", "Maestro", "Scuola", "Data esportazione", "Camere complete", "Ospiti inseriti", "Pack selezionati"].includes(firstValue) &&
          !isRoomType &&
          !sheetRows[row]?.[1] &&
          !sheetRows[row]?.[2];

        for (let col = range.s.c; col <= range.e.c; col++) {
          const address = XLSX.utils.encode_cell({ r: row, c: col });
          const cell = worksheet[address];

          if (!cell) continue;

          cell.s = {
            font: {
              bold:
                isMainTitle ||
                isSubTitle ||
                isRoomType ||
                isRoomTitle ||
                firstValue === "#" ||
                sheetRows[row]?.[0] === "#",
              sz: isMainTitle ? 18 : isSubTitle ? 14 : isRoomType ? 14 : 11,
              color: { rgb: isRoomType || isMainTitle ? "FFFFFF" : "111111" },
            },
            alignment: {
              vertical: "center",
              horizontal:
                isMainTitle || isSubTitle || isRoomType ? "center" : "left",
              wrapText: true,
            },
            fill:
              isMainTitle || isSubTitle
                ? { fgColor: { rgb: "061A36" } }
                : isRoomType
                  ? { fgColor: { rgb: "0B3A75" } }
                  : isRoomTitle
                    ? { fgColor: { rgb: "D9B44A" } }
                    : sheetRows[row]?.[0] === "#"
                      ? { fgColor: { rgb: "E8EEF8" } }
                      : undefined,
            border: {
              top: { style: "thin", color: { rgb: "CCCCCC" } },
              bottom: { style: "thin", color: { rgb: "CCCCCC" } },
              left: { style: "thin", color: { rgb: "CCCCCC" } },
              right: { style: "thin", color: { rgb: "CCCCCC" } },
            },
          };
        }
      }

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Camere maestro");

      const dateForFile = exportDate.toISOString().slice(0, 10);
      const fileName = sanitizeFileName(
        `${teacherName}-camere-struttura-${dateForFile}.xlsx`,
      );

      if (Platform.OS === "web") {
        const webBuffer = XLSX.write(workbook, {
          type: "array",
          bookType: "xlsx",
        });

        const blob = new Blob([webBuffer], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });

        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = fileName;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();

        setTimeout(() => URL.revokeObjectURL(url), 1000);
        return;
      }

      const base64 = XLSX.write(workbook, {
        type: "base64",
        bookType: "xlsx",
      });

      const directory = FileSystem.documentDirectory || FileSystem.cacheDirectory;

      if (!directory) {
        Alert.alert(
          "Errore Excel",
          "Cartella temporanea non disponibile. Aggiorna la build dell’app.",
        );
        return;
      }

      const fileUri = `${directory}${fileName}`;

      await FileSystem.writeAsStringAsync(fileUri, base64, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const mimeType =
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

      if (
        Platform.OS === "android" &&
        FileSystem.StorageAccessFramework?.requestDirectoryPermissionsAsync
      ) {
        const permissions =
          await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();

        if (!permissions.granted) {
          Alert.alert(
            "Salvataggio annullato",
            "Non hai selezionato una cartella. Il file Excel non è stato scaricato.",
          );
          return;
        }

        const downloadUri =
          await FileSystem.StorageAccessFramework.createFileAsync(
            permissions.directoryUri,
            fileName,
            mimeType,
          );

        await FileSystem.writeAsStringAsync(downloadUri, base64, {
          encoding: FileSystem.EncodingType.Base64,
        });

        Alert.alert(
          "Excel scaricato",
          "Il file Excel è stato salvato nella cartella selezionata.",
        );

        return;
      }

      await Sharing.shareAsync(fileUri, {
        mimeType,
        dialogTitle: "Salva Excel camere strutture",
        UTI: "com.microsoft.excel.xlsx",
      });
    } catch (error: any) {
      Alert.alert(
        "Errore Excel",
        String(error?.message || "Non è stato possibile generare il file Excel."),
      );
    } finally {
      setLoadingExcel(false);
    }
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
                  <th>Note</th>
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
                <td>${guest.notes || "-"}</td>
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
      if (Platform.OS === "web") {
        const printWindow = window.open("", "_blank");

        if (!printWindow) {
          throw new Error(
            "Il browser ha bloccato la finestra del PDF. Consenti i popup per localhost.",
          );
        }

        printWindow.document.open();
        printWindow.document.write(html);
        printWindow.document.close();

        printWindow.onload = () => {
          printWindow.focus();
          printWindow.print();
        };

        return;
      }

      const { uri } = await Print.printToFileAsync({ html });

      await Sharing.shareAsync(uri);
    } catch (error: any) {
      console.log("ERRORE PDF:", error);

      if (Platform.OS === "web") {
        window.alert(
          String(
            error?.message ||
              "Non è stato possibile aprire il documento PDF.",
          ),
        );
      } else {
        Alert.alert(
          "Errore",
          String(error?.message || "Non è stato possibile generare il PDF."),
        );
      }
    } finally {
      setLoadingPdf(false);
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

      <View style={styles.compactSelectorCard}>
        <View style={styles.compactSelectorHeader}>
          <View>
            <Text style={styles.compactSelectorEyebrow}>MAESTRO SELEZIONATO</Text>
            <Text style={styles.compactSelectorTitle}>
              {selectedTeacher
                ? getTeacherName(selectedTeacher)
                : "Nessun maestro selezionato"}
            </Text>

            {selectedTeacher ? (
              <>
                <Text style={styles.compactSelectorMeta}>
                  @{selectedTeacher} • {getTeacherSchool(selectedTeacher)}
                </Text>

                <View style={styles.compactSelectorStatusRow}>
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
              </>
            ) : (
              <Text style={styles.compactSelectorMeta}>
                Scegli un maestro per vedere subito il suo monitoraggio.
              </Text>
            )}
          </View>
        </View>

        <TouchableOpacity
          style={styles.changeTeacherButton}
          onPress={() => setTeacherPickerOpen(true)}
        >
          <Ionicons name="people-outline" size={19} color={colors.onPrimary} />
          <Text style={styles.changeTeacherButtonText}>
            {selectedTeacher ? "Cambia maestro" : "Seleziona maestro"}
          </Text>
          <Ionicons name="chevron-forward-outline" size={18} color={colors.onPrimary} />
        </TouchableOpacity>
      </View>

      <Modal
        visible={teacherPickerOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setTeacherPickerOpen(false)}
      >
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerSheet}>
            <View style={styles.pickerHandle} />

            <View style={styles.pickerHeader}>
              <View>
                <Text style={styles.pickerTitle}>Scegli maestro</Text>
                <Text style={styles.pickerSubtitle}>
                  Cerca e seleziona il maestro da monitorare.
                </Text>
              </View>

              <TouchableOpacity
                style={styles.pickerCloseButton}
                onPress={() => setTeacherPickerOpen(false)}
              >
                <Ionicons name="close" size={22} color={colors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.teacherSearchBox}>
              <Ionicons name="search-outline" size={20} color={colors.secondary} />
              <TextInput
                value={teacherSearch}
                onChangeText={setTeacherSearch}
                placeholder="Cerca nome, username o scuola"
                placeholderTextColor={colors.placeholder}
                style={styles.teacherSearchInput}
                autoCapitalize="none"
              />
              {teacherSearch ? (
                <TouchableOpacity onPress={() => setTeacherSearch("")}>
                  <Ionicons name="close-circle" size={20} color={colors.secondary} />
                </TouchableOpacity>
              ) : null}
            </View>

            <ScrollView
              style={styles.pickerList}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {filteredTeachers.length === 0 ? (
                <View style={styles.pickerEmpty}>
                  <Ionicons name="search-outline" size={36} color={colors.secondary} />
                  <Text style={styles.emptyText}>Nessun maestro trovato.</Text>
                </View>
              ) : (
                filteredTeachers.map((teacher) => {
                  const selected = selectedTeacher === teacher.username;
                  const online = isTeacherOnline(teacher);

                  return (
                    <TouchableOpacity
                      key={teacher.id}
                      style={[
                        styles.pickerTeacherRow,
                        selected && styles.pickerTeacherRowSelected,
                      ]}
                      onPress={() => {
                        setSelectedTeacher(teacher.username);
                        setTeacherPickerOpen(false);
                        setTeacherSearch("");
                      }}
                    >
                      <View
                        style={[
                          styles.pickerAvatar,
                          {
                            backgroundColor: online
                              ? `${colors.success}18`
                              : colors.cardAlt,
                          },
                        ]}
                      >
                        <Ionicons
                          name="person-outline"
                          size={20}
                          color={online ? colors.success : colors.secondary}
                        />
                      </View>

                      <View style={styles.pickerTeacherInfo}>
                        <Text style={styles.pickerTeacherName}>
                          {teacher.firstName} {teacher.lastName}
                        </Text>
                        <Text style={styles.pickerTeacherMeta}>
                          @{teacher.username} • {teacher.danceSchool || "Scuola non inserita"}
                        </Text>
                        <Text
                          style={[
                            styles.pickerTeacherStatus,
                            { color: online ? colors.success : colors.danger },
                          ]}
                        >
                          {online ? "Online" : "Offline"}
                        </Text>
                      </View>

                      <Ionicons
                        name={selected ? "checkmark-circle" : "chevron-forward-outline"}
                        size={22}
                        color={selected ? colors.primary : colors.secondary}
                      />
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {selectedTeacher ? (
        <>
          <View style={styles.teacherCard}>
            <View style={styles.monitoringHeader}>
              <View>
                <Text style={styles.monitoringEyebrow}>RIEPILOGO LIVE</Text>
                <Text style={styles.monitoringTitle}>
                  {getTeacherName(selectedTeacher)}
                </Text>
              </View>

              <View
                style={[
                  styles.monitoringStatusPill,
                  {
                    backgroundColor: isTeacherOnline(selectedTeacherData)
                      ? `${colors.success}18`
                      : `${colors.danger}14`,
                  },
                ]}
              >
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
              disabled={loadingPdf || loadingExcel}
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

            <TouchableOpacity
              style={[
                styles.excelButton,
                loadingExcel && styles.pdfButtonDisabled,
              ]}
              onPress={generateExcel}
              disabled={loadingPdf || loadingExcel}
            >
              <Ionicons
                name={loadingExcel ? "hourglass-outline" : "grid-outline"}
                size={24}
                color={colors.text}
              />

              <Text style={styles.pdfButtonText}>
                {loadingExcel
                  ? "Generazione Excel..."
                  : "Scarica Excel per strutture"}
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
                    <View style={styles.activityIconBox}>
                      <Ionicons name="pulse-outline" size={20} color={colors.primary} />
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text style={styles.activityAction}>{activity.action}</Text>
                      <Text style={styles.activityDate}>{activity.createdAt}</Text>
                    </View>
                  </View>

                  <View style={styles.activitySummaryRow}>
                    <View style={styles.activitySummaryItem}>
                      <Text style={styles.activitySummaryValue}>
                        {activity.completedRooms ?? "-"}
                      </Text>
                      <Text style={styles.activitySummaryLabel}>Camere complete</Text>
                    </View>

                    <View style={styles.activitySummaryDivider} />

                    <View style={styles.activitySummaryItem}>
                      <Text style={styles.activitySummaryValue}>
                        {activity.occupiedPlaces ?? "-"}
                      </Text>
                      <Text style={styles.activitySummaryLabel}>Posti segnati</Text>
                    </View>
                  </View>

                  {activity.roomSnapshot?.length ? (
                    <View style={styles.activityRooms}>
                      {activity.roomSnapshot.map((room, roomIndex) => (
                        <View
                          key={`${activity.id}-${room.roomId || roomIndex}`}
                          style={styles.activityRoomCard}
                        >
                          <View style={styles.activityRoomHeader}>
                            <View style={styles.activityRoomTitleWrap}>
                              <Ionicons name="bed-outline" size={17} color={colors.primary} />
                              <Text style={styles.activityRoomTitle}>
                                {room.roomLabel ||
                                  `${room.roomType || "Camera"} #${room.roomIndex || roomIndex + 1}`}
                              </Text>
                            </View>

                            <View
                              style={[
                                styles.activityRoomStatus,
                                {
                                  backgroundColor: room.isComplete
                                    ? `${colors.success}18`
                                    : `${colors.warning}18`,
                                },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.activityRoomStatusText,
                                  {
                                    color: room.isComplete
                                      ? colors.success
                                      : colors.warning,
                                  },
                                ]}
                              >
                                {room.isComplete ? "Completa" : "In compilazione"}
                              </Text>
                            </View>
                          </View>

                          {(room.guests || []).map((guest, guestIndex) => (
                            <View
                              key={`${activity.id}-${room.roomId || roomIndex}-${guestIndex}`}
                              style={[
                                styles.activityGuestRow,
                                guestIndex > 0 && {
                                  borderTopWidth: 1,
                                  borderTopColor: colors.border,
                                },
                              ]}
                            >
                              <View style={styles.activityGuestPosition}>
                                <Text style={styles.activityGuestPositionText}>
                                  {guest.position || guestIndex + 1}
                                </Text>
                              </View>

                              <View style={styles.activityGuestInfo}>
                                <Text style={styles.activityGuestName}>
                                  {getActivityGuestName(guest)}
                                </Text>

                                <Text style={styles.activityGuestMeta}>
                                  {guest.birthDate || "Data n/d"} • {guest.birthPlace || "Luogo n/d"}
                                </Text>

                                <View style={styles.activityGuestBottom}>
                                  <View style={styles.activityPackPill}>
                                    <Ionicons name="ticket-outline" size={13} color={colors.primary} />
                                    <Text style={styles.activityPackText}>
                                      {guest.selectedPackLetter
                                        ? `Pack ${guest.selectedPackLetter}`
                                        : "Pack non indicato"}
                                      {guest.selectedPackPrice
                                        ? ` • €${guest.selectedPackPrice}`
                                        : ""}
                                    </Text>
                                  </View>
                                </View>

                                {guest.notes?.trim() ? (
                                  <View style={styles.activityNotesBox}>
                                    <Ionicons
                                      name="document-text-outline"
                                      size={13}
                                      color={colors.warning}
                                    />
                                    <Text style={styles.activityNotesText}>{guest.notes}</Text>
                                  </View>
                                ) : null}
                              </View>
                            </View>
                          ))}
                        </View>
                      ))}
                    </View>
                  ) : (
                    <View style={styles.legacyActivityBox}>
                      <Ionicons
                        name="information-circle-outline"
                        size={17}
                        color={colors.secondary}
                      />
                      <Text style={styles.activityDetails}>{activity.details}</Text>
                    </View>
                  )}
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
    paddingTop: 34,
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
    fontSize: 30,
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
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: "#000",
      shadowOpacity: isDark ? 0.14 : 0.045,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
      elevation: 2,
    borderRadius: 22,
    padding: 16,
    marginBottom: 16,
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
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: "#000",
      shadowOpacity: isDark ? 0.14 : 0.045,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
      elevation: 2,
    borderRadius: 28,
    padding: 20,
    marginBottom: 16,
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

  excelButton: {
    backgroundColor: colors.success,
    borderRadius: 22,
    paddingVertical: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
  },

  pdfButtonDisabled: {
    opacity: 0.6,
  },

  pdfButtonText: {
    color: colors.onPrimary,
    fontSize: 16,
    fontWeight: "900",
    marginLeft: 10,
    textAlign: "center",
  },

  activitiesCard: {
    backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: "#000",
      shadowOpacity: isDark ? 0.14 : 0.045,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
      elevation: 2,
    borderRadius: 22,
    padding: 16,
    marginBottom: 16,
  },

  activitiesTitle: {
    color: colors.onPrimary,
    fontSize: 22,
    fontWeight: "900",
    marginBottom: 16,
  },

  activityCard: {
    backgroundColor: colors.background,
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },

  activityHeader: {
    flexDirection: "row",
    alignItems: "center",
  },

  activityIconBox: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: `${colors.primary}14`,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 11,
  },

  activityAction: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "900",
  },

  activityDate: {
    color: colors.placeholder,
    fontSize: 11,
    marginTop: 3,
    fontWeight: "800",
  },

  activitySummaryRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 14,
    paddingVertical: 12,
  },

  activitySummaryItem: {
    flex: 1,
    alignItems: "center",
  },

  activitySummaryDivider: {
    width: 1,
    height: 30,
    backgroundColor: colors.border,
  },

  activitySummaryValue: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900",
  },

  activitySummaryLabel: {
    color: colors.secondary,
    fontSize: 10,
    fontWeight: "800",
    marginTop: 2,
  },

  activityRooms: {
    marginTop: 12,
  },

  activityRoomCard: {
    backgroundColor: colors.card,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    marginBottom: 10,
  },

  activityRoomHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 9,
  },

  activityRoomTitleWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    marginRight: 8,
  },

  activityRoomTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "900",
    marginLeft: 7,
  },

  activityRoomStatus: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },

  activityRoomStatusText: {
    fontSize: 9,
    fontWeight: "900",
  },

  activityGuestRow: {
    flexDirection: "row",
    paddingVertical: 10,
  },

  activityGuestPosition: {
    width: 28,
    height: 28,
    borderRadius: 9,
    backgroundColor: `${colors.primary}14`,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 9,
  },

  activityGuestPositionText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: "900",
  },

  activityGuestInfo: {
    flex: 1,
  },

  activityGuestName: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "900",
  },

  activityGuestMeta: {
    color: colors.secondary,
    fontSize: 10,
    fontWeight: "700",
    marginTop: 3,
  },

  activityGuestBottom: {
    flexDirection: "row",
    marginTop: 7,
  },

  activityPackPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: `${colors.primary}10`,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },

  activityPackText: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: "900",
    marginLeft: 4,
  },

  activityNotesBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: `${colors.warning}10`,
    borderRadius: 10,
    padding: 8,
    marginTop: 7,
  },

  activityNotesText: {
    flex: 1,
    color: colors.secondary,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: "700",
    marginLeft: 5,
  },

  legacyActivityBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 11,
    marginTop: 12,
  },

  activityDetails: {
    flex: 1,
    color: colors.secondary,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "700",
    marginLeft: 6,
  },

  emptyBox: {
    backgroundColor: colors.card,
    borderRadius: 22,
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

  compactSelectorCard: {
    backgroundColor: colors.card,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 16,
  },

  compactSelectorHeader: {
    marginBottom: 14,
  },

  compactSelectorEyebrow: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.3,
    marginBottom: 5,
  },

  compactSelectorTitle: {
    color: colors.text,
    fontSize: 19,
    fontWeight: "900",
  },

  compactSelectorMeta: {
    color: colors.secondary,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "700",
    marginTop: 4,
  },

  compactSelectorStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
  },

  changeTeacherButton: {
    minHeight: 50,
    backgroundColor: colors.primaryDark,
    borderRadius: 16,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
  },

  changeTeacherButtonText: {
    flex: 1,
    color: colors.onPrimary,
    fontSize: 13,
    fontWeight: "900",
    marginLeft: 9,
  },

  pickerOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.58)",
  },

  pickerSheet: {
    maxHeight: "82%",
    backgroundColor: colors.background,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 24,
    borderWidth: 1,
    borderColor: colors.border,
  },

  pickerHandle: {
    width: 42,
    height: 5,
    borderRadius: 3,
    alignSelf: "center",
    backgroundColor: colors.border,
    marginBottom: 16,
  },

  pickerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 14,
  },

  pickerTitle: {
    color: colors.text,
    fontSize: 23,
    fontWeight: "900",
  },

  pickerSubtitle: {
    color: colors.secondary,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 3,
  },

  pickerCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },

  teacherSearchBox: {
    minHeight: 50,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 13,
    marginBottom: 12,
  },

  teacherSearchInput: {
    flex: 1,
    color: colors.text,
    fontSize: 13,
    fontWeight: "700",
    marginLeft: 8,
  },

  pickerList: {
    maxHeight: 520,
  },

  pickerTeacherRow: {
    minHeight: 78,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: 11,
    marginBottom: 9,
    flexDirection: "row",
    alignItems: "center",
  },

  pickerTeacherRowSelected: {
    borderColor: colors.primary,
    backgroundColor: `${colors.primary}0D`,
  },

  pickerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },

  pickerTeacherInfo: {
    flex: 1,
    paddingRight: 8,
  },

  pickerTeacherName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "900",
  },

  pickerTeacherMeta: {
    color: colors.secondary,
    fontSize: 10,
    fontWeight: "700",
    marginTop: 2,
  },

  pickerTeacherStatus: {
    fontSize: 10,
    fontWeight: "900",
    marginTop: 4,
  },

  pickerEmpty: {
    alignItems: "center",
    paddingVertical: 30,
  },

  monitoringHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },

  monitoringEyebrow: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.2,
  },

  monitoringTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "900",
    marginTop: 3,
  },

  monitoringStatusPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    flexDirection: "row",
    alignItems: "center",
  },

  emptyText: {
    color: colors.secondary,
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
  },
});
