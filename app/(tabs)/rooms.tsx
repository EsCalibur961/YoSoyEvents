import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "expo-router";
import {
  addDoc,
  collection,
  doc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { db } from "../../firebase";
import { sendPushNotificationsToRoleAsync } from "../../services/pushNotifications";

type RoomType = "Doppia" | "Tripla" | "Quadrupla";

type TeacherUser = {
  id: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  danceSchool?: string;
};

type EventPack = {
  id: string;
  letter?: string;
  price?: string;
  description?: string;
  supplementDoppia?: string;
  supplementTripla?: string;
  supplementQuadrupla?: string;
};

type EventItem = {
  id: string;
  title?: string;
  packs?: EventPack[];
};

type Guest = {
  firstName: string;
  lastName: string;
  birthDate: string;
  birthPlace: string;
  selectedPackId: string;
  selectedPackLetter: string;
  selectedPackPrice: string;
  notes: string;
};

type RoomData = {
  id: string;
  teacherUsername: string;
  roomType: RoomType;
  roomIndex: number;
  customName?: string;
  guests: Guest[];
  isSaved?: boolean;
  savedAt?: any;
  paymentVisible?: boolean;
};

type RoomAssignment = {
  id: string;
  teacherUsername?: string;
  danceSchool?: string;
  quantities?: {
    Doppia?: number;
    Tripla?: number;
    Quadrupla?: number;
  };
};

type RoomPayment = {
  id: string;
  roomKey?: string;
  teacherUsername?: string;
  paid?: boolean;
};

type RoomSettings = {
  editDeadlineDate?: string;
  editDeadlineTime?: string;
};

const roomTypes: RoomType[] = ["Doppia", "Tripla", "Quadrupla"];

const capacities: Record<RoomType, number> = {
  Doppia: 2,
  Tripla: 3,
  Quadrupla: 4,
};

const emptyGuest = (): Guest => ({
  firstName: "",
  lastName: "",
  birthDate: "",
  birthPlace: "",
  selectedPackId: "",
  selectedPackLetter: "",
  selectedPackPrice: "",
  notes: "",
});

export default function RoomsScreen() {
  const { colors, isDark } = useTheme();
  const styles = createStyles(colors, isDark);
  const [role, setRole] = useState<string | null>(null);
  const [teacherUsername, setTeacherUsername] = useState<string | null>(null);

  const [teachers, setTeachers] = useState<TeacherUser[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [assignments, setAssignments] = useState<RoomAssignment[]>([]);
  const [roomsData, setRoomsData] = useState<RoomData[]>([]);
  const [payments, setPayments] = useState<RoomPayment[]>([]);
  const [settings, setSettings] = useState<RoomSettings | null>(null);

  const [selectedTeacher, setSelectedTeacher] = useState<string | null>(null);

  const [loadingRooms, setLoadingRooms] = useState(true);
  const [savingRooms, setSavingRooms] = useState(false);

  const [movingGuest, setMovingGuest] = useState<{
    fromRoomId: string;
    fromGuestIndex: number;
    guest: Guest;
  } | null>(null);

  const [showMovePanel, setShowMovePanel] = useState(false);

  const [openTypes, setOpenTypes] = useState<Record<RoomType, boolean>>({
    Doppia: true,
    Tripla: false,
    Quadrupla: false,
  });

  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const pendingChangeRequests = useRef<Record<string, any>>({});
  const originalRoomsRef = useRef<Record<string, RoomData>>({});

  useEffect(() => {
    return () => {
      Object.values(saveTimers.current).forEach((timer) => clearTimeout(timer));
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadUser();

      let unsubEvents: (() => void) | null = null;
      let unsubAssignments: (() => void) | null = null;
      let unsubRooms: (() => void) | null = null;
      let unsubPayments: (() => void) | null = null;
      let unsubSettings: (() => void) | null = null;

      getDocs(collection(db, "teachers"))
        .then((snapshot) => {
          const data: TeacherUser[] = snapshot.docs.map((item) => ({
            id: item.id,
            ...(item.data() as Omit<TeacherUser, "id">),
          }));

          setTeachers(data);
        })
        .catch(() => {
          setTeachers([]);
        });

      try {
        unsubEvents = onSnapshot(collection(db, "events"), (snapshot) => {
          const data: EventItem[] = snapshot.docs.map((item) => ({
            id: item.id,
            ...(item.data() as Omit<EventItem, "id">),
          }));

          setEvents(data);
        });

        unsubAssignments = onSnapshot(
          collection(db, "roomAssignments"),
          (snapshot) => {
            const data: RoomAssignment[] = snapshot.docs.map((item) => ({
              id: item.id,
              ...(item.data() as Omit<RoomAssignment, "id">),
            }));

            setAssignments(data);
          },
        );

        unsubRooms = onSnapshot(
          collection(db, "roomsData"),
          (snapshot) => {
            const data: RoomData[] = snapshot.docs.map((item) => ({
              id: item.id,
              ...(item.data() as Omit<RoomData, "id">),
            }));

            originalRoomsRef.current = data.reduce<Record<string, RoomData>>((acc, room) => {
              acc[room.id] = normalizeRoom(room);
              return acc;
            }, {});

            setRoomsData(data);
            setLoadingRooms(false);
          },
          () => {
            originalRoomsRef.current = {};
            setRoomsData([]);
            setLoadingRooms(false);
          },
        );

        unsubPayments = onSnapshot(
          collection(db, "roomPayments"),
          (snapshot) => {
            const data: RoomPayment[] = snapshot.docs.map((item) => ({
              id: item.id,
              ...(item.data() as Omit<RoomPayment, "id">),
            }));

            setPayments(data);
          },
        );

        unsubSettings = onSnapshot(doc(db, "settings", "rooms"), (snapshot) => {
          if (snapshot.exists()) {
            setSettings(snapshot.data() as RoomSettings);
          } else {
            setSettings(null);
          }
        });
      } catch {
        setEvents([]);
        setAssignments([]);
        setRoomsData([]);
        setPayments([]);
        setSettings(null);
        setLoadingRooms(false);
      }

      return () => {
        if (unsubEvents) unsubEvents();
        if (unsubAssignments) unsubAssignments();
        if (unsubRooms) unsubRooms();
        if (unsubPayments) unsubPayments();
        if (unsubSettings) unsubSettings();
      };
    }, []),
  );
  const loadUser = async () => {
    try {
      const savedRole = await AsyncStorage.getItem("loggedUser");
      const savedTeacherUsername =
        await AsyncStorage.getItem("teacherUsername");

      setRole(savedRole);
      setTeacherUsername(savedTeacherUsername);

      if (savedRole === "teacher" && savedTeacherUsername) {
        setSelectedTeacher(savedTeacherUsername);
      }
    } catch {
      setRole(null);
      setTeacherUsername(null);
    }
  };

  const activeEvent = events[0] || null;

  const availablePacks = Array.isArray(activeEvent?.packs)
    ? activeEvent?.packs || []
    : [];

  const normalizeGuest = (guest: any): Guest => ({
    firstName: guest?.firstName || "",
    lastName: guest?.lastName || "",
    birthDate: guest?.birthDate || "",
    birthPlace: guest?.birthPlace || "",
    selectedPackId: guest?.selectedPackId || "",
    selectedPackLetter: guest?.selectedPackLetter || "",
    selectedPackPrice: guest?.selectedPackPrice || "",
    notes: guest?.notes || "",
  });

  const normalizeRoom = (room: any): RoomData => {
    const safeType: RoomType = room?.roomType || "Doppia";
    const capacity = capacities[safeType] || 2;

    return {
      id: room?.id || "",
      teacherUsername: room?.teacherUsername || "",
      roomType: safeType,
      roomIndex: Number(room?.roomIndex || 1),
      customName: room?.customName || "",
      isSaved: Boolean(room?.isSaved),
      savedAt: room?.savedAt || null,
      paymentVisible: Boolean(room?.paymentVisible),
      guests: Array.isArray(room?.guests)
        ? room.guests.map((guest: any) => normalizeGuest(guest))
        : Array.from({ length: capacity }, () => emptyGuest()),
    };
  };

  const getDeadlineDate = () => {
    if (!settings?.editDeadlineDate || !settings?.editDeadlineTime) return null;

    const dateParts = settings.editDeadlineDate.split("/");
    const timeParts = settings.editDeadlineTime.split(":");

    if (dateParts.length !== 3 || timeParts.length !== 2) return null;

    const [day, month, year] = dateParts;
    const [hour, minute] = timeParts;

    const date = new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      0,
    );

    if (Number.isNaN(date.getTime())) return null;

    return date;
  };

  const deadlineDate = getDeadlineDate();

  const isTeacherLocked =
    role === "teacher" && deadlineDate ? new Date() > deadlineDate : false;

  const canEdit = role === "teacher" && !isTeacherLocked;

  const validAssignments = useMemo(() => {
    return assignments.filter((assignment) =>
      teachers.some(
        (teacher) => teacher.username === assignment.teacherUsername,
      ),
    );
  }, [assignments, teachers]);

  const getAssignment = () => {
    if (!selectedTeacher) return null;

    return validAssignments.find(
      (assignment) => assignment.teacherUsername === selectedTeacher,
    );
  };

  const rooms = useMemo(() => {
    const assignment = getAssignment();

    if (!assignment?.teacherUsername) return [];

    const result: RoomData[] = [];

    roomTypes.forEach((type) => {
      const quantity = Number(assignment.quantities?.[type] || 0);

      for (let i = 1; i <= quantity; i++) {
        const roomId = `${assignment.teacherUsername}-${type}-${i}`;
        const existing = roomsData.find((room) => room.id === roomId);

        if (existing) {
          result.push(normalizeRoom(existing));
        } else {
          result.push({
            id: roomId,
            teacherUsername: assignment.teacherUsername || "",
            roomType: type,
            roomIndex: i,
            customName: "",
            guests: Array.from({ length: capacities[type] }, () =>
              emptyGuest(),
            ),
          });
        }
      }
    });

    return result;
  }, [validAssignments, roomsData, selectedTeacher]);

  const isGuestComplete = (guest: Guest) =>
    Boolean(
      guest.firstName.trim() &&
      guest.lastName.trim() &&
      guest.birthDate.trim() &&
      guest.birthPlace.trim() &&
      guest.selectedPackId.trim(),
    );

  const isGuestEmpty = (guest: Guest) => {
    return (
      !guest.firstName.trim() &&
      !guest.lastName.trim() &&
      !guest.birthDate.trim() &&
      !guest.birthPlace.trim() &&
      !guest.selectedPackId.trim()
    );
  };

  const normalizeGuestKey = (guest: Guest) => {
    return `${guest.firstName || ""}-${guest.lastName || ""}-${
      guest.birthDate || ""
    }`
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "");
  };

  const findDuplicateGuest = (
    currentRoomId: string,
    currentGuestIndex: number,
    guest: Guest,
  ) => {
    const currentKey = normalizeGuestKey(guest);

    if (
      !guest.firstName.trim() ||
      !guest.lastName.trim() ||
      !guest.birthDate.trim()
    ) {
      return null;
    }

    for (const room of rooms) {
      for (let index = 0; index < room.guests.length; index++) {
        const existingGuest = room.guests[index];

        const isSamePosition =
          room.id === currentRoomId && index === currentGuestIndex;

        if (isSamePosition) continue;

        const existingKey = normalizeGuestKey(existingGuest);

        if (existingKey && existingKey === currentKey) {
          return {
            room,
            guest: existingGuest,
            index,
          };
        }
      }
    }

    return null;
  };

  const getRoomLabel = (room: RoomData) => {
    if (room.customName?.trim()) return room.customName.trim();
    return `${room.roomType} #${room.roomIndex}`;
  };

  const getRoomKey = (room: RoomData) =>
    `${room.teacherUsername}-${room.roomType}-${room.roomIndex}`;

  const isRoomPaid = (room: RoomData) => {
    const key = getRoomKey(room);
    return payments.some((payment) => payment.roomKey === key && payment.paid);
  };

  const getSupplementForRoom = (pack: EventPack, roomType: RoomType) => {
    if (roomType === "Doppia") return Number(pack.supplementDoppia || 0);
    if (roomType === "Tripla") return Number(pack.supplementTripla || 0);
    if (roomType === "Quadrupla") return Number(pack.supplementQuadrupla || 0);

    return 0;
  };

  const getPackTotalForRoom = (pack: EventPack, roomType: RoomType) => {
    const basePrice = Number(pack.price || 0);
    const supplement = getSupplementForRoom(pack, roomType);

    return basePrice + supplement;
  };

  const getGuestTotal = (room: RoomData, guest: Guest) => {
    const pack = availablePacks.find(
      (item) => item.id === guest.selectedPackId,
    );

    if (!pack) {
      const fallbackPrice = Number(guest.selectedPackPrice || 0);
      return Number.isNaN(fallbackPrice) ? 0 : fallbackPrice;
    }

    return getPackTotalForRoom(pack, room.roomType);
  };

  const getRoomPackTotal = (room: RoomData) => {
    return room.guests.reduce((sum, guest) => {
      if (!isGuestComplete(guest)) return sum;
      return sum + getGuestTotal(room, guest);
    }, 0);
  };

  const isRoomComplete = (room: RoomData) => {
    return room.guests.length > 0 && room.guests.every((guest) => isGuestComplete(guest));
  };

  const getOriginalRoom = (roomId: string) => originalRoomsRef.current[roomId] || null;

  const isSavedRoom = (room: RoomData) => {
    const original = getOriginalRoom(room.id);

    if (!original) return false;

    // Una camera diventa davvero "salvata" solo quando il maestro preme
    // il pulsante "Salva camere". Le bozze auto-salvate NON devono essere
    // considerate salvate, altrimenti entrano nei pagamenti e non parte
    // correttamente la richiesta admin.
    return Boolean(original.isSaved || original.paymentVisible || original.savedAt);
  };

  const getGuestChangedFields = (oldGuest: Guest, newGuest: Guest) => {
    const fields: { key: keyof Guest; label: string }[] = [
      { key: "firstName", label: "Nome" },
      { key: "lastName", label: "Cognome" },
      { key: "birthDate", label: "Data nascita" },
      { key: "birthPlace", label: "Luogo nascita" },
      { key: "selectedPackId", label: "Pack" },
      { key: "notes", label: "Note" },
    ];

    return fields
      .filter(({ key }) => String(oldGuest?.[key] || "") !== String(newGuest?.[key] || ""))
      .map(({ label }) => label);
  };

  const buildRoomUpdateRequests = (oldRoom: RoomData, newRoom: RoomData) => {
    const requests: any[] = [];

    if ((oldRoom.customName || "") !== (newRoom.customName || "")) {
      requests.push({
        requestType: "room_name_updated",
        roomId: newRoom.id,
        roomType: newRoom.roomType,
        roomIndex: newRoom.roomIndex,
        roomLabel: getRoomLabel(oldRoom),
        oldData: { customName: oldRoom.customName || getRoomLabel(oldRoom) },
        newData: { customName: newRoom.customName || getRoomLabel(newRoom) },
        changedFields: ["Nome camera"],
      });
    }

    newRoom.guests.forEach((newGuest, guestIndex) => {
      const oldGuest = oldRoom.guests[guestIndex] || emptyGuest();
      const changedFields = getGuestChangedFields(oldGuest, newGuest);

      if (changedFields.length === 0) return;

      const oldEmpty = isGuestEmpty(oldGuest);
      const newEmpty = isGuestEmpty(newGuest);

      requests.push({
        requestType: oldEmpty && !newEmpty ? "guest_added" : newEmpty && !oldEmpty ? "guest_cleared" : changedFields.includes("Pack") && changedFields.length === 1 ? "guest_pack_updated" : "guest_updated",
        roomId: newRoom.id,
        roomType: newRoom.roomType,
        roomIndex: newRoom.roomIndex,
        roomLabel: getRoomLabel(oldRoom),
        guestIndex,
        guestPosition: guestIndex + 1,
        oldData: formatGuestForRequest(oldGuest),
        newData: formatGuestForRequest(newGuest),
        changedFields,
      });
    });

    return requests;
  };
  const completedRooms = useMemo(() => {
    return rooms.filter((room) =>
      room.guests.every((guest) => isGuestComplete(guest)),
    ).length;
  }, [rooms]);

  const occupiedPlaces = useMemo(() => {
    return rooms.reduce(
      (sum, room) =>
        sum +
        room.guests.filter(
          (guest) => guest.firstName.trim() && guest.lastName.trim(),
        ).length,
      0,
    );
  }, [rooms]);

  const roomsByType = useCallback(
    (type: RoomType) => rooms.filter((room) => room.roomType === type),
    [rooms],
  );

  const getTeacherDetails = () => {
    const teacher = teachers.find((item) => item.username === teacherUsername);
    const teacherFullName =
      `${teacher?.firstName || ""} ${teacher?.lastName || ""}`.trim();

    return {
      teacherFullName: teacherFullName || teacherUsername || "Maestro",
      danceSchool: teacher?.danceSchool || "Scuola non inserita",
    };
  };

  const formatGuestForRequest = (guest: Guest) => ({
    firstName: guest?.firstName || "",
    lastName: guest?.lastName || "",
    birthDate: guest?.birthDate || "",
    birthPlace: guest?.birthPlace || "",
    selectedPackId: guest?.selectedPackId || "",
    selectedPackLetter: guest?.selectedPackLetter || "",
    selectedPackPrice: guest?.selectedPackPrice || "",
    notes: guest?.notes || "",
  });

  const createRoomChangeRequest = async (payload: any) => {
    if (role !== "teacher" || !teacherUsername) return;

    const teacherDetails = getTeacherDetails();
    const requestData = {
      ...payload,
      teacherUsername,
      teacherFullName: teacherDetails.teacherFullName,
      danceSchool: teacherDetails.danceSchool,
      status: "pending",
      rejectionReason: "",
      reviewedBy: "",
      createdAt: new Date().toLocaleString("it-IT"),
      createdAtServer: serverTimestamp(),
      updatedAtServer: serverTimestamp(),
    };

    const requestRef = await addDoc(collection(db, "roomChangeRequests"), requestData);

    await addDoc(collection(db, "notifications"), {
      title: "Nuova richiesta modifica camera",
      message: `${teacherDetails.teacherFullName} ha inviato una richiesta per ${payload.roomLabel || "una camera"}.`,
      type: "room",
      targetRole: "admin",
      requestId: requestRef.id,
      teacherUsername,
      createdAt: new Date().toLocaleString("it-IT"),
      createdAtServer: serverTimestamp(),
    });

  };

  const registerPendingChangeRequest = (key: string, payload: any) => {
    const existing = pendingChangeRequests.current[key];

    pendingChangeRequests.current[key] = {
      ...(existing || payload),
      ...payload,
      oldData: existing?.oldData || payload.oldData,
      changedFields: Array.from(
        new Set([
          ...(existing?.changedFields || []),
          ...(payload.changedFields || []),
        ]),
      ),
    };
  };

  const flushRoomChangeRequestsForRoom = async (roomId: string) => {
    const entries = Object.entries(pendingChangeRequests.current).filter(
      ([, value]) => value?.roomId === roomId,
    );

    for (const [key, payload] of entries) {
      try {
        await createRoomChangeRequest(payload);
        delete pendingChangeRequests.current[key];
      } catch {
        // Non blocchiamo il salvataggio della camera se la notifica fallisce.
      }
    }
  };

  const saveRoomToFirebase = async (room: RoomData, markAsSaved = false) => {
    await setDoc(
      doc(db, "roomsData", room.id),
      {
        teacherUsername: room.teacherUsername,
        roomType: room.roomType,
        roomIndex: room.roomIndex,
        customName: room.customName || "",
        guests: room.guests,
        ...(markAsSaved
          ? { isSaved: true, paymentVisible: true, savedAt: serverTimestamp() }
          : isSavedRoom(room)
            ? {}
            : { isSaved: false, paymentVisible: false }),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  };

  const saveRoomToFirebaseDebounced = (room: RoomData) => {
    if (saveTimers.current[room.id]) {
      clearTimeout(saveTimers.current[room.id]);
    }

    saveTimers.current[room.id] = setTimeout(async () => {
      await saveRoomToFirebase(room);
      await flushRoomChangeRequestsForRoom(room.id);
    }, 2500);
  };

  const updateRoomName = (room: RoomData, value: string) => {
    if (!canEdit) return;

    const updatedRoom: RoomData = {
      ...room,
      customName: value,
    };

    setRoomsData((prev) => {
      const exists = prev.some((item) => item.id === room.id);

      if (exists) {
        return prev.map((item) => (item.id === room.id ? updatedRoom : item));
      }

      return [...prev, updatedRoom];
    });

    if (!isSavedRoom(room)) {
      saveRoomToFirebaseDebounced(updatedRoom);
    }
  };

  const updateGuest = (
    room: RoomData,
    guestIndex: number,
    field: keyof Guest,
    value: string,
  ) => {
    if (!canEdit) return;

    const updatedGuests = [...(room.guests || [])];
    const oldGuest = formatGuestForRequest(updatedGuests[guestIndex]);

    updatedGuests[guestIndex] = {
      ...updatedGuests[guestIndex],
      [field]: value,
    };

    const updatedRoom: RoomData = {
      ...room,
      guests: updatedGuests,
    };

    const duplicate = findDuplicateGuest(
      room.id,
      guestIndex,
      updatedGuests[guestIndex],
    );

    if (duplicate) {
      Alert.alert(
        "Ospite già inserito",
        `${updatedGuests[guestIndex].firstName} ${updatedGuests[guestIndex].lastName} risulta già presente in ${getRoomLabel(
          duplicate.room,
        )}.`,
      );

      return;
    }

    setRoomsData((prev) => {
      const exists = prev.some((item) => item.id === room.id);

      if (exists) {
        return prev.map((item) => (item.id === room.id ? updatedRoom : item));
      }

      return [...prev, updatedRoom];
    });

    if (!isSavedRoom(room)) {
      saveRoomToFirebaseDebounced(updatedRoom);
    }
  };

  const updatePackSelection = (
    room: RoomData,
    guestIndex: number,
    pack: EventPack,
  ) => {
    if (!canEdit) return;

    const updatedGuests = [...room.guests];

    const currentGuest = updatedGuests[guestIndex];
    const oldGuest = formatGuestForRequest(currentGuest);

    const alreadySelected = currentGuest.selectedPackId === pack.id;

    updatedGuests[guestIndex] = {
      ...currentGuest,
      selectedPackId: alreadySelected ? "" : pack.id || "",
      selectedPackLetter: alreadySelected ? "" : pack.letter || "",
      selectedPackPrice: alreadySelected
        ? ""
        : String(getPackTotalForRoom(pack, room.roomType)),
    };

    const duplicate = findDuplicateGuest(
      room.id,
      guestIndex,
      updatedGuests[guestIndex],
    );

    if (duplicate) {
      Alert.alert(
        "Ospite già inserito",
        `${updatedGuests[guestIndex].firstName} ${updatedGuests[guestIndex].lastName} risulta già presente in ${getRoomLabel(
          duplicate.room,
        )}.`,
      );

      return;
    }

    setRoomsData((prev) =>
      prev.map((item) =>
        item.id === room.id
          ? {
              ...item,
              guests: updatedGuests,
            }
          : item,
      ),
    );

    if (!isSavedRoom(room)) {
      saveRoomToFirebaseDebounced({
        ...room,
        guests: updatedGuests,
      });
    }
  };

  const startMoveGuest = (room: RoomData, guestIndex: number) => {
    const guest = room.guests[guestIndex];

    if (!guest || isGuestEmpty(guest)) {
      Alert.alert("Ospite vuoto", "Non puoi spostare un posto vuoto.");
      return;
    }

    setMovingGuest({
      fromRoomId: room.id,
      fromGuestIndex: guestIndex,
      guest,
    });

    setShowMovePanel(true);
  };

  const cancelMoveGuest = () => {
    setMovingGuest(null);
    setShowMovePanel(false);
  };

  const moveGuestToRoom = async (toRoom: RoomData, toGuestIndex: number) => {
    if (!movingGuest) return;

    if (!canEdit) {
      Alert.alert("Modifiche bloccate", "Non puoi modificare le camere.");
      return;
    }

    const fromRoom = rooms.find((room) => room.id === movingGuest.fromRoomId);

    if (!fromRoom) {
      Alert.alert("Errore", "Camera di partenza non trovata.");
      return;
    }

    const targetGuest = toRoom.guests[toGuestIndex];

    if (!targetGuest || !isGuestEmpty(targetGuest)) {
      Alert.alert("Posto occupato", "Scegli un posto vuoto.");
      return;
    }

    /*
      BLOCCO SICURO:
      Lo spostamento di un ospite fatto dal maestro NON deve mai salvare
      direttamente su roomsData.
      Deve sempre creare una richiesta in roomChangeRequests, poi sarà l'admin
      ad approvarla dalla sezione "Richieste modifiche camere".
    */
    try {
      await createRoomChangeRequest({
        requestType: "guest_moved",
        roomId: toRoom.id,
        roomType: toRoom.roomType,
        roomIndex: toRoom.roomIndex,
        roomLabel: getRoomLabel(toRoom),
        guestIndex: toGuestIndex,
        guestPosition: toGuestIndex + 1,
        oldData: {
          guest: formatGuestForRequest(movingGuest.guest),
          fromRoomId: fromRoom.id,
          fromRoomLabel: getRoomLabel(fromRoom),
          fromGuestIndex: movingGuest.fromGuestIndex,
          fromGuestPosition: movingGuest.fromGuestIndex + 1,
        },
        newData: {
          guest: formatGuestForRequest(movingGuest.guest),
          toRoomId: toRoom.id,
          toRoomLabel: getRoomLabel(toRoom),
          toGuestIndex,
          toGuestPosition: toGuestIndex + 1,
        },
        changedFields: ["Camera", "Posto"],
      });

      setMovingGuest(null);
      setShowMovePanel(false);

      Alert.alert(
        "Richiesta inviata",
        "Lo spostamento è stato inviato all'admin. Verrà applicato solo dopo approvazione.",
      );
    } catch (error: any) {
      Alert.alert(
        "Errore richiesta",
        String(error?.message || "Non è stato possibile inviare la richiesta all'admin."),
      );
    }
  };
  const saveTeacherActivity = async () => {
    if (role !== "teacher" || !teacherUsername) return;

    await addDoc(collection(db, "teacherActivities"), {
      teacherUsername,
      action: "Aggiornamento stanze",
      details: `Camere complete: ${completedRooms}/${rooms.length}. Posti segnati: ${occupiedPlaces}.`,
      createdAt: new Date().toLocaleString("it-IT"),
      createdAtServer: serverTimestamp(),
    });
  };

  const notifyAdminRoomsCompleted = async (newRoomsCount: number) => {
    if (role !== "teacher" || !teacherUsername || newRoomsCount <= 0) return;

    try {
      const teacherDetails = getTeacherDetails();
      const title = "Camere completate";
      const message =
        newRoomsCount === 1
          ? `${teacherDetails.teacherFullName} ha completato 1 camera.`
          : `${teacherDetails.teacherFullName} ha completato ${newRoomsCount} camere.`;

      await addDoc(collection(db, "notifications"), {
        title,
        message,
        type: "room",
        targetRole: "admin",
        teacherUsername,
        teacherFullName: teacherDetails.teacherFullName,
        danceSchool: teacherDetails.danceSchool,
        roomsCount: newRoomsCount,
        createdAt: new Date().toLocaleString("it-IT"),
        createdAtServer: serverTimestamp(),
      });

      await sendPushNotificationsToRoleAsync("admin", title, message, {
        type: "rooms_completed",
        teacherUsername,
        roomsCount: newRoomsCount,
      });
    } catch (error) {
      console.log("Notifica camere completate non inviata:", error);
    }
  };

  const hasPartialGuests = () => {
    return rooms.some((room) =>
      room.guests.some((guest) => {
        const fields = [
          guest.firstName?.trim(),
          guest.lastName?.trim(),
          guest.birthDate?.trim(),
          guest.birthPlace?.trim(),
          guest.selectedPackId?.trim(),
        ];

        const filledFields = fields.filter(Boolean).length;

        return filledFields > 0 && filledFields < fields.length;
      }),
    );
  };

  const saveRooms = async () => {
    if (savingRooms) return;

    setSavingRooms(true);

    try {
      if (isTeacherLocked) {
        Alert.alert(
          "Modifiche bloccate",
          "Il tempo per modificare le stanze è scaduto.",
        );
        return;
      }

      if (hasPartialGuests()) {
        Alert.alert(
          "Dati incompleti",
          "Completa i dati degli ospiti iniziati oppure lasciali totalmente vuoti.",
        );
        return;
      }

      const roomsToSave: RoomData[] = [];
      const requestsToSend: any[] = [];

      rooms.forEach((room) => {
        if (isSavedRoom(room)) {
          const original = getOriginalRoom(room.id);
          if (!original) return;

          requestsToSend.push(...buildRoomUpdateRequests(original, room));
          return;
        }

        if (isRoomComplete(room)) {
          roomsToSave.push(room);
        }
      });

      if (roomsToSave.length === 0 && requestsToSend.length === 0) {
        Alert.alert(
          "Nessuna camera completa",
          "Completa almeno una camera per salvarla o modifica una camera già salvata per inviare la richiesta all’admin.",
        );
        return;
      }

      await Promise.all(roomsToSave.map((room) => saveRoomToFirebase(room, true)));

      await notifyAdminRoomsCompleted(roomsToSave.length);

      for (const request of requestsToSend) {
        await createRoomChangeRequest(request);
      }

      await saveTeacherActivity();

      if (requestsToSend.length > 0 && roomsToSave.length === 0) {
        Alert.alert(
          "Richiesta inviata",
          "Le modifiche alle camere già salvate sono state inviate all’admin. Verranno applicate solo dopo approvazione.",
        );
      } else if (requestsToSend.length > 0) {
        Alert.alert(
          "Salvataggio e richiesta inviati",
          "Le nuove camere complete sono state salvate. Le modifiche alle camere già salvate sono state inviate all’admin.",
        );
      } else {
        Alert.alert(
          "Salvataggio completato",
          "Le camere complete sono state salvate correttamente.",
        );
      }
    } catch (error: any) {
      Alert.alert("Errore", String(error?.message || error));
    } finally {
      setSavingRooms(false);
    }
  };

  const getRoomStatus = (room: RoomData) => {
    const completeGuests = room.guests.filter((guest) =>
      isGuestComplete(guest),
    );

    if (completeGuests.length === 0) return "empty";
    if (completeGuests.length === room.guests.length) return "complete";

    return "partial";
  };

  const toggleType = (type: RoomType) => {
    setOpenTypes((prev) => ({
      ...prev,
      [type]: !prev[type],
    }));
  };

  const totalPlaces = useMemo(() => {
    return rooms.reduce((sum, room) => sum + room.guests.length, 0);
  }, [rooms]);

  const selectedPacksCount = useMemo(() => {
    return rooms.reduce(
      (sum, room) =>
        sum + room.guests.filter((guest) => guest.selectedPackId.trim()).length,
      0,
    );
  }, [rooms]);

  const totalPackAmount = useMemo(() => {
    return rooms.reduce((sum, room) => sum + getRoomPackTotal(room), 0);
  }, [rooms, getRoomPackTotal]);

  const paidAmount = useMemo(() => {
    return rooms.reduce((sum, room) => {
      const key = getRoomKey(room);
      const paid = payments.some(
        (payment) => payment.roomKey === key && payment.paid,
      );
      if (!paid) return sum;
      return sum + getRoomPackTotal(room);
    }, 0);
  }, [rooms, payments]);

  const unpaidAmount = totalPackAmount - paidAmount;

  if (loadingRooms) {
    return (
      <View
        style={[
          styles.loadingContainer,
          { backgroundColor: colors.background },
        ]}
      >
        {[1, 2, 3, 4].map((item) => (
          <View
            key={item}
            style={[styles.skeletonCard, { backgroundColor: colors.card }]}
          />
        ))}
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={[styles.title, { color: colors.text }]}>Stanze</Text>
      <Text style={[styles.subtitle, { color: colors.secondary }]}>
        Gestione camere live con dati ospiti e pack a persona.
      </Text>
      {showMovePanel && movingGuest ? (
        <View
          style={[
            styles.movePanel,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <View style={styles.movePanelHeader}>
            <View>
              <Text style={[styles.movePanelTitle, { color: colors.text }]}>
                Sposta ospite
              </Text>

              <Text
                style={[styles.movePanelSubtitle, { color: colors.secondary }]}
              >
                {movingGuest.guest.firstName} {movingGuest.guest.lastName}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.moveCloseButton}
              onPress={cancelMoveGuest}
            >
              <Ionicons name="close-outline" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          <Text style={[styles.moveText, { color: colors.secondary }]}>
            Seleziona un posto vuoto in una camera di destinazione.
          </Text>

          {rooms.map((room) => (
            <View
              key={`move-${room.id}`}
              style={[
                styles.moveRoomBox,
                { backgroundColor: colors.cardAlt, borderColor: colors.border },
              ]}
            >
              <Text style={[styles.moveRoomTitle, { color: colors.text }]}>
                {getRoomLabel(room)}
              </Text>

              <View style={styles.movePlacesWrap}>
                {room.guests.map((guest, index) => {
                  const empty = isGuestEmpty(guest);

                  const isOrigin =
                    room.id === movingGuest.fromRoomId &&
                    index === movingGuest.fromGuestIndex;

                  return (
                    <TouchableOpacity
                      key={`move-${room.id}-${index}`}
                      style={[
                        styles.movePlaceButton,
                        empty && styles.movePlaceButtonEmpty,
                        isOrigin && styles.movePlaceButtonOrigin,
                      ]}
                      disabled={!empty || isOrigin}
                      onPress={() => moveGuestToRoom(room, index)}
                    >
                      <Text style={styles.movePlaceText}>
                        {isOrigin
                          ? "Origine"
                          : empty
                            ? `Posto ${index + 1}`
                            : "Occupato"}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ))}
        </View>
      ) : null}
      <View style={[styles.statsCard, { backgroundColor: colors.card }]}>
        <View style={[styles.statBox, { backgroundColor: colors.cardAlt }]}>
          <Text style={[styles.statNumber, { color: colors.text }]}>
            {rooms.length}
          </Text>
          <Text style={[styles.statLabel, { color: colors.secondary }]}>
            Camere
          </Text>
        </View>

        <View style={[styles.statBox, { backgroundColor: colors.cardAlt }]}>
          <Text style={[styles.statNumber, { color: colors.text }]}>
            {occupiedPlaces}
          </Text>
          <Text style={[styles.statLabel, { color: colors.secondary }]}>
            Ospiti
          </Text>
        </View>

        <View style={[styles.statBox, { backgroundColor: colors.cardAlt }]}>
          <Text style={[styles.statNumber, { color: colors.text }]}>
            {selectedPacksCount}
          </Text>
          <Text style={[styles.statLabel, { color: colors.secondary }]}>
            Pack
          </Text>
        </View>
      </View>
      <View
        style={[
          styles.moneyCard,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <View style={styles.moneyRow}>
          <Text style={[styles.moneyLabel, { color: colors.secondary }]}>
            Totale camere
          </Text>

          <Text style={styles.moneyValue}>€ {totalPackAmount.toFixed(2)}</Text>
        </View>

        <View style={styles.moneyRow}>
          <Text style={[styles.moneyLabel, { color: colors.secondary }]}>
            Pagato
          </Text>

          <Text style={styles.moneyPaid}>€ {paidAmount.toFixed(2)}</Text>
        </View>

        <View style={styles.moneyRow}>
          <Text style={[styles.moneyLabel, { color: colors.secondary }]}>
            Da pagare
          </Text>

          <Text style={styles.moneyUnpaid}>€ {unpaidAmount.toFixed(2)}</Text>
        </View>
      </View>
      {deadlineDate ? (
        <View
          style={[
            styles.deadlineCard,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Ionicons name="time-outline" size={20} color={colors.primary} />

          <Text style={[styles.deadlineText, { color: colors.secondary }]}>
            Modifiche disponibili fino al {settings?.editDeadlineDate} alle{" "}
            {settings?.editDeadlineTime}
          </Text>
        </View>
      ) : null}
      {isTeacherLocked ? (
        <View style={[styles.lockedCard, { backgroundColor: colors.danger }]}>
          <Ionicons name="lock-closed-outline" size={22} color={colors.text} />

          <Text style={styles.lockedText}>
            Le modifiche alle camere sono state bloccate dall’admin.
          </Text>
        </View>
      ) : null}
      {roomTypes.map((type) => {
        const typeRooms = roomsByType(type);

        if (typeRooms.length === 0) return null;

        return (
          <View
            key={type}
            style={[styles.typeSection, { backgroundColor: colors.card }]}
          >
            <TouchableOpacity
              style={styles.typeHeader}
              onPress={() => toggleType(type)}
            >
              <View>
                <Text style={[styles.typeTitle, { color: colors.text }]}>
                  {type}
                </Text>

                <Text
                  style={[styles.typeSubtitle, { color: colors.secondary }]}
                >
                  {typeRooms.length} camere
                </Text>
              </View>

              <Ionicons
                name={
                  openTypes[type]
                    ? "chevron-up-outline"
                    : "chevron-down-outline"
                }
                size={24}
                color={colors.text}
              />
            </TouchableOpacity>

            {openTypes[type]
              ? typeRooms.map((room) => {
                  const status = getRoomStatus(room);

                  return (
                    <View
                      key={room.id}
                      style={[
                        styles.roomCard,
                        {
                          backgroundColor: colors.cardAlt,
                          borderColor: colors.border,
                        },
                      ]}
                    >
                      <View style={styles.roomTop}>
                        <View>
                          <Text
                            style={[styles.roomTitle, { color: colors.text }]}
                          >
                            {getRoomLabel(room)}
                          </Text>

                          <Text
                            style={[
                              styles.roomSubtitle,
                              { color: colors.secondary },
                            ]}
                          >
                            {`${room.roomType} • ${room.guests?.length || 0} posti`}
                          </Text>
                        </View>

                        <View
                          style={[
                            styles.statusBadge,
                            status === "complete" && styles.statusComplete,
                            status === "partial" && styles.statusPartial,
                            status === "empty" && styles.statusEmpty,
                          ]}
                        >
                          <Text style={styles.statusText}>
                            {status === "complete"
                              ? "Completa"
                              : status === "partial"
                                ? "Parziale"
                                : "Vuota"}
                          </Text>
                        </View>
                      </View>

                      <TextInput
                        style={[
                          styles.roomNameInput,
                          {
                            backgroundColor: colors.input,
                            borderColor: colors.border,
                            color: colors.text,
                          },
                        ]}
                        placeholder="Nome camera personalizzato"
                        placeholderTextColor={colors.muted}
                        editable={canEdit}
                        value={room.customName || ""}
                        onChangeText={(value) => updateRoomName(room, value)}
                      />

                      {room.guests.map((guest, guestIndex) => (
                        <View
                          key={`${room.id}-${guestIndex}`}
                          style={[
                            styles.guestCard,
                            {
                              backgroundColor: colors.cardAlt,
                              borderColor: colors.border,
                            },
                          ]}
                        >
                          <View style={styles.guestHeader}>
                            <Text
                              style={[
                                styles.guestTitle,
                                { color: colors.text },
                              ]}
                            >
                              Ospite {guestIndex + 1}
                            </Text>

                            <TouchableOpacity
                              style={styles.moveGuestButton}
                              onPress={() => startMoveGuest(room, guestIndex)}
                            >
                              <Ionicons
                                name="swap-horizontal-outline"
                                size={18}
                                color={colors.text}
                              />

                              <Text style={styles.moveGuestButtonText}>
                                Sposta
                              </Text>
                            </TouchableOpacity>
                          </View>

                          <TextInput
                            style={[
                              styles.input,
                              {
                                backgroundColor: colors.input,
                                borderColor: colors.border,
                                color: colors.text,
                              },
                            ]}
                            placeholder="Nome"
                            placeholderTextColor={colors.muted}
                            editable={canEdit}
                            value={guest.firstName}
                            onChangeText={(value) =>
                              updateGuest(room, guestIndex, "firstName", value)
                            }
                          />

                          <TextInput
                            style={[
                              styles.input,
                              {
                                backgroundColor: colors.input,
                                borderColor: colors.border,
                                color: colors.text,
                              },
                            ]}
                            placeholder="Cognome"
                            placeholderTextColor={colors.muted}
                            editable={canEdit}
                            value={guest.lastName}
                            onChangeText={(value) =>
                              updateGuest(room, guestIndex, "lastName", value)
                            }
                          />

                          <TextInput
                            style={[
                              styles.input,
                              {
                                backgroundColor: colors.input,
                                borderColor: colors.border,
                                color: colors.text,
                              },
                            ]}
                            placeholder="Data di nascita"
                            placeholderTextColor={colors.muted}
                            editable={canEdit}
                            value={guest.birthDate}
                            onChangeText={(value) =>
                              updateGuest(room, guestIndex, "birthDate", value)
                            }
                          />

                          <TextInput
                            style={[
                              styles.input,
                              {
                                backgroundColor: colors.input,
                                borderColor: colors.border,
                                color: colors.text,
                              },
                            ]}
                            placeholder="Luogo di nascita"
                            placeholderTextColor={colors.muted}
                            editable={canEdit}
                            value={guest.birthPlace}
                            onChangeText={(value) =>
                              updateGuest(room, guestIndex, "birthPlace", value)
                            }
                          />

                          <TextInput
                            style={[
                              styles.input,
                              styles.notesInput,
                              {
                                backgroundColor: colors.input,
                                borderColor: colors.border,
                                color: colors.text,
                              },
                            ]}
                            placeholder="Note / allergie / esigenze"
                            placeholderTextColor={colors.muted}
                            editable={canEdit}
                            value={guest.notes || ""}
                            onChangeText={(value) =>
                              updateGuest(room, guestIndex, "notes", value)
                            }
                            multiline
                          />

                          <Text
                            style={[styles.packTitle, { color: colors.text }]}
                          >
                            Pack
                          </Text>

                          <View style={styles.packWrap}>
                            {availablePacks.length === 0 ? (
                              <Text
                                style={[
                                  styles.emptyText,
                                  { color: colors.secondary },
                                ]}
                              >
                                Nessun pack disponibile.
                              </Text>
                            ) : (
                              availablePacks.map((pack) => {
                                const selected =
                                  guest.selectedPackId === pack.id;

                                return (
                                  <TouchableOpacity
                                    key={pack.id}
                                    disabled={!canEdit}
                                    style={[
                                      styles.packButton,
                                      selected && styles.packButtonActive,
                                    ]}
                                    onPress={() =>
                                      updatePackSelection(
                                        room,
                                        guestIndex,
                                        pack,
                                      )
                                    }
                                  >
                                    <Text
                                      style={[
                                        styles.packButtonText,
                                        selected && styles.packButtonTextActive,
                                      ]}
                                    >
                                      {`Pack ${pack.letter || "-"} • €${getPackTotalForRoom(
                                        pack,
                                        room.roomType,
                                      )}`}
                                    </Text>
                                  </TouchableOpacity>
                                );
                              })
                            )}
                          </View>
                        </View>
                      ))}

                      <View style={styles.roomTotalBox}>
                        <Text style={styles.roomTotalLabel}>Totale camera</Text>

                        <Text style={styles.roomTotalValue}>
                          € {getRoomPackTotal(room).toFixed(2)}
                        </Text>
                      </View>
                    </View>
                  );
                })
              : null}
          </View>
        );
      })}
      {rooms.length === 0 ? (
        <View style={styles.emptyBox}>
          <Ionicons name="bed" size={48} color={colors.secondary} />

          <Text style={styles.emptyTitle}>Nessuna camera</Text>

          <Text style={[styles.emptyText, { color: colors.secondary }]}>
            Nessuna camera assegnata a questo maestro.
          </Text>
        </View>
      ) : null}
      {role === "teacher" ? (
        <TouchableOpacity
          style={[
            styles.saveButton,
            (savingRooms || isTeacherLocked) && styles.saveButtonDisabled,
          ]}
          disabled={savingRooms || isTeacherLocked}
          onPress={saveRooms}
        >
          <Text style={styles.saveButtonText}>
            {savingRooms ? "Salvataggio..." : "Salva camere"}
          </Text>
        </TouchableOpacity>
      ) : null}
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
      padding: 20,
      paddingBottom: 120,
    },

    loadingContainer: {
      flex: 1,
      padding: 20,
      backgroundColor: colors.background,
    },

    skeletonCard: {
      height: 120,
      borderRadius: 20,
      backgroundColor: colors.cardAlt,
      marginBottom: 16,
    },

    title: {
      color: colors.text,
      fontSize: 34,
      fontWeight: "900",
    },

    subtitle: {
      color: colors.secondary,
      fontSize: 15,
      lineHeight: 22,
      marginTop: 10,
      marginBottom: 22,
    },

    statsCard: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 18,
    },

    statBox: {
      flex: 1,
      borderRadius: 22,
      paddingVertical: 18,
      alignItems: "center",
      marginHorizontal: 4,
    },

    statNumber: {
      color: colors.text,
      fontSize: 24,
      fontWeight: "900",
    },

    statLabel: {
      color: colors.secondary,
      fontSize: 13,
      marginTop: 6,
    },

    moneyCard: {
      backgroundColor: colors.cardAlt,
      borderRadius: 24,
      padding: 18,
      marginBottom: 18,
    },

    moneyRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 10,
    },

    moneyLabel: {
      color: colors.secondary,
      fontSize: 15,
    },

    moneyValue: {
      color: colors.text,
      fontSize: 16,
      fontWeight: "900",
    },

    moneyPaid: {
      color: colors.success,
      fontSize: 16,
      fontWeight: "900",
    },

    moneyUnpaid: {
      color: colors.primary,
      fontSize: 16,
      fontWeight: "900",
    },

    deadlineCard: {
      backgroundColor: colors.cardAlt,
      borderRadius: 18,
      padding: 16,
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 18,
    },

    deadlineText: {
      color: colors.text,
      marginLeft: 12,
      flex: 1,
      lineHeight: 21,
    },

    lockedCard: {
      backgroundColor: colors.primary,
      borderRadius: 20,
      padding: 16,
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 20,
    },

    lockedText: {
      color: colors.text,
      marginLeft: 12,
      flex: 1,
      fontWeight: "700",
    },

    typeSection: {
      marginBottom: 26,
    },

    typeHeader: {
      backgroundColor: colors.cardAlt,
      borderRadius: 22,
      padding: 18,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },

    typeTitle: {
      color: colors.text,
      fontSize: 22,
      fontWeight: "900",
    },

    typeSubtitle: {
      color: colors.secondary,
      fontSize: 14,
      fontWeight: "800",
      marginTop: 4,
    },

    roomCard: {
      backgroundColor: colors.card,
      borderRadius: 26,
      padding: 18,
      marginTop: 16,
    },

    roomTop: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 16,
    },

    roomTitle: {
      color: colors.text,
      fontSize: 20,
      fontWeight: "900",
    },

    roomSubtitle: {
      color: colors.secondary,
      marginTop: 5,
    },

    statusBadge: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 999,
    },

    statusComplete: {
      backgroundColor: colors.success,
    },

    statusPartial: {
      backgroundColor: colors.warning,
    },

    statusEmpty: {
      backgroundColor: colors.placeholder,
    },

    statusText: {
      color: colors.onPrimary,
      fontWeight: "900",
      fontSize: 12,
    },

    roomNameInput: {
      backgroundColor: colors.input,
      borderRadius: 18,
      paddingHorizontal: 16,
      paddingVertical: 14,
      color: colors.text,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },

    guestCard: {
      backgroundColor: colors.cardAlt,
      borderRadius: 20,
      padding: 16,
      marginBottom: 16,
    },

    guestHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 14,
    },

    guestTitle: {
      color: colors.text,
      fontSize: 16,
      fontWeight: "900",
    },

    input: {
      backgroundColor: colors.input,
      borderRadius: 16,
      paddingHorizontal: 16,
      paddingVertical: 14,
      color: colors.text,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },

    packTitle: {
      color: colors.text,
      fontWeight: "900",
      marginBottom: 10,
      marginTop: 6,
    },

    packWrap: {
      flexDirection: "row",
      flexWrap: "wrap",
    },

    packButton: {
      backgroundColor: colors.primary,
      borderRadius: 16,
      paddingHorizontal: 14,
      paddingVertical: 12,
      marginRight: 10,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: colors.primary,
    },

    packButtonActive: {
      backgroundColor: colors.accentGold,
      borderColor: colors.accentGold,
      borderWidth: 2,
    },

    packButtonText: {
      color: colors.onPrimary,
      fontWeight: "800",
    },

    packButtonTextActive: {
      color: "#061A36",
      fontWeight: "900",
    },

    roomTotalBox: {
      backgroundColor: colors.cardAlt,
      borderRadius: 18,
      padding: 16,
      marginTop: 6,
      flexDirection: "row",
      justifyContent: "space-between",
    },

    roomTotalLabel: {
      color: colors.secondary,
      fontWeight: "700",
    },

    roomTotalValue: {
      color: colors.text,
      fontSize: 18,
      fontWeight: "900",
    },

    emptyBox: {
      alignItems: "center",
      marginTop: 60,
    },

    emptyTitle: {
      color: colors.text,
      fontSize: 20,
      fontWeight: "900",
      marginTop: 16,
    },

    emptyText: {
      color: colors.secondary,
      textAlign: "center",
      marginTop: 8,
      lineHeight: 22,
    },

    saveButton: {
      backgroundColor: colors.primary,
      borderRadius: 24,
      paddingVertical: 18,
      alignItems: "center",
      marginTop: 20,
    },

    saveButtonDisabled: {
      opacity: 0.6,
    },

    saveButtonText: {
      color: colors.onPrimary,
      fontSize: 16,
      fontWeight: "900",
    },

    moveGuestButton: {
      backgroundColor: colors.primary,
      borderRadius: 14,
      paddingVertical: 10,
      paddingHorizontal: 12,
      flexDirection: "row",
      alignItems: "center",
    },

    moveGuestButtonText: {
      color: colors.onPrimary,
      fontWeight: "900",
      marginLeft: 6,
    },

    movePanel: {
      backgroundColor: colors.card,
      borderRadius: 28,
      padding: 20,
      marginBottom: 20,
    },

    movePanelHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 12,
    },

    movePanelTitle: {
      color: colors.text,
      fontSize: 22,
      fontWeight: "900",
    },

    movePanelSubtitle: {
      color: colors.primary,
      marginTop: 4,
      fontWeight: "700",
    },

    moveCloseButton: {
      width: 42,
      height: 42,
      borderRadius: 14,
      backgroundColor: colors.cardAlt,
      alignItems: "center",
      justifyContent: "center",
    },

    moveText: {
      color: colors.secondary,
      lineHeight: 22,
      marginBottom: 16,
    },

    moveRoomBox: {
      backgroundColor: colors.input,
      borderRadius: 18,
      padding: 14,
      marginBottom: 14,
    },

    moveRoomTitle: {
      color: colors.text,
      fontWeight: "900",
      marginBottom: 12,
    },

    movePlacesWrap: {
      flexDirection: "row",
      flexWrap: "wrap",
    },

    movePlaceButton: {
      backgroundColor: colors.border,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 12,
      marginRight: 10,
      marginBottom: 10,
    },

    movePlaceButtonEmpty: {
      backgroundColor: colors.primary,
    },

    movePlaceButtonOrigin: {
      backgroundColor: colors.placeholder,
    },

    movePlaceText: {
      color: colors.onPrimary,
      fontWeight: "900",
    },
  });
