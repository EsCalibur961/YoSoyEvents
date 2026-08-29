import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytes,
} from "firebase/storage";
import { useEffect, useMemo, useState } from "react";
import {
  Image,
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
import { db, storage } from "../../firebase";
import { sendPushNotificationsToRoleAsync } from "../../services/pushNotifications";

type ArtistItem = {
  id: string;
  name?: string;
  description?: string;
  instagram?: string;
  image?: string;
  imagePath?: string;
  isVisible?: boolean;
};

type Pack = {
  id: string;
  letter: string;
  price: string;
  description: string;
  supplementDoppia?: string;
  supplementTripla?: string;
  supplementQuadrupla?: string;
};

type EventItem = {
  id: string;
  title?: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  location?: string;
  image?: string;
  imagePath?: string;
  packs?: Pack[];
  allowStayDateSelection?: boolean;
};

export default function AdminWebEventsScreen() {
  const { colors, isDark } = useTheme();
  const { width } = useWindowDimensions();
  const { success, error, warning, info, confirm } = useFeedback();
  const styles = createStyles(colors, isDark, width < 700);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [artists, setArtists] = useState<ArtistItem[]>([]);
  const [artistSearch, setArtistSearch] = useState("");
  const [artistFilter, setArtistFilter] = useState<"all" | "visible" | "hidden">("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<"events" | "artists" | "artistEditor" | "editor">("events");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [location, setLocation] = useState("");
  const [allowStayDateSelection, setAllowStayDateSelection] = useState(false);

  const [image, setImage] = useState("");
  const [imagePath, setImagePath] = useState("");

  const [artistName, setArtistName] = useState("");
  const [artistDescription, setArtistDescription] = useState("");
  const [artistInstagram, setArtistInstagram] = useState("");
  const [artistImage, setArtistImage] = useState("");
  const [artistImagePreviewUri, setArtistImagePreviewUri] = useState("");
  const [artistImagePath, setArtistImagePath] = useState("");
  const [editingArtistId, setEditingArtistId] = useState<string | null>(null);
  const [uploadingArtistImage, setUploadingArtistImage] = useState(false);
  const [brokenArtistImages, setBrokenArtistImages] = useState<Record<string, string>>({});

  const [packs, setPacks] = useState<Pack[]>([]);
  const [packLetter, setPackLetter] = useState("");
  const [packPrice, setPackPrice] = useState("");
  const [packDescription, setPackDescription] = useState("");
  const [supplementDoppia, setSupplementDoppia] = useState("");
  const [supplementTripla, setSupplementTripla] = useState("");
  const [supplementQuadrupla, setSupplementQuadrupla] = useState("");
  const [editingPackId, setEditingPackId] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  useEffect(() => {
    const unsubscribeEvents = onSnapshot(
      collection(db, "events"),
      (snapshot) => {
        const data: EventItem[] = snapshot.docs.map((item) => ({
          id: item.id,
          ...(item.data() as Omit<EventItem, "id">),
        }));

        setEvents(data);
      },
      () => {
        setEvents([]);
      },
    );

    const unsubscribeArtists = onSnapshot(
      collection(db, "artists"),
      (snapshot) => {
        const data: ArtistItem[] = snapshot.docs.map((item) => ({
          id: item.id,
          ...(item.data() as Omit<ArtistItem, "id">),
        }));

        setArtists(data);
      },
      () => {
        setArtists([]);
      },
    );

    return () => {
      unsubscribeEvents();
      unsubscribeArtists();
    };
  }, []);

  const createNotification = async (
    notificationTitle: string,
    notificationMessage: string,
    eventId?: string,
  ) => {
    await addDoc(collection(db, "notifications"), {
      title: notificationTitle,
      message: notificationMessage,
      type: "event",
      eventId: eventId || "",
      targetRole: "all",
      createdAt: new Date().toLocaleString("it-IT"),
      createdAtServer: serverTimestamp(),
    });
  };

  const createArtistNotification = async (
    artistId: string,
    artistNameValue: string,
  ) => {
    const notificationTitle = "Nuovo artista aggiunto 🎧";
    const notificationMessage = `${artistNameValue} sarà presente all’evento. Tocca per scoprire di più.`;

    await addDoc(collection(db, "notifications"), {
      title: notificationTitle,
      message: notificationMessage,
      type: "artist",
      artistId,
      targetRole: "all",
      route: "/artists",
      createdAt: new Date().toLocaleString("it-IT"),
      createdAtServer: serverTimestamp(),
    });

    await Promise.all([
      sendPushNotificationsToRoleAsync("teacher", notificationTitle, notificationMessage, {
        type: "artist",
        artistId,
        route: "/artists",
      }),
      sendPushNotificationsToRoleAsync("admin", notificationTitle, notificationMessage, {
        type: "artist",
        artistId,
        route: "/artists",
      }),
    ]);
  };

  const uploadImageToStorage = async (uri: string) => {
    if (!uri) return null;

    if (uri.startsWith("http")) {
      return {
        url: uri,
        path: imagePath,
      };
    }

    try {
      setUploadingImage(true);

      const response = await fetch(uri);
      const blob = await response.blob();

      const filePath = `events/${Date.now()}-${Math.random()
        .toString(36)
        .substring(2)}.jpg`;

      const imageRef = ref(storage, filePath);

      await uploadBytes(imageRef, blob);

      const downloadUrl = await getDownloadURL(imageRef);

      setUploadingImage(false);

      return {
        url: downloadUrl,
        path: filePath,
      };
    } catch {
      setUploadingImage(false);

      error("Errore immagine", "Non è stato possibile caricare l’immagine su Firebase Storage.");

      return null;
    }
  };

  const deleteOldImageIfNeeded = async (oldPath?: string, newPath?: string) => {
    if (!oldPath) return;
    if (oldPath === newPath) return;

    try {
      await deleteObject(ref(storage, oldPath));
    } catch {}
  };

  const pickImage = async () => {
    const permission =
      await ImagePicker.requestMediaLibraryPermissionsAsync(false);

    if (!permission.granted) {
      warning("Permesso negato", "Devi autorizzare l’accesso alle immagini.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
      allowsEditing: true,
    });

    if (!result.canceled) {
      setImage(result.assets[0].uri);
    }
  };


  const pickArtistImage = async () => {
    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync(false);

      if (!permission.granted) {
        warning("Permesso negato", "Devi autorizzare l’accesso alle immagini.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.8,
        allowsEditing: true,
      });

      if (result.canceled || !result.assets?.[0]?.uri) {
        return;
      }

      const selectedUri = result.assets[0].uri;

      // Mostra subito l'anteprima locale. L'upload avviene solo al salvataggio.
      setArtistImage(selectedUri);
      setArtistImagePreviewUri(selectedUri);
    } catch (error: any) {
      setUploadingArtistImage(false);
      error("Errore foto", String(error?.message || "Non è stato possibile caricare la foto."));
    }
  };

  const uploadArtistImageToStorage = async (uri: string) => {
    if (!uri) return null;

    if (uri.startsWith("http")) {
      return { url: uri, path: artistImagePath };
    }

    try {
      setUploadingArtistImage(true);

      const response = await fetch(uri);
      const blob = await response.blob();

      const filePath = `artists/${Date.now()}-${Math.random()
        .toString(36)
        .substring(2)}.jpg`;

      const imageRef = ref(storage, filePath);
      await uploadBytes(imageRef, blob);

      const downloadUrl = await getDownloadURL(imageRef);
      setUploadingArtistImage(false);

      return { url: downloadUrl, path: filePath };
    } catch {
      setUploadingArtistImage(false);
      error("Errore immagine", "Non è stato possibile caricare la foto artista.");
      return null;
    }
  };

  const resetArtistForm = () => {
    setEditingArtistId(null);
    setArtistName("");
    setArtistDescription("");
    setArtistInstagram("");
    setArtistImage("");
    setArtistImagePreviewUri("");
    setArtistImagePath("");
  };

  const saveArtist = async () => {
    if (!artistName.trim()) {
      warning("Nome mancante", "Inserisci il nome dell’artista.");
      return;
    }

    if (!editingArtistId && !artistImage.trim()) {
      warning("Foto mancante", "Carica una foto dell’artista prima di pubblicarlo.");
      return;
    }

    try {
      setLoading(true);

      const oldArtist = artists.find((artist) => artist.id === editingArtistId);

      const hasNewLocalImage =
        Boolean(artistImage) && !artistImage.startsWith("http");

      const uploaded = hasNewLocalImage
        ? await uploadArtistImageToStorage(artistImage)
        : null;

      if (hasNewLocalImage && !uploaded) {
        setLoading(false);
        return;
      }

      const finalImageUrl =
        uploaded?.url ||
        (artistImage.startsWith("http") ? artistImage : "") ||
        oldArtist?.image ||
        "";

      const finalImagePath =
        uploaded?.path ||
        (artistImage.startsWith("http") ? artistImagePath : "") ||
        oldArtist?.imagePath ||
        "";

      const artistData = {
        name: artistName.trim(),
        description: artistDescription.trim(),
        instagram: artistInstagram.trim().replace("https://instagram.com/", "").replace("@", ""),
        image: finalImageUrl,
        imagePath: finalImagePath,
        isVisible: oldArtist?.isVisible ?? true,
        updatedAt: serverTimestamp(),
      };

      if (editingArtistId) {
        await updateDoc(doc(db, "artists", editingArtistId), artistData);

        if (uploaded?.path) {
          await deleteOldImageIfNeeded(
            oldArtist?.imagePath || "",
            uploaded.path,
          );
        }
      } else {
        const artistRef = await addDoc(collection(db, "artists"), {
          ...artistData,
          createdAt: serverTimestamp(),
        });

        await createArtistNotification(artistRef.id, artistName.trim());
      }

      if (editingArtistId) {
        setBrokenArtistImages((prev) => {
          const next = { ...prev };
          delete next[editingArtistId];
          return next;
        });
      }

      setLoading(false);
      resetArtistForm();
      setActiveSection("artists");
      success("Artista salvato", "L’artista è stato pubblicato live.");
    } catch (error: any) {
      setLoading(false);
      error("Salvataggio non riuscito", String(error?.message || "Non è stato possibile salvare l’artista."));
    }
  };

  const startEditArtist = (artist: ArtistItem) => {
    setActiveSection("artistEditor");
    setEditingArtistId(artist.id);
    setArtistName(artist.name || "");
    setArtistDescription(artist.description || "");
    setArtistInstagram(artist.instagram || "");
    setArtistImage(artist.image || "");
    setArtistImagePreviewUri(artist.image || "");
    setArtistImagePath(artist.imagePath || "");
  };

  const toggleArtistVisibility = async (artist: ArtistItem) => {
    try {
      await updateDoc(doc(db, "artists", artist.id), {
        isVisible: artist.isVisible === false,
        updatedAt: serverTimestamp(),
      });
    } catch {
      error("Aggiornamento non riuscito", "Non è stato possibile aggiornare la visibilità.");
    }
  };

  const deleteArtist = (artist: ArtistItem) => {
    confirm({
      title: "Eliminare questo artista?",
      message: `${artist.name || "Questo artista"} verrà rimosso definitivamente dall’evento.`,
      confirmText: "Elimina artista",
      cancelText: "Annulla",
      destructive: true,
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, "artists", artist.id));

          if (artist.imagePath) {
            try {
              await deleteObject(ref(storage, artist.imagePath));
            } catch {}
          }

          if (editingArtistId === artist.id) resetArtistForm();
          success("Artista eliminato", "L’artista è stato eliminato correttamente.");
        } catch {
          error("Eliminazione non riuscita", "Non è stato possibile eliminare l’artista.");
        }
      },
    });
  };

  const resetPackForm = () => {
    setEditingPackId(null);
    setPackLetter("");
    setPackPrice("");
    setPackDescription("");
    setSupplementDoppia("");
    setSupplementTripla("");
    setSupplementQuadrupla("");
  };

  const cleanPriceValue = (value: string) => {
    return value.replace(",", ".").replace(/[^0-9.]/g, "");
  };

  const isValidPrice = (value: string) => {
    const cleaned = cleanPriceValue(value);
    return Boolean(cleaned.trim()) && !Number.isNaN(Number(cleaned));
  };

  const startEditPack = (pack: Pack) => {
    setEditingPackId(pack.id);
    setPackLetter(pack.letter || "");
    setPackPrice(pack.price || "");
    setPackDescription(pack.description || "");
    setSupplementDoppia(pack.supplementDoppia || "0");
    setSupplementTripla(pack.supplementTripla || "0");
    setSupplementQuadrupla(pack.supplementQuadrupla || "0");
  };

  const savePackForm = () => {
    if (!packLetter.trim() || !packPrice.trim() || !packDescription.trim()) {
      warning("Pack incompleto", "Inserisci lettera, prezzo e descrizione.");
      return;
    }

    if (!isValidPrice(packPrice)) {
      warning(
        "Prezzo non valido",
        "Nel campo prezzo devi inserire solo il numero. Esempio: 179. Il testo promozionale va nella descrizione.",
      );
      return;
    }

    const cleanLetter = packLetter.trim().toUpperCase();
    const cleanPrice = cleanPriceValue(packPrice.trim());

    const alreadyExists = packs.some(
      (pack) =>
        pack.id !== editingPackId &&
        pack.letter.toUpperCase() === cleanLetter,
    );

    if (alreadyExists) {
      warning("Pack già esistente", `Il Pack ${cleanLetter} esiste già.`);
      return;
    }

    const packData: Pack = {
      id: editingPackId || Date.now().toString(),
      letter: cleanLetter,
      price: cleanPrice,
      description: packDescription.trim(),
      supplementDoppia: cleanPriceValue(supplementDoppia.trim()) || "0",
      supplementTripla: cleanPriceValue(supplementTripla.trim()) || "0",
      supplementQuadrupla: cleanPriceValue(supplementQuadrupla.trim()) || "0",
    };

    if (editingPackId) {
      setPacks((prev) =>
        prev.map((pack) => (pack.id === editingPackId ? packData : pack)),
      );
    } else {
      setPacks((prev) => [...prev, packData]);
    }

    resetPackForm();
  };

  const addPack = () => {
    savePackForm();
  };

  const removePack = (id: string) => {
    setPacks(packs.filter((pack) => pack.id !== id));
  };

  const resetForm = () => {
    setEditingId(null);
    setTitle("");
    setDescription("");
    setStartDate("");
    setEndDate("");
    setLocation("");
    setAllowStayDateSelection(false);
    setImage("");
    setImagePath("");
    setPacks([]);
    resetPackForm();
  };

  const saveEvent = async () => {
    if (
      !title.trim() ||
      !description.trim() ||
      !startDate.trim() ||
      !endDate.trim() ||
      !location.trim()
    ) {
      warning("Campi mancanti", "Compila tutti i campi obbligatori.");
      return;
    }

    if (packs.length === 0) {
      warning("Pack mancanti", "Aggiungi almeno un pack a persona.");
      return;
    }

    try {
      setLoading(true);

      const oldEvent = events.find((event) => event.id === editingId);
      const uploaded = image ? await uploadImageToStorage(image) : null;

      if (image && !uploaded) {
        setLoading(false);
        return;
      }

      const eventData = {
        title: title.trim(),
        description: description.trim(),
        startDate: startDate.trim(),
        endDate: endDate.trim(),
        location: location.trim(),
        allowStayDateSelection,
        image: uploaded?.url || "",
        imagePath: uploaded?.path || "",
        packs,
        updatedAt: serverTimestamp(),
      };

      if (editingId) {
        await updateDoc(doc(db, "events", editingId), eventData);

        await deleteOldImageIfNeeded(
          oldEvent?.imagePath || "",
          uploaded?.path || "",
        );

        await createNotification(
          "Evento aggiornato",
          `L’evento "${title.trim()}" è stato aggiornato dall’admin.`,
          editingId || oldEvent?.id || "",
        );
      } else {
        const eventRef = await addDoc(collection(db, "events"), {
          ...eventData,
          createdAt: serverTimestamp(),
        });

        await createNotification(
          "Nuovo evento pubblicato",
          `È stato pubblicato un nuovo evento: "${title.trim()}".`,
          eventRef.id,
        );
      }

      setLoading(false);
      resetForm();
      setActiveSection("events");

      success("Evento salvato", "Evento, immagine, pack, supplementi e impostazioni sono sincronizzati live.");
    } catch {
      setLoading(false);
      error("Salvataggio non riuscito", "Non è stato possibile salvare l’evento.");
    }
  };

  const startEdit = (event: EventItem) => {
    setActiveSection("editor");
    setEditingId(event.id);
    setTitle(event.title || "");
    setDescription(event.description || "");
    setStartDate(event.startDate || "");
    setEndDate(event.endDate || "");
    setLocation(event.location || "");
    setAllowStayDateSelection(Boolean(event.allowStayDateSelection));
    setImage(event.image || "");
    setImagePath(event.imagePath || "");
    setPacks(
      Array.isArray(event.packs)
        ? event.packs.map((pack) => ({
            ...pack,
            supplementDoppia: pack.supplementDoppia || "0",
            supplementTripla: pack.supplementTripla || "0",
            supplementQuadrupla: pack.supplementQuadrupla || "0",
          }))
        : [],
    );
  };

  const deleteEvent = (event: EventItem) => {
    confirm({
      title: "Eliminare questo evento?",
      message: `${event.title || "Questo evento"} verrà eliminato definitivamente.`,
      confirmText: "Elimina evento",
      cancelText: "Annulla",
      destructive: true,
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, "events", event.id));

          if (event.imagePath) {
            try {
              await deleteObject(ref(storage, event.imagePath));
            } catch {}
          }

          await createNotification(
            "Evento eliminato",
            `L’evento "${event.title || "senza titolo"}" è stato eliminato.`,
          );

          if (editingId === event.id) {
            resetForm();
            setActiveSection("events");
          }

          success("Evento eliminato", "L’evento è stato eliminato correttamente.");
        } catch {
          error("Eliminazione non riuscita", "Non è stato possibile eliminare l’evento.");
        }
      },
    });
  };

  const openCreateEvent = () => {
    resetForm();
    setActiveSection("editor");
  };

  const cancelEventEditing = () => {
    resetForm();
    setActiveSection("events");
  };

  const openArtists = () => {
    resetArtistForm();
    setActiveSection("artists");
  };

  const openCreateArtist = () => {
    resetArtistForm();
    setActiveSection("artistEditor");
  };

  const closeArtistEditor = () => {
    resetArtistForm();
    setActiveSection("artists");
  };

  const filteredArtists = useMemo(() => {
    const q = artistSearch.trim().toLowerCase();

    return artists
      .filter((artist) => {
        if (artistFilter === "visible" && artist.isVisible === false) return false;
        if (artistFilter === "hidden" && artist.isVisible !== false) return false;

        if (!q) return true;

        return [artist.name, artist.instagram, artist.description]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(q);
      })
      .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  }, [artists, artistSearch, artistFilter]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <TouchableOpacity style={styles.backButton} onPress={() => router.replace("/admin-web")}>
        <Ionicons name="chevron-back-outline" size={24} color={colors.text} />
        <Text style={styles.backText}>Dashboard Web</Text>
      </TouchableOpacity>

      <View style={styles.webHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.webEyebrow}>YO SOY EVENTS / ADMIN WEB</Text>
          <Text style={styles.title}>Eventi e artisti</Text>
          <Text style={styles.subtitle}>
            Pubblicazione eventi, Pack, supplementi, permanenza e artisti dallo stesso pannello desktop.
          </Text>
        </View>

      </View>

      <View style={styles.adminTabs}>
        <TouchableOpacity
          style={[styles.adminTab, activeSection === "events" && styles.adminTabActive]}
          onPress={() => setActiveSection("events")}
        >
          <Ionicons
            name="calendar-outline"
            size={19}
            color={activeSection === "events" ? colors.onPrimary : colors.secondary}
          />
          <Text
            style={[
              styles.adminTabText,
              activeSection === "events" && styles.adminTabTextActive,
            ]}
          >
            Eventi
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.adminTab, (activeSection === "artists" || activeSection === "artistEditor") && styles.adminTabActive]}
          onPress={openArtists}
        >
          <Ionicons
            name="people-outline"
            size={19}
            color={(activeSection === "artists" || activeSection === "artistEditor") ? colors.onPrimary : colors.secondary}
          />
          <Text
            style={[
              styles.adminTabText,
              (activeSection === "artists" || activeSection === "artistEditor") && styles.adminTabTextActive,
            ]}
          >
            Artisti
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.adminTab, activeSection === "editor" && styles.adminTabActive]}
          onPress={openCreateEvent}
        >
          <Ionicons
            name={editingId ? "create-outline" : "add-circle-outline"}
            size={19}
            color={activeSection === "editor" ? colors.onPrimary : colors.secondary}
          />
          <Text
            style={[
              styles.adminTabText,
              activeSection === "editor" && styles.adminTabTextActive,
            ]}
          >
            {editingId ? "Modifica" : "Crea"}
          </Text>
        </TouchableOpacity>
      </View>

      {activeSection === "events" ? (
        <>
      <View style={styles.sectionHeaderRow}>
        <View>
          <Text style={styles.sectionTitle}>Eventi pubblicati</Text>
          <Text style={styles.sectionCaption}>
            Tocca modifica per aprire direttamente l’editor.
          </Text>
        </View>

        <TouchableOpacity style={styles.headerCreateButton} onPress={openCreateEvent}>
          <Ionicons name="add-outline" size={20} color={colors.onPrimary} />
          <Text style={styles.headerCreateButtonText}>Nuovo</Text>
        </TouchableOpacity>
      </View>

      {events.length === 0 ? (
        <View style={styles.emptyBox}>
          <Ionicons name="calendar-outline" size={50} color={colors.secondary} />
          <Text style={styles.emptyTitle}>Nessun evento</Text>
          <Text style={styles.emptyText}>Gli eventi pubblicati compariranno qui.</Text>

          <TouchableOpacity style={styles.emptyPrimaryButton} onPress={openCreateEvent}>
            <Ionicons name="add-circle-outline" size={20} color={colors.onPrimary} />
            <Text style={styles.emptyPrimaryButtonText}>Crea il primo evento</Text>
          </TouchableOpacity>
        </View>
      ) : (
        events.map((event) => (
          <View key={event.id} style={styles.compactEventCard}>
            {event.image ? (
              <Image source={{ uri: event.image }} style={styles.compactEventImage} />
            ) : (
              <View style={styles.compactEventImagePlaceholder}>
                <Ionicons name="calendar-outline" size={28} color={colors.secondary} />
              </View>
            )}

            <View style={styles.compactEventInfo}>
              <Text style={styles.compactEventTitle} numberOfLines={2}>
                {event.title || "Evento senza titolo"}
              </Text>

              <View style={styles.compactMetaRow}>
                <Ionicons name="calendar-outline" size={14} color={colors.primary} />
                <Text style={styles.compactMetaText}>
                  {event.startDate || "-"} → {event.endDate || "-"}
                </Text>
              </View>

              <View style={styles.compactMetaRow}>
                <Ionicons name="location-outline" size={14} color={colors.secondary} />
                <Text style={styles.compactMetaText} numberOfLines={1}>
                  {event.location || "Location non inserita"}
                </Text>
              </View>

              <View style={styles.compactPacksRow}>
                <Ionicons name="ticket-outline" size={14} color={colors.warning} />
                <Text style={styles.compactPacksText}>
                  {Array.isArray(event.packs) ? event.packs.length : 0} pack
                </Text>
              </View>
            </View>

            <View style={styles.compactActions}>
              <TouchableOpacity
                style={styles.compactEditButton}
                onPress={() => startEdit(event)}
              >
                <Ionicons name="create-outline" size={20} color={colors.onPrimary} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.compactDeleteButton}
                onPress={() => deleteEvent(event)}
              >
                <Ionicons name="trash-outline" size={20} color={colors.onPrimary} />
              </TouchableOpacity>
            </View>
          </View>
        ))
      )}

        </>
      ) : null}

      {activeSection === "artists" ? (
        <>
          <View style={styles.artistHeaderRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionTitle}>Artisti</Text>
              <Text style={styles.sectionCaption}>
                Cerca, filtra e modifica senza scorrere una lista infinita.
              </Text>
            </View>

            <TouchableOpacity
              style={styles.headerCreateButton}
              onPress={openCreateArtist}
            >
              <Ionicons name="add-outline" size={20} color={colors.onPrimary} />
              <Text style={styles.headerCreateButtonText}>Nuovo</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.artistSearchBox}>
            <Ionicons name="search-outline" size={19} color={colors.secondary} />

            <TextInput
              style={styles.artistSearchInput}
              value={artistSearch}
              onChangeText={setArtistSearch}
              placeholder="Cerca artista o Instagram"
              placeholderTextColor={colors.placeholder}
              autoCapitalize="none"
            />

            {artistSearch ? (
              <TouchableOpacity onPress={() => setArtistSearch("")}>
                <Ionicons
                  name="close-circle"
                  size={19}
                  color={colors.secondary}
                />
              </TouchableOpacity>
            ) : null}
          </View>

          <View style={styles.artistFilters}>
            {([
              ["all", "Tutti"],
              ["visible", "Visibili"],
              ["hidden", "Nascosti"],
            ] as const).map(([value, label]) => {
              const active = artistFilter === value;

              return (
                <TouchableOpacity
                  key={value}
                  style={[
                    styles.artistFilterButton,
                    active && styles.artistFilterButtonActive,
                  ]}
                  onPress={() => setArtistFilter(value)}
                >
                  <Text
                    style={[
                      styles.artistFilterText,
                      active && styles.artistFilterTextActive,
                    ]}
                  >
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.artistCountText}>
            {filteredArtists.length} di {artists.length} artisti
          </Text>

          {filteredArtists.length === 0 ? (
            <View style={styles.emptyBox}>
              <Ionicons
                name="musical-notes-outline"
                size={44}
                color={colors.secondary}
              />
              <Text style={styles.emptyTitle}>Nessun artista</Text>
              <Text style={styles.emptyText}>
                Nessun risultato con questi filtri.
              </Text>
            </View>
          ) : (
            filteredArtists.map((artist) => (
              <View key={artist.id} style={styles.artistCompactCard}>
                {artist.image &&
                brokenArtistImages[artist.id] !== artist.image ? (
                  <Image
                    key={`${artist.id}-${artist.image}`}
                    source={{ uri: artist.image }}
                    style={styles.artistCompactImage}
                    resizeMode="cover"
                    onLoad={() =>
                      setBrokenArtistImages((prev) => {
                        if (!prev[artist.id]) return prev;

                        const next = { ...prev };
                        delete next[artist.id];
                        return next;
                      })
                    }
                    onError={() =>
                      setBrokenArtistImages((prev) => ({
                        ...prev,
                        [artist.id]: artist.image || "",
                      }))
                    }
                  />
                ) : (
                  <View style={styles.artistCompactPlaceholder}>
                    <Ionicons
                      name="image-outline"
                      size={22}
                      color={colors.secondary}
                    />
                  </View>
                )}

                <TouchableOpacity
                  style={styles.artistCompactInfo}
                  activeOpacity={0.8}
                  onPress={() => startEditArtist(artist)}
                >
                  <Text
                    style={styles.artistCompactName}
                    numberOfLines={1}
                  >
                    {artist.name || "Artista senza nome"}
                  </Text>

                  <Text
                    style={styles.artistCompactInstagram}
                    numberOfLines={1}
                  >
                    {artist.instagram
                      ? `@${artist.instagram}`
                      : "Instagram non inserito"}
                  </Text>

                  <View style={styles.artistCompactStatusRow}>
                    <View
                      style={[
                        styles.artistCompactStatusDot,
                        {
                          backgroundColor:
                            artist.isVisible === false
                              ? colors.warning
                              : colors.success,
                        },
                      ]}
                    />
                    <Text
                      style={[
                        styles.artistCompactStatusText,
                        {
                          color:
                            artist.isVisible === false
                              ? colors.warning
                              : colors.success,
                        },
                      ]}
                    >
                      {artist.isVisible === false ? "Nascosto" : "Visibile"}
                    </Text>
                  </View>
                </TouchableOpacity>

                <View style={styles.artistCompactActions}>
                  <TouchableOpacity
                    style={styles.artistCompactEdit}
                    onPress={() => startEditArtist(artist)}
                  >
                    <Ionicons
                      name="create-outline"
                      size={18}
                      color={colors.onPrimary}
                    />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.artistCompactAction,
                      {
                        backgroundColor:
                          artist.isVisible === false
                            ? colors.warning
                            : colors.success,
                      },
                    ]}
                    onPress={() => toggleArtistVisibility(artist)}
                  >
                    <Ionicons
                      name={
                        artist.isVisible === false
                          ? "eye-off-outline"
                          : "eye-outline"
                      }
                      size={18}
                      color={colors.onPrimary}
                    />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.artistCompactAction,
                      { backgroundColor: colors.danger },
                    ]}
                    onPress={() => deleteArtist(artist)}
                  >
                    <Ionicons
                      name="trash-outline"
                      size={18}
                      color={colors.onPrimary}
                    />
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </>
      ) : null}

      {activeSection === "artistEditor" ? (
        <View style={styles.card}>
          <View style={styles.editorTopBar}>
            <TouchableOpacity
              style={styles.inlineBackButton}
              onPress={closeArtistEditor}
            >
              <Ionicons
                name="chevron-back-outline"
                size={18}
                color={colors.primary}
              />
              <Text style={styles.inlineBackText}>Torna agli artisti</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.cardTitle}>
            {editingArtistId ? "Modifica artista" : "Nuovo artista"}
          </Text>

          <Text style={styles.artistHelpText}>
            {editingArtistId
              ? "Modifica i dati dell’artista selezionato."
              : "Inserisci un nuovo artista, DJ o ospite."}
          </Text>

          <TextInput
            style={styles.input}
            placeholder="Nome artista"
            placeholderTextColor={colors.placeholder}
            value={artistName}
            onChangeText={setArtistName}
          />

          <TextInput
            style={styles.input}
            placeholder="Instagram es. djdamasco"
            placeholderTextColor={colors.placeholder}
            value={artistInstagram}
            onChangeText={setArtistInstagram}
            autoCapitalize="none"
          />

          <TextInput
            style={[styles.input, styles.textAreaSmall]}
            placeholder="Descrizione artista"
            placeholderTextColor={colors.placeholder}
            value={artistDescription}
            onChangeText={setArtistDescription}
            multiline
          />

          <TouchableOpacity
            style={styles.imageButton}
            onPress={pickArtistImage}
            disabled={uploadingArtistImage || loading}
          >
            <Ionicons name="image-outline" size={22} color={colors.text} />

            <Text style={styles.imageButtonText}>
              {uploadingArtistImage
                ? "Caricamento foto..."
                : artistImage
                  ? "Cambia foto artista"
                  : "Carica foto artista"}
            </Text>
          </TouchableOpacity>

          {artistImagePreviewUri || artistImage ? (
            <View style={styles.artistPreviewWrap}>
              <Image
                key={artistImagePreviewUri || artistImage}
                source={{ uri: artistImagePreviewUri || artistImage }}
                style={styles.artistPreview}
                resizeMode="cover"
              />
              <View style={styles.artistPreviewBadge}>
                <Ionicons name="checkmark-circle" size={15} color={colors.success} />
                <Text style={styles.artistPreviewBadgeText}>Anteprima foto</Text>
              </View>
            </View>
          ) : null}

          <TouchableOpacity
            style={[styles.saveButton, loading && styles.saveButtonDisabled]}
            onPress={saveArtist}
            disabled={loading || uploadingArtistImage}
          >
            <Ionicons
              name={editingArtistId ? "save-outline" : "add-outline"}
              size={22}
              color={colors.onPrimary}
            />

            <Text style={styles.saveButtonText}>
              {editingArtistId ? "Salva artista" : "Pubblica artista"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.cancelButton}
            onPress={closeArtistEditor}
          >
            <Text style={styles.cancelButtonText}>
              {editingArtistId ? "Annulla modifica" : "Annulla"}
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {activeSection === "editor" ? (
        <>
      <View style={styles.card}>
        <View style={styles.editorTopBar}>
          <TouchableOpacity style={styles.inlineBackButton} onPress={cancelEventEditing}>
            <Ionicons name="chevron-back-outline" size={18} color={colors.primary} />
            <Text style={styles.inlineBackText}>Torna agli eventi</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.cardTitle}>
          {editingId ? "Modifica evento" : "Nuovo evento"}
        </Text>

        <TextInput
          style={styles.input}
          placeholder="Titolo evento"
          placeholderTextColor={colors.placeholder}
          value={title}
          onChangeText={setTitle}
        />

        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Descrizione evento"
          placeholderTextColor={colors.placeholder}
          value={description}
          onChangeText={setDescription}
          multiline
        />

        <View style={styles.desktopFieldRow}>
          <TextInput
            style={[styles.input, styles.desktopField]}
            placeholder="Dal es. 12/08/2026"
            placeholderTextColor={colors.placeholder}
            value={startDate}
            onChangeText={setStartDate}
          />

          <TextInput
            style={[styles.input, styles.desktopField]}
            placeholder="Al es. 15/08/2026"
            placeholderTextColor={colors.placeholder}
            value={endDate}
            onChangeText={setEndDate}
          />

          <TextInput
            style={[styles.input, styles.desktopFieldWide]}
            placeholder="Location evento"
            placeholderTextColor={colors.placeholder}
            value={location}
            onChangeText={setLocation}
          />
        </View>

        <TouchableOpacity
          style={[
            styles.stayDateToggle,
            allowStayDateSelection && styles.stayDateToggleActive,
          ]}
          onPress={() => setAllowStayDateSelection((prev) => !prev)}
          activeOpacity={0.85}
        >
          <View
            style={[
              styles.stayDateToggleIcon,
              allowStayDateSelection && styles.stayDateToggleIconActive,
            ]}
          >
            <Ionicons
              name={allowStayDateSelection ? "calendar" : "calendar-outline"}
              size={20}
              color={allowStayDateSelection ? colors.onPrimary : colors.primary}
            />
          </View>

          <View style={styles.stayDateToggleInfo}>
            <Text style={styles.stayDateToggleTitle}>
              Selezione giorni permanenza
            </Text>
            <Text style={styles.stayDateToggleText}>
              {allowStayDateSelection
                ? "Attiva: i maestri potranno scegliere i giorni per ogni ospite."
                : "Disattiva: il soggiorno segue l’intera durata dell’evento."}
            </Text>
          </View>

          <View
            style={[
              styles.toggleSwitch,
              allowStayDateSelection && styles.toggleSwitchActive,
            ]}
          >
            <View
              style={[
                styles.toggleKnob,
                allowStayDateSelection && styles.toggleKnobActive,
              ]}
            />
          </View>
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>Pack a persona</Text>

        <View style={styles.packForm}>
          <View style={styles.packTopRow}>
            <TextInput
              style={[styles.input, styles.packLetterField]}
              placeholder="Pack es. A"
              placeholderTextColor={colors.placeholder}
              value={packLetter}
              onChangeText={setPackLetter}
              editable={!editingPackId}
              autoCapitalize="characters"
              maxLength={1}
            />

            <TextInput
              style={[styles.input, styles.packPriceField]}
              placeholder="Prezzo base es. 250"
              placeholderTextColor={colors.placeholder}
              value={packPrice}
              onChangeText={(value) => setPackPrice(cleanPriceValue(value))}
              keyboardType="numeric"
            />

            <TextInput
              style={[styles.input, styles.packDescriptionField]}
              placeholder="Descrizione es. Full pass"
              placeholderTextColor={colors.placeholder}
              value={packDescription}
              onChangeText={setPackDescription}
            />
          </View>

          <Text style={styles.supplementTitle}>Supplementi camera</Text>

          <View style={styles.supplementRow}>
            <TextInput
              style={[styles.input, styles.supplementField]}
              placeholder="Doppia es. 30"
              placeholderTextColor={colors.placeholder}
              value={supplementDoppia}
              onChangeText={(value) => setSupplementDoppia(cleanPriceValue(value))}
              keyboardType="numeric"
            />

            <TextInput
              style={[styles.input, styles.supplementField]}
              placeholder="Tripla es. 0"
              placeholderTextColor={colors.placeholder}
              value={supplementTripla}
              onChangeText={(value) => setSupplementTripla(cleanPriceValue(value))}
              keyboardType="numeric"
            />

            <TextInput
              style={[styles.input, styles.supplementField]}
              placeholder="Quadrupla es. 0"
              placeholderTextColor={colors.placeholder}
              value={supplementQuadrupla}
              onChangeText={(value) => setSupplementQuadrupla(cleanPriceValue(value))}
              keyboardType="numeric"
            />
          </View>

          <TouchableOpacity style={styles.addPackButton} onPress={savePackForm}>
            <Ionicons
              name={editingPackId ? "save-outline" : "add-outline"}
              size={22}
              color={colors.text}
            />
            <Text style={styles.addPackButtonText}>
              {editingPackId ? "Salva modifica pack" : "Aggiungi pack"}
            </Text>
          </TouchableOpacity>

          {editingPackId ? (
            <TouchableOpacity style={styles.cancelPackButton} onPress={resetPackForm}>
              <Text style={styles.cancelPackButtonText}>Annulla modifica pack</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {packs.map((pack) => (
          <View key={pack.id} style={styles.packCard}>
            <View style={styles.packInfo}>
              <Text style={styles.packTitle}>
                Pack {pack.letter}: €{pack.price}
              </Text>

              <Text style={styles.packDescription}>{pack.description}</Text>

              <Text style={styles.packSupplements}>
                Supplementi: Doppia €{pack.supplementDoppia || "0"} • Tripla €
                {pack.supplementTripla || "0"} • Quadrupla €
                {pack.supplementQuadrupla || "0"}
              </Text>
            </View>

            <View style={styles.packActions}>
              <TouchableOpacity
                style={styles.editPackButton}
                onPress={() => startEditPack(pack)}
              >
                <Ionicons name="create-outline" size={20} color={colors.text} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.removePackButton}
                onPress={() => removePack(pack.id)}
              >
                <Ionicons name="trash-outline" size={20} color={colors.text} />
              </TouchableOpacity>
            </View>
          </View>
        ))}

        <TouchableOpacity
          style={styles.imageButton}
          onPress={pickImage}
          disabled={uploadingImage || loading}
        >
          <Ionicons name="image-outline" size={22} color={colors.text} />

          <Text style={styles.imageButtonText}>
            {uploadingImage
              ? "Caricamento..."
              : image
                ? "Cambia immagine"
                : "Carica immagine"}
          </Text>
        </TouchableOpacity>

        {image ? (
          <Image source={{ uri: image }} style={styles.preview} />
        ) : null}

        <TouchableOpacity
          style={[styles.saveButton, loading && styles.saveButtonDisabled]}
          onPress={saveEvent}
          disabled={loading || uploadingImage}
        >
          <Ionicons
            name={
              loading
                ? "hourglass-outline"
                : editingId
                  ? "save-outline"
                  : "add-outline"
            }
            size={22}
            color={colors.text}
          />

          <Text style={styles.saveButtonText}>
            {loading
              ? "Salvataggio..."
              : editingId
                ? "Salva modifiche"
                : "Pubblica evento"}
          </Text>
        </TouchableOpacity>

        {editingId ? (
          <TouchableOpacity style={styles.cancelButton} onPress={cancelEventEditing}>
            <Text style={styles.cancelButtonText}>Annulla modifica</Text>
          </TouchableOpacity>
        ) : null}
      </View>



        </>
      ) : null}
    </ScrollView>
  );
}

const createStyles = (colors: any, isDark: boolean, isMobile: boolean) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },

    content: {
      width: "100%",
      maxWidth: 1320,
      alignSelf: "center",
      paddingTop: 30,
      paddingHorizontal: isMobile ? 14 : 32,
      paddingBottom: 120,
    },

    webHeader: {
      flexDirection: isMobile ? "column" : "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: 20,
      marginBottom: 6,
    },

    webEyebrow: {
      color: colors.primary,
      fontSize: 10,
      fontWeight: "900",
      letterSpacing: 1.1,
      marginBottom: 7,
    },

    mobileViewButton: {
      minHeight: 42,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      paddingHorizontal: 13,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
    },

    mobileViewText: {
      color: colors.primary,
      fontSize: 10,
      fontWeight: "900",
      marginLeft: 6,
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
      fontSize: 31,
      fontWeight: "900",
      marginBottom: 10,
    },

    subtitle: {
      color: colors.secondary,
      fontSize: 14,
      marginBottom: 20,
      lineHeight: 23,
    },

    adminTabs: {
      flexDirection: "row",
      flexWrap: "wrap",
      backgroundColor: colors.card,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 5,
      marginBottom: 22,
      gap: 5,
    },

    adminTab: {
      flex: 1,
      minHeight: 50,
      borderRadius: 15,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      gap: 6,
    },

    adminTabActive: {
      backgroundColor: colors.primary,
    },

    adminTabText: {
      color: colors.secondary,
      fontSize: 13,
      fontWeight: "900",
    },

    adminTabTextActive: {
      color: colors.onPrimary,
    },

    sectionHeaderRow: {
      flexDirection: isMobile ? "column" : "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 14,
      gap: 12,
    },

    sectionCaption: {
      color: colors.secondary,
      fontSize: 12,
      lineHeight: 17,
      fontWeight: "700",
      marginTop: -8,
      maxWidth: 245,
    },

    headerCreateButton: {
      minHeight: 42,
      borderRadius: 14,
      backgroundColor: colors.primary,
      paddingHorizontal: 13,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 5,
    },

    headerCreateButtonText: {
      color: colors.onPrimary,
      fontSize: 12,
      fontWeight: "900",
    },

    compactEventCard: {
      width: "100%",
      maxWidth: 1120,
      alignSelf: "center",
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 22,
      padding: 12,
      marginBottom: 12,
      flexDirection: isMobile ? "column" : "row",
      alignItems: "center",
      shadowColor: "#000",
      shadowOpacity: isDark ? 0.13 : 0.04,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 5 },
      elevation: 2,
    },

    compactEventImage: {
      width: isMobile ? "100%" : 108,
      height: isMobile ? 190 : 86,
      borderRadius: 17,
      backgroundColor: colors.background,
      marginRight: isMobile ? 0 : 12,
      marginBottom: isMobile ? 12 : 0,
    },

    compactEventImagePlaceholder: {
      width: isMobile ? "100%" : 108,
      height: isMobile ? 190 : 86,
      borderRadius: 17,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
      marginRight: isMobile ? 0 : 12,
      marginBottom: isMobile ? 12 : 0,
    },

    compactEventInfo: {
      flex: 1,
      minWidth: 0,
    },

    compactEventTitle: {
      color: colors.text,
      fontSize: 16,
      lineHeight: 20,
      fontWeight: "900",
      marginBottom: 6,
    },

    compactMetaRow: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 3,
      paddingRight: 4,
    },

    compactMetaText: {
      flex: 1,
      color: colors.secondary,
      fontSize: 10,
      lineHeight: 14,
      fontWeight: "700",
      marginLeft: 5,
    },

    compactPacksRow: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 5,
    },

    compactPacksText: {
      color: colors.warning,
      fontSize: 10,
      fontWeight: "900",
      marginLeft: 5,
    },

    compactActions: {
      marginLeft: 8,
      gap: 8,
    },

    compactEditButton: {
      width: 40,
      height: 40,
      borderRadius: 13,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },

    compactDeleteButton: {
      width: 40,
      height: 40,
      borderRadius: 13,
      backgroundColor: colors.danger,
      alignItems: "center",
      justifyContent: "center",
    },

    editorTopBar: {
      marginBottom: 12,
    },

    inlineBackButton: {
      alignSelf: "flex-start",
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: `${colors.primary}12`,
      paddingHorizontal: 11,
      paddingVertical: 8,
      borderRadius: 12,
    },

    inlineBackText: {
      color: colors.primary,
      fontSize: 12,
      fontWeight: "900",
      marginLeft: 4,
    },

    emptyPrimaryButton: {
      marginTop: 18,
      minHeight: 46,
      borderRadius: 15,
      backgroundColor: colors.primary,
      paddingHorizontal: 16,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 7,
    },

    emptyPrimaryButtonText: {
      color: colors.onPrimary,
      fontSize: 13,
      fontWeight: "900",
    },

    card: {
      width: "100%",
      maxWidth: 1050,
      alignSelf: "center",
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
      marginBottom: 24,
    },

    cardTitle: {
      color: colors.text,
      fontSize: 24,
      fontWeight: "900",
      marginBottom: 18,
    },

    artistHelpText: {
      color: colors.secondary,
      fontSize: 15,
      lineHeight: 22,
      marginBottom: 16,
      fontWeight: "700",
    },

    sectionTitle: {
      color: colors.text,
      fontSize: 24,
      fontWeight: "900",
      marginBottom: 16,
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

    desktopFieldRow: {
      flexDirection: isMobile ? "column" : "row",
      gap: 10,
    },

    desktopField: {
      ...(isMobile
        ? { flexGrow: 0, flexShrink: 0, flexBasis: "auto" as const, width: "100%" as const, minWidth: 0 }
        : { flex: 1 }),
    },

    desktopFieldWide: {
      ...(isMobile
        ? { flexGrow: 0, flexShrink: 0, flexBasis: "auto" as const, width: "100%" as const, minWidth: 0 }
        : { flex: 1.5 }),
    },

    packTopRow: {
      flexDirection: isMobile ? "column" : "row",
      gap: 10,
    },

    packLetterField: {
      ...(isMobile
        ? { flexGrow: 0, flexShrink: 0, flexBasis: "auto" as const, width: "100%" as const, minWidth: 0 }
        : { flex: 0.55 }),
    },

    packPriceField: {
      ...(isMobile
        ? { flexGrow: 0, flexShrink: 0, flexBasis: "auto" as const, width: "100%" as const, minWidth: 0 }
        : { flex: 1 }),
    },

    packDescriptionField: {
      ...(isMobile
        ? { flexGrow: 0, flexShrink: 0, flexBasis: "auto" as const, width: "100%" as const, minWidth: 0 }
        : { flex: 2 }),
    },

    supplementRow: {
      flexDirection: isMobile ? "column" : "row",
      gap: 10,
    },

    supplementField: {
      ...(isMobile
        ? { flexGrow: 0, flexShrink: 0, flexBasis: "auto" as const, width: "100%" as const, minWidth: 0 }
        : { flex: 1 }),
    },

    textArea: {
      minHeight: 110,
      textAlignVertical: "top",
    },

    textAreaSmall: {
      minHeight: 80,
      textAlignVertical: "top",
    },

    stayDateToggle: {
      backgroundColor: colors.background,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 13,
      marginBottom: 18,
      flexDirection: "row",
      alignItems: "center",
    },

    stayDateToggleActive: {
      borderColor: colors.primary,
      backgroundColor: `${colors.primary}0D`,
    },

    stayDateToggleIcon: {
      width: 42,
      height: 42,
      borderRadius: 13,
      backgroundColor: `${colors.primary}12`,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 10,
    },

    stayDateToggleIconActive: {
      backgroundColor: colors.primary,
    },

    stayDateToggleInfo: {
      flex: 1,
      paddingRight: 9,
    },

    stayDateToggleTitle: {
      color: colors.text,
      fontSize: 14,
      fontWeight: "900",
    },

    stayDateToggleText: {
      color: colors.secondary,
      fontSize: 10,
      lineHeight: 15,
      fontWeight: "700",
      marginTop: 3,
    },

    toggleSwitch: {
      width: 42,
      height: 24,
      borderRadius: 12,
      backgroundColor: colors.border,
      padding: 3,
      justifyContent: "center",
    },

    toggleSwitchActive: {
      backgroundColor: colors.primary,
    },

    toggleKnob: {
      width: 18,
      height: 18,
      borderRadius: 9,
      backgroundColor: colors.card,
      alignSelf: "flex-start",
    },

    toggleKnobActive: {
      alignSelf: "flex-end",
      backgroundColor: colors.onPrimary,
    },

    packForm: {
      backgroundColor: colors.background,
      borderRadius: 22,
      padding: 16,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },

    supplementTitle: {
      color: colors.text,
      fontSize: 17,
      fontWeight: "900",
      marginBottom: 12,
      marginTop: 6,
    },

    addPackButton: {
      backgroundColor: colors.primary,
      borderRadius: 18,
      paddingVertical: 15,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
    },

    addPackButtonText: {
      color: colors.onPrimary,
      fontSize: 15,
      fontWeight: "900",
      marginLeft: 8,
    },

    packCard: {
      backgroundColor: colors.background,
      borderRadius: 18,
      padding: 14,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.border,
      flexDirection: isMobile ? "column" : "row",
      alignItems: "center",
    },

    packInfo: {
      flex: 1,
      paddingRight: 12,
    },

    packTitle: {
      color: colors.text,
      fontSize: 17,
      fontWeight: "900",
    },

    packDescription: {
      color: colors.secondary,
      fontSize: 14,
      marginTop: 4,
    },

    packSupplements: {
      color: colors.warning,
      fontSize: 13,
      fontWeight: "800",
      marginTop: 6,
      lineHeight: 19,
    },

    packActions: {
      flexDirection: "row",
      gap: 8,
    },

    editPackButton: {
      width: 42,
      height: 42,
      borderRadius: 15,
      backgroundColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
    },

    removePackButton: {
      width: 42,
      height: 42,
      borderRadius: 15,
      backgroundColor: colors.danger,
      alignItems: "center",
      justifyContent: "center",
    },

    cancelPackButton: {
      marginTop: 10,
      backgroundColor: colors.border,
      borderRadius: 16,
      paddingVertical: 13,
      alignItems: "center",
      justifyContent: "center",
    },

    cancelPackButtonText: {
      color: colors.secondary,
      fontSize: 14,
      fontWeight: "900",
    },

    imageButton: {
      backgroundColor: colors.border,
      borderRadius: 18,
      paddingVertical: 15,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      marginBottom: 16,
    },

    imageButtonText: {
      color: colors.text,
      fontSize: 15,
      fontWeight: "900",
      marginLeft: 8,
    },

    preview: {
      width: "100%",
      height: 220,
      borderRadius: 18,
      marginBottom: 18,
      backgroundColor: colors.background,
    },

    artistPreviewWrap: {
      width: "100%",
      marginBottom: 18,
    },

    artistPreview: {
      width: "100%",
      height: 220,
      borderRadius: 18,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
    },

    artistPreviewBadge: {
      alignSelf: "flex-start",
      flexDirection: "row",
      alignItems: "center",
      marginTop: 8,
      backgroundColor: `${colors.success}14`,
      borderRadius: 10,
      paddingHorizontal: 9,
      paddingVertical: 6,
    },

    artistPreviewBadgeText: {
      color: colors.success,
      fontSize: 10,
      fontWeight: "900",
      marginLeft: 5,
    },

    saveButton: {
      backgroundColor: colors.primary,
      borderRadius: 18,
      paddingVertical: 18,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
    },

    saveButtonDisabled: {
      opacity: 0.6,
    },

    saveButtonText: {
      color: colors.onPrimary,
      fontSize: 16,
      fontWeight: "900",
      marginLeft: 8,
    },

    cancelButton: {
      marginTop: 12,
      backgroundColor: colors.border,
      borderRadius: 18,
      paddingVertical: 15,
      alignItems: "center",
    },

    cancelButtonText: {
      color: colors.secondary,
      fontSize: 15,
      fontWeight: "800",
    },

    artistHeaderRow: {
      flexDirection: isMobile ? "column" : "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      marginBottom: 12,
    },

    artistSearchBox: {
      height: 50,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 13,
      marginBottom: 10,
    },

    artistSearchInput: {
      flex: 1,
      color: colors.text,
      fontSize: 13,
      fontWeight: "700",
      marginLeft: 8,
    },

    artistFilters: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 7,
      marginBottom: 8,
    },

    artistFilterButton: {
      flex: 1,
      minHeight: 38,
      borderRadius: 13,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      alignItems: "center",
      justifyContent: "center",
    },

    artistFilterButtonActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },

    artistFilterText: {
      color: colors.secondary,
      fontSize: 11,
      fontWeight: "900",
    },

    artistFilterTextActive: {
      color: colors.onPrimary,
    },

    artistCountText: {
      color: colors.secondary,
      fontSize: 11,
      fontWeight: "800",
      marginBottom: 10,
    },

    artistCompactCard: {
      width: "100%",
      maxWidth: 1050,
      alignSelf: "center",
      minHeight: 76,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 18,
      padding: 8,
      marginBottom: 8,
      flexDirection: isMobile ? "column" : "row",
      alignItems: "center",
    },

    artistCompactImage: {
      width: 52,
      height: 52,
      borderRadius: 14,
      marginRight: 10,
      backgroundColor: colors.background,
    },

    artistCompactPlaceholder: {
      width: 52,
      height: 52,
      borderRadius: 14,
      marginRight: 10,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
    },

    artistCompactInfo: {
      flex: 1,
      minWidth: 0,
      paddingVertical: 2,
    },

    artistCompactName: {
      color: colors.text,
      fontSize: 14,
      fontWeight: "900",
    },

    artistCompactInstagram: {
      color: colors.primary,
      fontSize: 10,
      fontWeight: "800",
      marginTop: 3,
    },

    artistCompactStatusRow: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 4,
    },

    artistCompactStatusDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      marginRight: 5,
    },

    artistCompactStatusText: {
      fontSize: 9,
      fontWeight: "900",
    },

    artistCompactActions: {
      flexDirection: "column",
      gap: 4,
      marginLeft: 7,
    },

    artistCompactAction: {
      width: 28,
      height: 28,
      borderRadius: 9,
      alignItems: "center",
      justifyContent: "center",
    },

    artistCompactEdit: {
      width: 28,
      height: 28,
      borderRadius: 9,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },

    eventCard: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: "#000",
      shadowOpacity: isDark ? 0.14 : 0.045,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
      elevation: 2,
      borderRadius: 28,
      padding: 18,
      marginBottom: 20,
    },

    eventImage: {
      width: "100%",
      height: 220,
      borderRadius: 22,
      marginBottom: 16,
      backgroundColor: colors.background,
    },

    eventTitle: {
      color: colors.text,
      fontSize: 24,
      fontWeight: "900",
      marginBottom: 8,
    },

    eventDate: {
      color: colors.primary,
      fontSize: 14,
      fontWeight: "900",
      marginBottom: 6,
    },

    eventLocation: {
      color: colors.text,
      fontSize: 15,
      fontWeight: "800",
      marginBottom: 10,
    },

    eventDescription: {
      color: colors.secondary,
      fontSize: 15,
      lineHeight: 22,
      marginBottom: 16,
    },

    priceBox: {
      backgroundColor: colors.background,
      borderRadius: 18,
      padding: 14,
      marginBottom: 16,
    },

    priceText: {
      color: colors.text,
      fontSize: 14,
      fontWeight: "800",
      marginBottom: 6,
      lineHeight: 20,
    },

    actions: {
      flexDirection: "row",
      justifyContent: "flex-end",
      gap: 12,
    },

    editButton: {
      width: 48,
      height: 48,
      borderRadius: 18,
      backgroundColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
    },

    deleteButton: {
      width: 48,
      height: 48,
      borderRadius: 18,
      backgroundColor: colors.danger,
      alignItems: "center",
      justifyContent: "center",
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
    },

    emptyText: {
      color: colors.secondary,
      fontSize: 15,
      textAlign: "center",
      lineHeight: 22,
    },
  });
