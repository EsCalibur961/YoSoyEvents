import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useFocusEffect } from "expo-router";
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
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { useTheme } from "../../../contexts/ThemeContext";
import { useFeedback } from "../../../contexts/FeedbackContext";
import { db } from "../../../firebase";
import { sendPushNotificationsToRoleAsync } from "../../../services/pushNotifications";

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
  startDate?: string;
  endDate?: string;
  packs?: EventPack[];
  allowStayDateSelection?: boolean;
};

type Guest = {
  firstName: string;
  lastName: string;
  birthDate: string;
  birthPlace: string;
  selectedPackId: string;
  selectedPackLetter: string;
  selectedPackPrice: string;
  selectedStayDates: string[];
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
  selectedStayDates: [],
  notes: "",
});

export default function TeacherWebRoomsScreen() {
  const { colors, isDark } = useTheme();
  const { width } = useWindowDimensions();
  const { success, error, warning, info, confirm } = useFeedback();
  const styles = createStyles(colors, isDark, width < 700);
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

  const parseItalianDate = (value?: string) => {
    if (!value) return null;

    const parts = value.trim().split("/");
    if (parts.length !== 3) return null;

    const [day, month, year] = parts.map(Number);
    if (!day || !month || !year) return null;

    const date = new Date(year, month - 1, day);

    if (
      date.getFullYear() !== year ||
      date.getMonth() !== month - 1 ||
      date.getDate() !== day
    ) {
      return null;
    }

    return date;
  };

  const formatItalianDate = (date: Date) => {
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    return `${day}/${month}/${date.getFullYear()}`;
  };

  const getEventStayDates = () => {
    const start = parseItalianDate(activeEvent?.startDate);
    const end = parseItalianDate(activeEvent?.endDate);

    if (!start || !end || end.getTime() < start.getTime()) return [];

    const dates: string[] = [];
    const current = new Date(start);

    while (current.getTime() <= end.getTime() && dates.length < 31) {
      dates.push(formatItalianDate(current));
      current.setDate(current.getDate() + 1);
    }

    return dates;
  };

  const eventStayDates = getEventStayDates();

  const canSelectStayDates = Boolean(
    activeEvent?.allowStayDateSelection && eventStayDates.length > 0,
  );

  const formatStayDateLabel = (value: string) => {
    const date = parseItalianDate(value);
    if (!date) return value;

    return date.toLocaleDateString("it-IT", {
      day: "2-digit",
      month: "short",
    });
  };

  const normalizeGuest = (guest: any): Guest => ({
    firstName: guest?.firstName || "",
    lastName: guest?.lastName || "",
    birthDate: guest?.birthDate || "",
    birthPlace: guest?.birthPlace || "",
    selectedPackId: guest?.selectedPackId || "",
    selectedPackLetter: guest?.selectedPackLetter || "",
    selectedPackPrice: guest?.selectedPackPrice || "",
    selectedStayDates: Array.isArray(guest?.selectedStayDates)
      ? guest.selectedStayDates.filter(Boolean)
      : [],
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

  const isGuestComplete = (guest: Guest) => {
    const baseComplete = Boolean(
      guest.firstName.trim() &&
        guest.lastName.trim() &&
        guest.birthDate.trim() &&
        guest.birthPlace.trim() &&
        guest.selectedPackId.trim(),
    );

    if (!baseComplete) return false;
    if (!canSelectStayDates) return true;

    return Boolean(guest.selectedStayDates?.length);
  };

  const isGuestEmpty = (guest: Guest) => {
    return (
      !guest.firstName.trim() &&
      !guest.lastName.trim() &&
      !guest.birthDate.trim() &&
      !guest.birthPlace.trim() &&
      !guest.selectedPackId.trim() &&
      !(guest.selectedStayDates?.length)
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

  const getRoomStatus = (room: RoomData): "complete" | "partial" | "empty" => {
    const startedGuests = room.guests.filter((guest) => !isGuestEmpty(guest));

    if (startedGuests.length === 0 && !room.customName?.trim()) {
      return "empty";
    }

    if (isRoomComplete(room)) {
      return "complete";
    }

    return "partial";
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
      { key: "selectedStayDates", label: "Giorni permanenza" },
      { key: "notes", label: "Note" },
    ];

    return fields
      .filter(({ key }) => {
        const oldValue = oldGuest?.[key];
        const newValue = newGuest?.[key];

        if (Array.isArray(oldValue) || Array.isArray(newValue)) {
          return JSON.stringify(oldValue || []) !== JSON.stringify(newValue || []);
        }

        return String(oldValue || "") !== String(newValue || "");
      })
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

  const selectedPacksCount = useMemo(() => {
    return rooms.reduce(
      (sum, room) =>
        sum +
        room.guests.filter((guest) => Boolean(guest.selectedPackId?.trim()))
          .length,
      0,
    );
  }, [rooms]);

  const totalPackAmount = useMemo(() => {
    return rooms.reduce((sum, room) => sum + getRoomPackTotal(room), 0);
  }, [rooms, availablePacks]);

  const paidAmount = useMemo(() => {
    return rooms.reduce((sum, room) => {
      if (!isRoomPaid(room)) return sum;
      return sum + getRoomPackTotal(room);
    }, 0);
  }, [rooms, payments, availablePacks]);

  const unpaidAmount = Math.max(totalPackAmount - paidAmount, 0);

  const roomsByType = useCallback(
    (type: RoomType) => rooms.filter((room) => room.roomType === type),
    [rooms],
  );

  const toggleType = (type: RoomType) => {
    setOpenTypes((prev) => ({
      ...prev,
      [type]: !prev[type],
    }));
  };

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
    selectedStayDates: Array.isArray(guest?.selectedStayDates)
      ? guest.selectedStayDates.filter(Boolean)
      : [],
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

  const getRoomForDirectSave = (room: RoomData) => {
    const original = getOriginalRoom(room.id);

    if (!original || !isSavedRoom(room)) {
      return room;
    }

    const guests = room.guests.map((guest, guestIndex) => {
      const originalGuest = original.guests[guestIndex] || emptyGuest();

      const hasPackRequest = Boolean(
        pendingChangeRequests.current[`${room.id}-${guestIndex}-pack`],
      );

      const hasStayDatesRequest = Boolean(
        pendingChangeRequests.current[`${room.id}-${guestIndex}-stay-dates`],
      );

      return {
        ...guest,
        ...(hasPackRequest
          ? {
              selectedPackId: originalGuest.selectedPackId,
              selectedPackLetter: originalGuest.selectedPackLetter,
              selectedPackPrice: originalGuest.selectedPackPrice,
            }
          : {}),
        ...(hasStayDatesRequest
          ? {
              selectedStayDates: Array.isArray(originalGuest.selectedStayDates)
                ? [...originalGuest.selectedStayDates]
                : [],
            }
          : {}),
      };
    });

    return {
      ...room,
      guests,
    };
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
      try {
        await saveRoomToFirebase(room);
      } catch (error) {
        console.log("Autosave camera non riuscito:", error);
      } finally {
        delete saveTimers.current[room.id];
      }
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
      warning(
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

    // Nessun autosalvataggio durante la digitazione:
    // evitiamo che gli snapshot Firebase riscrivano i campi mentre l'utente scrive.
  };

  const toggleGuestStayDate = (
    room: RoomData,
    guestIndex: number,
    date: string,
  ) => {
    if (!canEdit || !canSelectStayDates) return;

    const updatedGuests = [...room.guests];
    const currentGuest = updatedGuests[guestIndex];
    const currentDates = Array.isArray(currentGuest.selectedStayDates)
      ? currentGuest.selectedStayDates
      : [];

    const selected = currentDates.includes(date);

    updatedGuests[guestIndex] = {
      ...currentGuest,
      selectedStayDates: selected
        ? currentDates.filter((item) => item !== date)
        : [...currentDates, date].sort((a, b) => {
            const aDate = parseItalianDate(a)?.getTime() || 0;
            const bDate = parseItalianDate(b)?.getTime() || 0;
            return aDate - bDate;
          }),
    };

    const originalForStayDates = getOriginalRoom(room.id);
    const originalStayDates =
      originalForStayDates?.guests?.[guestIndex]?.selectedStayDates || [];
    const nextStayDates = updatedGuests[guestIndex].selectedStayDates || [];

    if (
      JSON.stringify(originalStayDates) === JSON.stringify(nextStayDates) &&
      pendingChangeRequests.current[`${room.id}-${guestIndex}-stay-dates`]
    ) {
      delete pendingChangeRequests.current[
        `${room.id}-${guestIndex}-stay-dates`
      ];
    }

    const updatedRoom = {
      ...room,
      guests: updatedGuests,
    };

    setRoomsData((prev) =>
      prev.map((item) => (item.id === room.id ? updatedRoom : item)),
    );

    if (isSavedRoom(room)) {
      const original = getOriginalRoom(room.id);
      const oldGuest = original?.guests[guestIndex] || emptyGuest();
      const hadPreviousStayDates = Boolean(oldGuest.selectedStayDates?.length);

      // La prima selezione dei giorni NON è una modifica protetta:
      // diventa richiesta admin solo se esisteva già una permanenza salvata.
      if (hadPreviousStayDates) {
        pendingChangeRequests.current[`${room.id}-${guestIndex}-stay-dates`] = {
          requestType: "guest_stay_dates_updated",
          roomId: room.id,
          roomType: room.roomType,
          roomIndex: room.roomIndex,
          roomLabel: getRoomLabel(room),
          guestIndex,
          guestPosition: guestIndex + 1,
          oldData: formatGuestForRequest(oldGuest),
          newData: formatGuestForRequest(updatedGuests[guestIndex]),
          changedFields: ["Giorni permanenza"],
        };
        return;
      }
    }

    // Prima selezione: resta locale e verrà salvata con "Salva camere".
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
        : String(Number(pack.price || 0)),
    };

    const originalForPack = getOriginalRoom(room.id);
    const originalPackId =
      originalForPack?.guests?.[guestIndex]?.selectedPackId || "";

    if (
      originalPackId === updatedGuests[guestIndex].selectedPackId &&
      pendingChangeRequests.current[`${room.id}-${guestIndex}-pack`]
    ) {
      delete pendingChangeRequests.current[`${room.id}-${guestIndex}-pack`];
    }

    const duplicate = findDuplicateGuest(
      room.id,
      guestIndex,
      updatedGuests[guestIndex],
    );

    if (duplicate) {
      warning(
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

    if (isSavedRoom(room)) {
      const original = getOriginalRoom(room.id);
      const originalGuest = original?.guests[guestIndex] || emptyGuest();
      const hadPreviousPack = Boolean(originalGuest.selectedPackId?.trim());

      // Se l'ospite non aveva ancora un Pack, questa è la PRIMA scelta:
      // non deve generare alcuna richiesta all'admin.
      if (hadPreviousPack) {
        pendingChangeRequests.current[`${room.id}-${guestIndex}-pack`] = {
          requestType: "guest_pack_updated",
          roomId: room.id,
          roomType: room.roomType,
          roomIndex: room.roomIndex,
          roomLabel: getRoomLabel(room),
          guestIndex,
          guestPosition: guestIndex + 1,
          oldData: formatGuestForRequest(originalGuest),
          newData: formatGuestForRequest(updatedGuests[guestIndex]),
          changedFields: ["Pack"],
        };
        return;
      }
    }

    // Prima scelta Pack: resta locale e verrà salvata con "Salva camere".
  };

  const startMoveGuest = (room: RoomData, guestIndex: number) => {
    const guest = room.guests[guestIndex];

    if (!guest || isGuestEmpty(guest)) {
      warning("Ospite vuoto", "Non puoi spostare un posto vuoto.");
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
      warning("Modifiche bloccate", "Non puoi modificare le camere.");
      return;
    }

    const fromRoom = rooms.find((room) => room.id === movingGuest.fromRoomId);

    if (!fromRoom) {
      error("Camera non trovata", "La camera di partenza non è più disponibile.");
      return;
    }

    const targetGuest = toRoom.guests[toGuestIndex];

    if (!targetGuest || !isGuestEmpty(targetGuest)) {
      warning("Posto occupato", "Scegli un posto vuoto.");
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

      success(
        "Richiesta inviata",
        "Lo spostamento è stato inviato all’admin e verrà applicato dopo approvazione.",
      );
    } catch (error: any) {
      error(
        "Richiesta non inviata",
        String(error?.message || "Non è stato possibile inviare la richiesta all’admin."),
      );
    }
  };
  const clearRoomData = async (room: RoomData) => {
    if (!canEdit) {
      warning(
        "Modifiche bloccate",
        "Non puoi svuotare la camera perché le modifiche sono bloccate.",
      );
      return;
    }

    const clearedGuests = Array.from(
      { length: capacities[room.roomType] },
      () => emptyGuest(),
    );

    const clearedRoom: RoomData = {
      ...room,
      customName: "",
      guests: clearedGuests,
    };

    try {
      /*
        CAMERA GIÀ SALVATA:
        il maestro NON deve modificare roomsData direttamente.
        Inviamo una sola richiesta atomica all'admin e lasciamo
        tutti i dati visibili fino all'approvazione.
      */
      if (isSavedRoom(room)) {
        const original = getOriginalRoom(room.id) || room;

        // Sicurezza: annulliamo qualsiasi autosave eventualmente rimasto in coda.
        if (saveTimers.current[room.id]) {
          clearTimeout(saveTimers.current[room.id]);
          delete saveTimers.current[room.id];
        }

        // Eliminiamo eventuali modifiche pendenti locali di questa camera:
        // la richiesta "svuota camera" rappresenta l'intera operazione.
        Object.entries(pendingChangeRequests.current).forEach(([key, value]) => {
          if (value?.roomId === room.id) {
            delete pendingChangeRequests.current[key];
          }
        });

        await createRoomChangeRequest({
          requestType: "room_cleared",
          roomId: room.id,
          roomType: room.roomType,
          roomIndex: room.roomIndex,
          roomLabel: getRoomLabel(original),
          oldData: {
            customName: original.customName || "",
            guests: (original.guests || []).map((guest) =>
              formatGuestForRequest(guest),
            ),
          },
          newData: {
            customName: "",
            guests: clearedGuests.map((guest) => formatGuestForRequest(guest)),
          },
          changedFields: [
            "Tutti i dati della camera",
            "Ospiti",
            "Pack",
            "Giorni permanenza",
            "Note",
          ],
        });

        // IMPORTANTISSIMO:
        // non chiamiamo setRoomsData e non scriviamo roomsData.
        // La camera resta identica finché l'admin non approva.
        success(
          "Richiesta inviata",
          "La camera NON è stata svuotata. I dati resteranno visibili finché l’admin non approverà l’eliminazione.",
        );
        return;
      }

      /*
        CAMERA NON ANCORA SALVATA:
        può essere svuotata direttamente perché non è ancora una camera
        definitiva sottoposta al flusso di approvazione.
      */
      if (saveTimers.current[room.id]) {
        clearTimeout(saveTimers.current[room.id]);
        delete saveTimers.current[room.id];
      }

      await setDoc(
        doc(db, "roomsData", room.id),
        {
          teacherUsername: room.teacherUsername,
          roomType: room.roomType,
          roomIndex: room.roomIndex,
          customName: "",
          guests: clearedRoom.guests,
          isSaved: false,
          paymentVisible: false,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );

      originalRoomsRef.current[room.id] = clearedRoom;

      setRoomsData((prev) => {
        const exists = prev.some((item) => item.id === room.id);

        if (exists) {
          return prev.map((item) => (item.id === room.id ? clearedRoom : item));
        }

        return [...prev, clearedRoom];
      });

      success(
        "Camera svuotata",
        "Tutti i dati della camera non ancora salvata sono stati eliminati.",
      );
    } catch (clearError: any) {
      error(
        "Operazione non riuscita",
        String(
          clearError?.message ||
            "Non è stato possibile gestire lo svuotamento della camera.",
        ),
      );
    }
  };

  const requestClearRoom = (room: RoomData) => {
    const hasData =
      Boolean(room.customName?.trim()) ||
      room.guests.some((guest) => !isGuestEmpty(guest));

    if (!hasData) {
      info("Camera già vuota", "Non ci sono dati da eliminare.");
      return;
    }

    confirm({
      title: "Svuotare questa camera?",
      message:
        "Verranno rimossi nome camera, dati anagrafici, pack, giorni di permanenza, note e allergie. L’assegnazione della camera resterà attiva.",
      confirmText: isSavedRoom(room) ? "Invia richiesta" : "Elimina dati",
      cancelText: "Annulla",
      destructive: true,
      onConfirm: () => clearRoomData(room),
    });
  };

  const saveTeacherActivity = async () => {
    if (role !== "teacher" || !teacherUsername) return;

    const roomSnapshot = rooms
      .map((room) => {
        const guests = room.guests
          .map((guest, guestIndex) => ({
            position: guestIndex + 1,
            firstName: guest.firstName || "",
            lastName: guest.lastName || "",
            birthDate: guest.birthDate || "",
            birthPlace: guest.birthPlace || "",
            selectedPackId: guest.selectedPackId || "",
            selectedPackLetter: guest.selectedPackLetter || "",
            selectedPackPrice: guest.selectedPackPrice || "",
            selectedStayDates: Array.isArray(guest.selectedStayDates)
              ? guest.selectedStayDates
              : [],
            notes: guest.notes || "",
            isComplete: Boolean(isGuestComplete(guest)),
          }))
          .filter((guest) =>
            Boolean(
              guest.firstName ||
                guest.lastName ||
                guest.birthDate ||
                guest.birthPlace ||
                guest.selectedPackId ||
                guest.notes,
            ),
          );

        return {
          roomId: room.id,
          roomType: room.roomType,
          roomIndex: room.roomIndex,
          roomLabel: getRoomLabel(room),
          guests,
          occupiedPlaces: guests.length,
          completeGuests: guests.filter((guest) => guest.isComplete).length,
          isComplete: Boolean(isRoomComplete(room)),
          isSaved: Boolean(isSavedRoom(room) || isRoomComplete(room)),
        };
      })
      .filter((room) => room.guests.length > 0);

    await addDoc(collection(db, "teacherActivities"), {
      teacherUsername,
      action: "Salvataggio camere",
      details: `Camere complete: ${completedRooms}/${rooms.length}. Posti segnati: ${occupiedPlaces}.`,
      completedRooms,
      totalRooms: rooms.length,
      occupiedPlaces,
      roomSnapshot,
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
          canSelectStayDates
            ? (guest.selectedStayDates?.length || 0) > 0
              ? "stay-date-selected"
              : ""
            : "stay-date-not-required",
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
        warning(
          "Modifiche bloccate",
          "Il tempo per modificare le stanze è scaduto.",
        );
        return;
      }

      if (hasPartialGuests()) {
        warning(
          "Dati incompleti",
          "Completa i dati degli ospiti iniziati oppure lasciali totalmente vuoti.",
        );
        return;
      }

      const protectedRequests = Object.entries(
        pendingChangeRequests.current,
      ).filter(
        ([, request]) =>
          request?.requestType === "guest_pack_updated" ||
          request?.requestType === "guest_stay_dates_updated",
      );

      const roomsToSave = rooms.filter((room) => isRoomComplete(room));

      if (roomsToSave.length === 0 && protectedRequests.length === 0) {
        info("Nessuna modifica", "Non ci sono modifiche da salvare.");
        return;
      }

      // Eliminiamo qualsiasi vecchio timer rimasto da versioni precedenti.
      rooms.forEach((room) => {
        if (saveTimers.current[room.id]) {
          clearTimeout(saveTimers.current[room.id]);
          delete saveTimers.current[room.id];
        }
      });

      /*
        Salvataggio diretto:
        - nome camera
        - nome/cognome
        - data/luogo nascita
        - note/allergie

        Se sulla stessa camera c'è anche una modifica protetta (Pack/giorni),
        salviamo i dati normali mantenendo TEMPORANEAMENTE Pack/giorni originali.
        Quelli cambieranno soltanto dopo approvazione admin.
      */
      const directSaveRooms = roomsToSave.map((room) =>
        getRoomForDirectSave(room),
      );

      await Promise.all(
        directSaveRooms.map((room) => saveRoomToFirebase(room, true)),
      );

      // Le modifiche protette vengono inviate all'admin.
      for (const [key, request] of protectedRequests) {
        await createRoomChangeRequest(request);
        delete pendingChangeRequests.current[key];
      }

      // Aggiorniamo l'originale solo con ciò che è stato DAVVERO scritto su Firebase.
      directSaveRooms.forEach((room) => {
        originalRoomsRef.current[room.id] = {
          ...room,
          guests: room.guests.map((guest) => ({
            ...guest,
            selectedStayDates: Array.isArray(guest.selectedStayDates)
              ? [...guest.selectedStayDates]
              : [],
          })),
        };
      });

      await notifyAdminRoomsCompleted(
        directSaveRooms.filter((room) => !isSavedRoom(room)).length,
      );

      await saveTeacherActivity();

      if (protectedRequests.length > 0) {
        success(
          "Salvataggio completato",
          "I dati normali sono stati salvati. Cambio Pack e/o giorni permanenza sono stati inviati all’admin per approvazione.",
        );
      } else {
        success(
          "Camere salvate ✓",
          "Tutti i dati della camera sono stati salvati correttamente.",
        );
      }
    } catch (saveError: any) {
      error(
        "Salvataggio non riuscito",
        String(saveError?.message || saveError),
      );
    } finally {
      setSavingRooms(false);
    }
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.webHeader}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.webEyebrow, { color: colors.primary }]}>
            YO SOY EVENTS / WEB MAESTRO
          </Text>
          <Text style={[styles.title, { color: colors.text }]}>Le tue stanze</Text>
          <Text style={[styles.subtitle, { color: colors.secondary }]}>
            Compila ospiti, Pack, permanenza e note usando le stesse regole dell’app.
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.backWebButton, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => router.replace("/web/teacher")}
        >
          <Ionicons name="home-outline" size={18} color={colors.primary} />
          <Text style={[styles.backWebText, { color: colors.primary }]}>
            Home maestro
          </Text>
        </TouchableOpacity>
      </View>
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

                        <View style={styles.roomTopActions}>
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

                          {role === "teacher" && canEdit ? (
                            <TouchableOpacity
                              style={styles.clearRoomButton}
                              onPress={() => requestClearRoom(room)}
                            >
                              <Ionicons
                                name="trash-outline"
                                size={17}
                                color={colors.danger}
                              />
                            </TouchableOpacity>
                          ) : null}
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
                                      {`Pack ${pack.letter || "-"} • €${Number(pack.price || 0)}${
                                        getSupplementForRoom(pack, room.roomType) > 0
                                          ? ` + €${getSupplementForRoom(pack, room.roomType)} supplemento ${room.roomType.toLowerCase()}`
                                          : ""
                                      }`}
                                    </Text>
                                  </TouchableOpacity>
                                );
                              })
                            )}
                          </View>
                          {canSelectStayDates ? (
                            <View style={styles.stayDatesSection}>
                              <View style={styles.stayDatesHeader}>
                                <View style={styles.stayDatesIconBox}>
                                  <Ionicons
                                    name="calendar-outline"
                                    size={17}
                                    color={colors.primary}
                                  />
                                </View>

                                <View style={{ flex: 1 }}>
                                  <Text
                                    style={[
                                      styles.stayDatesTitle,
                                      { color: colors.text },
                                    ]}
                                  >
                                    Giorni di permanenza
                                  </Text>
                                  <Text
                                    style={[
                                      styles.stayDatesHelp,
                                      { color: colors.secondary },
                                    ]}
                                  >
                                    Seleziona uno o più giorni per questo ospite.
                                  </Text>
                                </View>
                              </View>

                              <View style={styles.stayDatesWrap}>
                                {eventStayDates.map((date) => {
                                  const selected =
                                    guest.selectedStayDates?.includes(date);

                                  return (
                                    <TouchableOpacity
                                      key={date}
                                      disabled={!canEdit}
                                      style={[
                                        styles.stayDateChip,
                                        {
                                          backgroundColor: selected
                                            ? colors.primary
                                            : colors.input,
                                          borderColor: selected
                                            ? colors.primary
                                            : colors.border,
                                        },
                                      ]}
                                      onPress={() =>
                                        toggleGuestStayDate(
                                          room,
                                          guestIndex,
                                          date,
                                        )
                                      }
                                    >
                                      <Ionicons
                                        name={
                                          selected
                                            ? "checkmark-circle"
                                            : "ellipse-outline"
                                        }
                                        size={15}
                                        color={
                                          selected
                                            ? colors.onPrimary
                                            : colors.secondary
                                        }
                                      />

                                      <Text
                                        style={[
                                          styles.stayDateChipText,
                                          {
                                            color: selected
                                              ? colors.onPrimary
                                              : colors.text,
                                          },
                                        ]}
                                      >
                                        {formatStayDateLabel(date)}
                                      </Text>
                                    </TouchableOpacity>
                                  );
                                })}
                              </View>

                              {guest.selectedStayDates?.length ? (
                                <Text
                                  style={[
                                    styles.stayDatesSelectedText,
                                    { color: colors.success },
                                  ]}
                                >
                                  Permanenza: {guest.selectedStayDates.join(" • ")}
                                </Text>
                              ) : (
                                <Text
                                  style={[
                                    styles.stayDatesRequiredText,
                                    { color: colors.warning },
                                  ]}
                                >
                                  Seleziona almeno un giorno.
                                </Text>
                              )}
                            </View>
                          ) : null}

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
const createStyles = (colors: any, isDark: boolean, isMobile: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },

    content: {
      width: "100%",
      maxWidth: 1280,
      alignSelf: "center",
      paddingHorizontal: isMobile ? 14 : 28,
      paddingTop: 28,
      paddingBottom: 110,
    },

    webHeader: {
      flexDirection: isMobile ? "column" : "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      gap: 20,
      marginBottom: 4,
    },

    webEyebrow: {
      fontSize: 9,
      fontWeight: "900",
      letterSpacing: 1.2,
      marginBottom: 5,
    },

    backWebButton: {
      minHeight: 42,
      borderWidth: 1,
      borderRadius: 14,
      paddingHorizontal: 13,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
    },

    backWebText: {
      fontSize: 9,
      fontWeight: "900",
      marginLeft: 6,
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
      fontSize: 32,
      fontWeight: "900",
    },

    subtitle: {
      color: colors.secondary,
      fontSize: 12,
      lineHeight: 18,
      marginTop: 6,
      marginBottom: 18,
    },

    statsCard: {
      flexDirection: isMobile ? "column" : "row",
      justifyContent: "space-between",
      gap: 10,
      marginBottom: 12,
    },

    statBox: {
      flex: 1,
      borderRadius: 22,
      paddingVertical: 18,
      alignItems: "center",
      marginHorizontal: 0,
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
      marginBottom: 18,
    },

    typeHeader: {
      backgroundColor: colors.cardAlt,
      borderRadius: 22,
      padding: 18,
      flexDirection: isMobile ? "column" : "row",
      justifyContent: "space-between",
      alignItems: isMobile ? "flex-start" : "center",
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
      width: "100%",
      backgroundColor: colors.card,
      borderRadius: 22,
      padding: 18,
      marginTop: 12,
    },

    roomTop: {
      flexDirection: isMobile ? "column" : "row",
      justifyContent: "space-between",
      alignItems: isMobile ? "stretch" : "center",
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

    roomTopActions: {
      flexDirection: "row",
      flexWrap: "wrap",
      alignItems: "center",
      gap: 7,
    },

    clearRoomButton: {
      width: 44,
      height: 44,
      borderRadius: 12,
      backgroundColor: `${colors.danger}12`,
      borderWidth: 1,
      borderColor: `${colors.danger}35`,
      alignItems: "center",
      justifyContent: "center",
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

    stayDatesSection: {
      marginTop: 14,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingTop: 13,
    },

    stayDatesHeader: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 10,
    },

    stayDatesIconBox: {
      width: 34,
      height: 34,
      borderRadius: 11,
      backgroundColor: `${colors.primary}12`,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 9,
    },

    stayDatesTitle: {
      fontSize: 13,
      fontWeight: "900",
    },

    stayDatesHelp: {
      fontSize: 9,
      lineHeight: 13,
      fontWeight: "700",
      marginTop: 2,
    },

    stayDatesWrap: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 7,
    },

    stayDateChip: {
      minHeight: 44,
      borderRadius: 12,
      borderWidth: 1,
      paddingHorizontal: 10,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
    },

    stayDateChipText: {
      fontSize: 10,
      fontWeight: "900",
      marginLeft: 5,
    },

    stayDatesSelectedText: {
      fontSize: 9,
      lineHeight: 14,
      fontWeight: "900",
      marginTop: 9,
    },

    stayDatesRequiredText: {
      fontSize: 9,
      lineHeight: 14,
      fontWeight: "900",
      marginTop: 9,
    },

    guestCard: {
      backgroundColor: colors.cardAlt,
      borderRadius: 18,
      padding: 16,
      marginBottom: 14,
    },

    guestHeader: {
      flexDirection: isMobile ? "column" : "row",
      justifyContent: "space-between",
      alignItems: isMobile ? "stretch" : "center",
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
      flexDirection: isMobile ? "column" : "row",
      gap: 6,
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

    saveFeedbackCard: {
      backgroundColor: `${colors.success}12`,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: `${colors.success}55`,
      padding: 12,
      marginTop: 12,
      marginBottom: 10,
      flexDirection: "row",
      alignItems: "flex-start",
    },

    saveFeedbackIcon: {
      width: 34,
      height: 34,
      borderRadius: 11,
      backgroundColor: `${colors.success}14`,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 9,
    },

    saveFeedbackInfo: {
      flex: 1,
      paddingRight: 8,
    },

    saveFeedbackTitle: {
      color: colors.success,
      fontSize: 13,
      fontWeight: "900",
    },

    saveFeedbackMessage: {
      color: colors.secondary,
      fontSize: 10,
      lineHeight: 15,
      fontWeight: "700",
      marginTop: 3,
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
      width: "100%",
      backgroundColor: colors.card,
      borderRadius: 22,
      padding: 18,
      marginBottom: 18,
    },

    movePanelHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 12,
    },

    movePanelTitle: {
      color: colors.onPrimary,
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

    notesInput: {
      minHeight: 92,
      textAlignVertical: "top",
    },
  });
