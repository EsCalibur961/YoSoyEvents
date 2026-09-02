import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useFocusEffect } from "expo-router";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { useCallback, useMemo, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { useFeedback } from "../../contexts/FeedbackContext";
import { db } from "../../firebase";
import { repriceGuestForRoom } from "../../utils/packPricing.mjs";

type AppNotification = {
  id: string;
  title: string;
  message: string;
  type: "event" | "room" | "system";
  eventId?: string;
  targetRole?: "admin" | "teacher";
  targetUsername?: string;
  createdAt?: string;
  createdAtServer?: any;
};

type NotificationRead = {
  id: string;
  notificationId: string;
  username: string;
  read: boolean;
};

type NotificationDeleted = {
  id: string;
  notificationId: string;
  username: string;
  deleted?: boolean;
};

type Guest = {
  firstName: string;
  lastName: string;
  birthDate: string;
  birthPlace: string;
  selectedPackId: string;
  selectedPackLetter: string;
  selectedPackPrice: string;
  selectedStayDates?: string[];
  notes?: string;
};

type RoomChangeRequest = {
  id: string;
  teacherUsername?: string;
  teacherFullName?: string;
  danceSchool?: string;
  requestType?: string;
  status?: "pending" | "approved" | "rejected";
  rejectionReason?: string;
  roomId?: string;
  roomLabel?: string;
  roomType?: string;
  roomIndex?: number;
  guestIndex?: number;
  guestPosition?: number;
  changedFields?: string[];
  oldData?: any;
  newData?: any;
  createdAt?: string;
  reviewedAt?: string;
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

const requestTypeLabel = (type?: string) => {
  if (type === "room_name_updated") return "Nome camera modificato";
  if (type === "guest_moved") return "Spostamento ospite";
  if (type === "guest_pack_updated") return "Pack modificato";
  if (type === "guest_stay_dates_updated") return "Giorni permanenza modificati";
  if (type === "guest_added") return "Nuovo nominativo";
  if (type === "guest_cleared") return "Nominativo rimosso";
  if (type === "room_cleared") return "Eliminazione dati camera";
  return "Nominativo modificato";
};

const formatGuestName = (guest?: any) => {
  const name = `${guest?.firstName || ""} ${guest?.lastName || ""}`.trim();
  return name || "Non inserito";
};

export default function AdminWebRequestsScreen() {
  const { colors, isDark } = useTheme();
  const { width } = useWindowDimensions();
  const { success, error, warning, confirm } = useFeedback();
  const styles = createStyles(colors, isDark, width < 700);
  const [role, setRole] = useState<string | null>(null);
  const [teacherUsername, setTeacherUsername] = useState<string | null>(null);

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [reads, setReads] = useState<NotificationRead[]>([]);
  const [deletedNotifications, setDeletedNotifications] = useState<NotificationDeleted[]>([]);
  const [roomRequests, setRoomRequests] = useState<RoomChangeRequest[]>([]);
  const [rejectingRequestId, setRejectingRequestId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [applyingRequestId, setApplyingRequestId] = useState<string | null>(null);

  // Questa pagina web è dedicata esclusivamente alle richieste admin.
  // Non dipende più da ?mode=roomRequests, così /admin-web/requests
  // non può ricadere accidentalmente nella normale vista Notifiche.
  const isRoomRequestsMode = true;

  useFocusEffect(
    useCallback(() => {
      loadUser();

      const notificationsQuery = query(collection(db, "notifications"), orderBy("createdAtServer", "desc"));
      const requestsQuery = query(collection(db, "roomChangeRequests"), orderBy("createdAtServer", "desc"));

      const unsubNotifications = onSnapshot(notificationsQuery, (snapshot) => {
        const data: AppNotification[] = snapshot.docs.map((item) => ({
          id: item.id,
          ...(item.data() as Omit<AppNotification, "id">),
        }));
        setNotifications(data);
      });

      const unsubRequests = onSnapshot(requestsQuery, (snapshot) => {
        const data: RoomChangeRequest[] = snapshot.docs.map((item) => ({
          id: item.id,
          ...(item.data() as Omit<RoomChangeRequest, "id">),
        }));
        setRoomRequests(data);
      });

      const unsubReads = onSnapshot(collection(db, "notificationReads"), (snapshot) => {
        const data: NotificationRead[] = snapshot.docs.map((item) => ({
          id: item.id,
          ...(item.data() as Omit<NotificationRead, "id">),
        }));
        setReads(data);
      });

      const unsubDeleted = onSnapshot(collection(db, "notificationDeletes"), (snapshot) => {
        const data: NotificationDeleted[] = snapshot.docs.map((item) => ({
          id: item.id,
          ...(item.data() as Omit<NotificationDeleted, "id">),
        }));
        setDeletedNotifications(data);
      });

      return () => {
        unsubNotifications();
        unsubRequests();
        unsubReads();
        unsubDeleted();
      };
    }, []),
  );

  const loadUser = async () => {
    const savedRole = await AsyncStorage.getItem("loggedUser");
    const savedTeacherUsername = await AsyncStorage.getItem("teacherUsername");
    setRole(savedRole);
    setTeacherUsername(savedTeacherUsername);
  };

  const currentUsername = "admin";

  const isDeleted = (notificationId: string) => {
    return deletedNotifications.some(
      (item) => item.notificationId === notificationId && item.username === currentUsername && item.deleted,
    );
  };

  const pendingAdminRequests = useMemo(() => {
    return roomRequests.filter(
      (item) => (item.status || "pending") === "pending",
    );
  }, [roomRequests]);

  const visibleNotifications = useMemo(() => {
    if (!currentUsername) return notifications;

    return notifications.filter((item) => {
      if (isDeleted(item.id)) return false;
      if (item.type === "room" && item.targetRole === "admin") return false;
      if (!item.targetRole && !item.targetUsername) return true;
      if (item.targetUsername) return item.targetUsername === currentUsername;
      return item.targetRole === role;
    });
  }, [notifications, deletedNotifications, currentUsername, role]);

  const isRead = (notificationId: string) => {
    return reads.some(
      (item) => item.notificationId === notificationId && item.username === currentUsername && item.read,
    );
  };

  const unreadCount = useMemo(() => {
    if (!currentUsername) return 0;
    return isRoomRequestsMode
      ? pendingAdminRequests.length
      : visibleNotifications.filter((item) => !isRead(item.id)).length;
  }, [visibleNotifications, reads, currentUsername, pendingAdminRequests, isRoomRequestsMode]);

  const markAsRead = async (notificationId: string) => {
    if (!currentUsername) return;
    await setDoc(
      doc(db, "notificationReads", `${currentUsername}-${notificationId}`),
      { notificationId, username: currentUsername, read: true, readAt: serverTimestamp() },
      { merge: true },
    );
  };

  const deleteNotification = async (notificationId: string) => {
    if (!currentUsername) return;

    const optimisticId = `${currentUsername}-${notificationId}`;
    const optimisticDelete: NotificationDeleted = {
      id: optimisticId,
      notificationId,
      username: currentUsername,
      deleted: true,
    };

    setDeletedNotifications((prev) => {
      const exists = prev.some((item) => item.id === optimisticId);
      return exists
        ? prev.map((item) => (item.id === optimisticId ? optimisticDelete : item))
        : [...prev, optimisticDelete];
    });

    try {
      await setDoc(
        doc(db, "notificationDeletes", optimisticId),
        {
          notificationId,
          username: currentUsername,
          deleted: true,
          deletedAt: serverTimestamp(),
        },
        { merge: true },
      );
    } catch (error: any) {
      setDeletedNotifications((prev) =>
        prev.filter((item) => item.id !== optimisticId),
      );

      console.log("Errore eliminazione notifica:", error);

      error(
        "Errore eliminazione",
        String(error?.message || "Firebase non ha permesso di eliminare questa notifica."),
      );
    }
  };

  const markAllAsRead = async () => {
    await Promise.all(visibleNotifications.map((notification) => markAsRead(notification.id)));
  };

  const deleteAllNotifications = async () => {
    if (!currentUsername || visibleNotifications.length === 0) return;

    const optimisticDeletes: NotificationDeleted[] = visibleNotifications.map(
      (notification) => ({
        id: `${currentUsername}-${notification.id}`,
        notificationId: notification.id,
        username: currentUsername,
        deleted: true,
      }),
    );

    setDeletedNotifications((prev) => {
      const map = new Map(prev.map((item) => [item.id, item]));
      optimisticDeletes.forEach((item) => map.set(item.id, item));
      return Array.from(map.values());
    });

    try {
      await Promise.all(
        visibleNotifications.map((notification) =>
          setDoc(
            doc(db, "notificationDeletes", `${currentUsername}-${notification.id}`),
            {
              notificationId: notification.id,
              username: currentUsername,
              deleted: true,
              deletedAt: serverTimestamp(),
            },
            { merge: true },
          ),
        ),
      );
    } catch (error: any) {
      const optimisticIds = new Set(optimisticDeletes.map((item) => item.id));

      setDeletedNotifications((prev) =>
        prev.filter((item) => !optimisticIds.has(item.id)),
      );

      console.log("Errore eliminazione notifiche:", error);

      error(
        "Errore eliminazione",
        String(error?.message || "Firebase non ha permesso di eliminare le notifiche."),
      );
    }
  };

  const confirmDeleteAllNotifications = () => {
    confirm({
      title: "Eliminare tutte le notifiche?",
      message: "Le notifiche verranno rimosse solo dalla tua lista.",
      confirmText: "Elimina tutte",
      cancelText: "Annulla",
      destructive: true,
      onConfirm: async () => {
        await deleteAllNotifications();
        success("Notifiche eliminate", "La tua lista notifiche è stata svuotata.");
      },
    });
  };

  const confirmDeleteNotification = (notificationId: string) => {
    confirm({
      title: "Eliminare notifica?",
      message: "La notifica verrà rimossa solo dalla tua lista.",
      confirmText: "Elimina",
      cancelText: "Annulla",
      destructive: true,
      onConfirm: async () => {
        await deleteNotification(notificationId);
        success("Notifica eliminata", "La notifica è stata rimossa dalla tua lista.");
      },
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

  const readRoomGuests = async (roomId: string) => {
    const snap = await getDoc(doc(db, "roomsData", roomId));
    const data = snap.exists() ? snap.data() : {};
    const guests = Array.isArray(data.guests) ? data.guests.map((guest: any) => normalizeGuest(guest)) : [];
    return { data, guests };
  };

  const priceGuestForRoom = async (guest: Guest, roomType?: string) => {
    const eventsSnapshot = await getDocs(collection(db, "events"));
    const packs = eventsSnapshot.docs.flatMap((item) => {
      const data = item.data();
      return Array.isArray(data.packs) ? data.packs : [];
    });
    return repriceGuestForRoom(guest, packs, roomType || "");
  };

  const applyGuestChange = async (request: RoomChangeRequest) => {
    if (!request.roomId) {
      throw new Error("Camera non trovata nella richiesta.");
    }

    const guestIndex = Number(
      request.guestIndex ?? ((request.guestPosition || 1) - 1),
    );

    const roomRef = doc(db, "roomsData", request.roomId);
    const snap = await getDoc(roomRef);

    if (!snap.exists()) {
      throw new Error("Camera non trovata su Firebase.");
    }

    const roomData = snap.data();

    // IMPORTANTISSIMO:
    // manteniamo gli oggetti ospite ORIGINALI così come sono su Firestore.
    // Non normalizziamo l'intero array, perché una normalizzazione potrebbe
    // trasformare campi temporaneamente assenti in [] e sovrascrivere dati validi.
    const guests: any[] = Array.isArray(roomData.guests)
      ? roomData.guests.map((guest: any) => ({ ...guest }))
      : [];

    while (guests.length <= guestIndex) {
      guests.push(emptyGuest());
    }

    const currentGuest: any = {
      ...(guests[guestIndex] || {}),
    };

    const requestedGuest: any = request.newData || {};
    const oldRequestedGuest: any = request.oldData || {};

    if (request.requestType === "guest_cleared") {
      guests[guestIndex] = emptyGuest();
    } else if (request.requestType === "guest_pack_updated") {
      /*
        CAMBIO PACK:
        cambiamo ESCLUSIVAMENTE i 3 campi del Pack.

        selectedStayDates viene preservato dal documento corrente.
        Se per qualsiasi motivo non fosse presente nella lettura corrente,
        usiamo prima i giorni contenuti nel newData della richiesta e poi
        quelli dell'oldData. Non deve MAI diventare [] a causa del cambio Pack.
      */
      const preservedStayDates =
        Array.isArray(currentGuest.selectedStayDates) &&
        currentGuest.selectedStayDates.length > 0
          ? [...currentGuest.selectedStayDates]
          : Array.isArray(requestedGuest.selectedStayDates) &&
              requestedGuest.selectedStayDates.length > 0
            ? [...requestedGuest.selectedStayDates]
            : Array.isArray(oldRequestedGuest.selectedStayDates)
              ? [...oldRequestedGuest.selectedStayDates]
              : [];

      const pricedGuest = await priceGuestForRoom(
        normalizeGuest(requestedGuest),
        roomData.roomType,
      );
      guests[guestIndex] = {
        ...currentGuest,
        selectedPackId: pricedGuest.selectedPackId || "",
        selectedPackLetter: pricedGuest.selectedPackLetter || "",
        selectedPackPrice: pricedGuest.selectedPackPrice || "",
        selectedStayDates: preservedStayDates,
      };
    } else if (request.requestType === "guest_stay_dates_updated") {
      /*
        CAMBIO GIORNI:
        cambiamo ESCLUSIVAMENTE selectedStayDates.
        Il Pack e tutti gli altri dati restano quelli realmente presenti
        nel documento al momento dell'approvazione.
      */
      guests[guestIndex] = {
        ...currentGuest,
        selectedStayDates: Array.isArray(requestedGuest.selectedStayDates)
          ? [...requestedGuest.selectedStayDates]
          : [],
      };
    } else {
      // Compatibilità con eventuali vecchie richieste generiche:
      // manteniamo i campi correnti e sovrascriviamo solo quelli presenti
      // esplicitamente nella richiesta.
      guests[guestIndex] = {
        ...currentGuest,
        ...requestedGuest,
        selectedStayDates:
          typeof requestedGuest.selectedStayDates !== "undefined"
            ? Array.isArray(requestedGuest.selectedStayDates)
              ? [...requestedGuest.selectedStayDates]
              : currentGuest.selectedStayDates || []
            : currentGuest.selectedStayDates || [],
      };
    }

    await setDoc(
      roomRef,
      {
        guests,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  };

  const applyRoomNameChange = async (request: RoomChangeRequest) => {
    if (!request.roomId) throw new Error("Camera non trovata nella richiesta.");
    await setDoc(
      doc(db, "roomsData", request.roomId),
      { customName: request.newData?.customName || "", updatedAt: serverTimestamp() },
      { merge: true },
    );
  };

  const applyMoveGuest = async (request: RoomChangeRequest) => {
    const fromRoomId = request.oldData?.fromRoomId;
    const toRoomId = request.newData?.toRoomId || request.roomId;
    const fromIndex = Number(
      typeof request.oldData?.fromGuestIndex === "number"
        ? request.oldData.fromGuestIndex
        : (request.oldData?.fromGuestPosition || 1) - 1,
    );
    const toIndex = Number(
      typeof request.newData?.toGuestIndex === "number"
        ? request.newData.toGuestIndex
        : (request.newData?.toGuestPosition || request.guestPosition || 1) - 1,
    );
    let guest = normalizeGuest(request.newData?.guest || request.oldData?.guest);

    if (!fromRoomId || !toRoomId) {
      throw new Error("Dati spostamento incompleti.");
    }

    if (!guest.firstName && !guest.lastName) {
      throw new Error("Ospite mancante nella richiesta di spostamento.");
    }

    const fromRoom = await readRoomGuests(fromRoomId);

    if (fromRoomId === toRoomId) {
      guest = await priceGuestForRoom(guest, fromRoom.data.roomType);
      const guests = [...fromRoom.guests];
      while (guests.length <= Math.max(fromIndex, toIndex)) guests.push(emptyGuest());
      guests[fromIndex] = emptyGuest();
      guests[toIndex] = guest;

      await setDoc(
        doc(db, "roomsData", fromRoomId),
        {
          guests,
          isSaved: true,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
      return;
    }

    const toRoom = await readRoomGuests(toRoomId);
    guest = await priceGuestForRoom(guest, toRoom.data.roomType || request.roomType);
    const fromGuests = [...fromRoom.guests];
    const toGuests = [...toRoom.guests];

    while (fromGuests.length <= fromIndex) fromGuests.push(emptyGuest());
    while (toGuests.length <= toIndex) toGuests.push(emptyGuest());

    fromGuests[fromIndex] = emptyGuest();
    toGuests[toIndex] = guest;

    await Promise.all([
      setDoc(
        doc(db, "roomsData", fromRoomId),
        { guests: fromGuests, isSaved: true, updatedAt: serverTimestamp() },
        { merge: true },
      ),
      setDoc(
        doc(db, "roomsData", toRoomId),
        {
          teacherUsername: request.teacherUsername || "",
          roomType: request.roomType || "",
          roomIndex: request.roomIndex || 1,
          guests: toGuests,
          isSaved: true,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      ),
    ]);
  };

  const applyRoomClear = async (request: RoomChangeRequest) => {
    if (!request.roomId) {
      throw new Error("Camera non trovata nella richiesta.");
    }

    const current = await readRoomGuests(request.roomId);
    const currentGuests = Array.isArray(current.guests) ? current.guests : [];

    const requestedGuests = Array.isArray(request.newData?.guests)
      ? request.newData.guests.map((guest: any) => normalizeGuest(guest))
      : currentGuests.map(() => emptyGuest());

    await setDoc(
      doc(db, "roomsData", request.roomId),
      {
        customName: "",
        guests: requestedGuests,
        isSaved: true,
        paymentVisible: true,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  };

  const applyApprovedRoomChange = async (request: RoomChangeRequest) => {
    if (request.requestType === "room_cleared") {
      await applyRoomClear(request);
      return;
    }

    if (request.requestType === "room_name_updated") {
      await applyRoomNameChange(request);
      return;
    }

    if (request.requestType === "guest_moved") {
      await applyMoveGuest(request);
      return;
    }

    await applyGuestChange(request);
  };

  const notifyTeacherAboutRequest = async (request: RoomChangeRequest, approved: boolean, reason?: string) => {
    await addDoc(collection(db, "notifications"), {
      title: approved ? "Richiesta approvata" : "Richiesta rifiutata",
      message: approved
        ? `La modifica su ${request.roomLabel || "camera"} è stata approvata e applicata dall’admin.`
        : `La modifica su ${request.roomLabel || "camera"} è stata rifiutata. Motivo: ${reason || "Non specificato"}`,
      type: "room",
      targetRole: "teacher",
      targetUsername: request.teacherUsername || "",
      createdAt: new Date().toLocaleString("it-IT"),
      createdAtServer: serverTimestamp(),
    });
  };

  const approveRequest = async (request: RoomChangeRequest) => {
    if (applyingRequestId) return;
    setApplyingRequestId(request.id);

    try {
      await applyApprovedRoomChange(request);

      await updateDoc(doc(db, "roomChangeRequests", request.id), {
        status: "approved",
        reviewedBy: currentUsername || "admin",
        reviewedAt: new Date().toLocaleString("it-IT"),
        reviewedAtServer: serverTimestamp(),
        updatedAtServer: serverTimestamp(),
        appliedAtServer: serverTimestamp(),
      });

      await notifyTeacherAboutRequest(request, true);
      success("Richiesta approvata", "La modifica è stata applicata automaticamente alle camere del maestro.");
    } catch (error: any) {
      error("Errore approvazione", String(error?.message || error));
    } finally {
      setApplyingRequestId(null);
    }
  };

  const rejectRequest = async (request: RoomChangeRequest) => {
    if (!rejectionReason.trim()) {
      warning("Motivazione richiesta", "Scrivi il motivo del rifiuto.");
      return;
    }

    const reason = rejectionReason.trim();

    await updateDoc(doc(db, "roomChangeRequests", request.id), {
      status: "rejected",
      rejectionReason: reason,
      reviewedBy: currentUsername || "admin",
      reviewedAt: new Date().toLocaleString("it-IT"),
      reviewedAtServer: serverTimestamp(),
      updatedAtServer: serverTimestamp(),
    });

    await notifyTeacherAboutRequest(request, false, reason);
    setRejectingRequestId(null);
    setRejectionReason("");
    success("Richiesta rifiutata", "Il maestro è stato avvisato con la motivazione indicata.");
  };

  const getIcon = (type: AppNotification["type"]) => {
    if (type === "event") return "calendar";
    if (type === "room") return "bed";
    return "notifications";
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
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <View style={{ flex: 1, paddingRight: 12 }}>
          <Text style={styles.title}>Richieste admin</Text>
          <Text style={styles.subtitle}>
            Spostamenti ospite, svuotamenti camera, cambi Pack e giorni permanenza.
          </Text>
        </View>
        <View style={styles.badgeBox}><Text style={styles.badgeNumber}>{unreadCount}</Text></View>
      </View>

      {isRoomRequestsMode && pendingAdminRequests.length > 0 ? (
        <View style={styles.requestsSection}>
          {pendingAdminRequests.map((request) => (
            <View key={request.id} style={styles.requestCard}>
              <View style={styles.requestHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.requestType}>{requestTypeLabel(request.requestType)}</Text>
                  <Text style={styles.requestMeta}>{request.teacherFullName || request.teacherUsername} • {request.danceSchool || "Scuola non inserita"}</Text>
                  <Text style={styles.requestMeta}>{request.roomLabel || "Camera"}{request.guestPosition ? ` • Ospite ${request.guestPosition}` : ""}</Text>
                  {request.createdAt ? <Text style={styles.requestMeta}>{request.createdAt}</Text> : null}
                </View>
                <View style={styles.pendingBadge}><Text style={styles.pendingBadgeText}>In attesa</Text></View>
              </View>

              {Array.isArray(request.changedFields) && request.changedFields.length > 0 ? (
                <Text style={styles.changedFields}>Campi modificati: {request.changedFields.join(", ")}</Text>
              ) : null}

              {renderRequestData("Prima", request.oldData)}
              {renderRequestData("Dopo", request.newData)}

              {rejectingRequestId === request.id ? (
                <View style={styles.rejectBox}>
                  <TextInput
                    style={styles.rejectInput}
                    placeholder="Scrivi motivazione rifiuto"
                    placeholderTextColor={colors.placeholder}
                    value={rejectionReason}
                    onChangeText={setRejectionReason}
                    multiline
                  />
                  <View style={styles.requestActions}>
                    <TouchableOpacity style={styles.cancelRejectButton} onPress={() => { setRejectingRequestId(null); setRejectionReason(""); }}>
                      <Text style={styles.requestButtonText}>Annulla</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.rejectButton} onPress={() => rejectRequest(request)}>
                      <Text style={styles.requestButtonText}>Invia rifiuto</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <View style={styles.requestActions}>
                  <TouchableOpacity
                    style={[styles.approveButton, applyingRequestId === request.id && styles.disabledButton]}
                    disabled={applyingRequestId === request.id}
                    onPress={() => approveRequest(request)}
                  >
                    <Ionicons name="checkmark-outline" size={20} color="#FFFFFF" />
                    <Text style={styles.requestButtonText}>{applyingRequestId === request.id ? "Applico..." : "Approva"}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.rejectButton} onPress={() => setRejectingRequestId(request.id)}>
                    <Ionicons name="close-outline" size={20} color="#FFFFFF" />
                    <Text style={styles.requestButtonText}>Rifiuta</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ))}
        </View>
      ) : null}

      {!isRoomRequestsMode && visibleNotifications.length > 0 ? (
        <View style={styles.topActions}>
          <TouchableOpacity style={styles.readAllButton} onPress={markAllAsRead}>
            <Ionicons name="checkmark-done-outline" size={20} color={colors.text} />
            <Text style={styles.readAllText}>Segna tutte come lette</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.deleteAllButton} onPress={confirmDeleteAllNotifications}>
            <Ionicons name="trash-outline" size={20} color="#FFFFFF" />
            <Text style={styles.deleteAllText}>Elimina tutte</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {(isRoomRequestsMode ? pendingAdminRequests.length === 0 : visibleNotifications.length === 0) ? (
        <View style={styles.emptyBox}>
          <Ionicons name="git-pull-request-outline" size={50} color={colors.secondary} />
          <Text style={styles.emptyTitle}>Nessuna richiesta in attesa</Text>
          <Text style={styles.emptyText}>
            Quando un maestro richiederà uno spostamento, uno svuotamento camera,
            un cambio Pack o una modifica dei giorni, comparirà qui.
          </Text>
        </View>
      ) : (
        !isRoomRequestsMode && visibleNotifications.map((notification) => {
          const read = isRead(notification.id);
          return (
            <TouchableOpacity
              key={notification.id}
              style={[styles.notificationCard, !read && styles.notificationCardUnread]}
              onPress={() => {
                markAsRead(notification.id);
                if (notification.type === "event" && notification.eventId) {
                  router.push("/admin-web/events");
                }
              }}
            >
              <View style={styles.notificationIcon}>
                <Ionicons name={getIcon(notification.type)} size={24} color={colors.text} />
              </View>
              <View style={styles.notificationContent}>
                <View style={styles.notificationHeader}>
                  <Text style={styles.notificationTitle}>{notification.title}</Text>
                  <TouchableOpacity
                    style={styles.deleteNotificationButton}
                    onPress={(event) => {
                      event.stopPropagation();
                      confirmDeleteNotification(notification.id);
                    }}
                  >
                    <Ionicons name="trash-outline" size={18} color={colors.danger} />
                  </TouchableOpacity>
                </View>
                <Text style={styles.notificationMessage}>{notification.message}</Text>
                {notification.createdAt ? <Text style={styles.notificationDate}>{notification.createdAt}</Text> : null}
              </View>
            </TouchableOpacity>
          );
        })
      )}
    </ScrollView>
  );
}

const createStyles = (colors: any, isDark: boolean, isMobile: boolean) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: {
      width: "100%",
      maxWidth: 1240,
      alignSelf: "center",
      paddingTop: 28,
      paddingHorizontal: isMobile ? 14 : 28,
      paddingBottom: 120,
    },
    backButton: { flexDirection: "row", alignItems: "center", marginBottom: 24 },
    backText: { color: colors.text, fontSize: 16, fontWeight: "800", marginLeft: 6 },
    header: { flexDirection: isMobile ? "column" : "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 22 },
    title: { color: colors.text, fontSize: 34, fontWeight: "900", marginBottom: 8 },
    subtitle: { color: colors.secondary, fontSize: 16, lineHeight: 23 },
    badgeBox: { minWidth: 48, height: 48, borderRadius: 18, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", paddingHorizontal: 12 },
    badgeNumber: { color: colors.onPrimary || "#FFFFFF", fontSize: 18, fontWeight: "900" },
    requestsSection: { marginBottom: 22 },
    requestCard: {
      width: "100%",
      backgroundColor: colors.card,
      borderRadius: 22,
      padding: 18,
      marginBottom: 14,
      borderWidth: 1,
      borderColor: colors.primary,
    },
    requestHeader: { flexDirection: "row", alignItems: "flex-start", marginBottom: 12 },
    requestType: { color: colors.text, fontSize: 18, fontWeight: "900", marginBottom: 4 },
    requestMeta: { color: colors.secondary, fontSize: 13, fontWeight: "800", marginBottom: 2 },
    pendingBadge: { backgroundColor: colors.warning, borderRadius: 12, paddingVertical: 6, paddingHorizontal: 10 },
    pendingBadgeText: { color: "#FFFFFF", fontSize: 12, fontWeight: "900" },
    changedFields: { color: colors.text, fontSize: 13, fontWeight: "800", marginBottom: 10 },
    dataBox: { backgroundColor: colors.background, borderRadius: 16, padding: 12, marginTop: 10, borderWidth: 1, borderColor: colors.border },
    dataBoxTitle: { color: colors.primaryDark || colors.primary, fontSize: 14, fontWeight: "900", marginBottom: 8 },
    dataLine: { color: colors.text, fontSize: 13, fontWeight: "700", marginBottom: 4 },
    rejectBox: { marginTop: 12 },
    rejectInput: { minHeight: 84, backgroundColor: colors.background, borderRadius: 16, borderWidth: 1, borderColor: colors.border, color: colors.text, padding: 12, textAlignVertical: "top", fontWeight: "700" },
    requestActions: { flexDirection: isMobile ? "column" : "row", gap: 10, marginTop: 14 },
    approveButton: { flex: 1, minHeight: 48, borderRadius: 16, backgroundColor: colors.success, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
    rejectButton: { flex: 1, minHeight: 48, borderRadius: 16, backgroundColor: colors.danger, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
    cancelRejectButton: { flex: 1, minHeight: 48, borderRadius: 16, backgroundColor: colors.secondary, alignItems: "center", justifyContent: "center" },
    disabledButton: { opacity: 0.6 },
    requestButtonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "900" },
    topActions: { flexDirection: "row", gap: 10, marginBottom: 14, flexWrap: "wrap" },
    readAllButton: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.card, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: colors.border },
    readAllText: { color: colors.text, fontWeight: "800" },
    deleteAllButton: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.danger, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12 },
    deleteAllText: { color: "#FFFFFF", fontWeight: "900" },
    emptyBox: { alignItems: "center", padding: 28, borderRadius: 24, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
    emptyTitle: { color: colors.text, fontSize: 20, fontWeight: "900", marginTop: 12, marginBottom: 6 },
    emptyText: { color: colors.secondary, fontSize: 14, textAlign: "center", lineHeight: 21 },
    notificationCard: { flexDirection: "row", backgroundColor: colors.card, borderRadius: 22, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: colors.border },
    notificationCardUnread: { borderColor: colors.primary },
    notificationIcon: { width: 44, height: 44, borderRadius: 16, backgroundColor: colors.cardAlt || colors.background, alignItems: "center", justifyContent: "center", marginRight: 12 },
    notificationContent: { flex: 1 },
    notificationHeader: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
    notificationTitle: { flex: 1, color: colors.text, fontSize: 16, fontWeight: "900", marginBottom: 4 },
    notificationMessage: { color: colors.secondary, fontSize: 14, lineHeight: 20 },
    notificationDate: { color: colors.secondary, fontSize: 12, fontWeight: "700", marginTop: 8 },
    deleteNotificationButton: { padding: 4 },
  });
