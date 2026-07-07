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
import { useEffect, useState } from "react";
import {
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useTheme } from "../contexts/ThemeContext";
import { db, storage } from "../firebase";
import { sendPushNotificationsToRoleAsync } from "../services/pushNotifications";

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
};

export default function ManageEventsScreen() {
  const { colors, isDark } = useTheme();
  const styles = createStyles(colors, isDark);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [artists, setArtists] = useState<ArtistItem[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [location, setLocation] = useState("");

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

      Alert.alert(
        "Errore immagine",
        "Non è stato possibile caricare l’immagine su Firebase Storage.",
      );

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
      Alert.alert(
        "Permesso negato",
        "Devi autorizzare l’accesso alle immagini.",
      );
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
        Alert.alert(
          "Permesso negato",
          "Devi autorizzare l’accesso alle immagini.",
        );
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
      const uploaded = await uploadArtistImageToStorage(selectedUri);

      if (!uploaded?.url) {
        return;
      }

      setArtistImage(uploaded.url);
      setArtistImagePreviewUri(uploaded.url);
      setArtistImagePath(uploaded.path || "");
    } catch (error: any) {
      setUploadingArtistImage(false);
      Alert.alert(
        "Errore foto",
        String(error?.message || "Non è stato possibile caricare la foto."),
      );
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
      Alert.alert("Errore immagine", "Non è stato possibile caricare la foto artista.");
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
      Alert.alert("Nome mancante", "Inserisci il nome dell’artista.");
      return;
    }

    if (!editingArtistId && !artistImage.trim()) {
      Alert.alert("Foto mancante", "Carica una foto dell’artista prima di pubblicarlo.");
      return;
    }

    try {
      setLoading(true);

      const oldArtist = artists.find((artist) => artist.id === editingArtistId);
      const uploaded = artistImage ? await uploadArtistImageToStorage(artistImage) : null;

      if (artistImage && !uploaded) {
        setLoading(false);
        return;
      }

      const artistData = {
        name: artistName.trim(),
        description: artistDescription.trim(),
        instagram: artistInstagram.trim().replace("https://instagram.com/", "").replace("@", ""),
        image: uploaded?.url || oldArtist?.image || "",
        imagePath: uploaded?.path || oldArtist?.imagePath || "",
        isVisible: true,
        updatedAt: serverTimestamp(),
      };

      if (editingArtistId) {
        await updateDoc(doc(db, "artists", editingArtistId), artistData);
        await deleteOldImageIfNeeded(oldArtist?.imagePath || "", uploaded?.path || "");
      } else {
        const artistRef = await addDoc(collection(db, "artists"), {
          ...artistData,
          createdAt: serverTimestamp(),
        });

        await createArtistNotification(artistRef.id, artistName.trim());
      }

      setLoading(false);
      resetArtistForm();
      Alert.alert("Artista salvato", "L’artista è stato pubblicato live.");
    } catch (error: any) {
      setLoading(false);
      Alert.alert(
        "Errore",
        String(error?.message || "Non è stato possibile salvare l’artista."),
      );
    }
  };

  const startEditArtist = (artist: ArtistItem) => {
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
      Alert.alert("Errore", "Non è stato possibile aggiornare la visibilità.");
    }
  };

  const deleteArtist = async (artist: ArtistItem) => {
    try {
      await deleteDoc(doc(db, "artists", artist.id));

      if (artist.imagePath) {
        try {
          await deleteObject(ref(storage, artist.imagePath));
        } catch {}
      }

      if (editingArtistId === artist.id) resetArtistForm();

      Alert.alert("Artista eliminato", "Artista eliminato correttamente.");
    } catch {
      Alert.alert("Errore", "Non è stato possibile eliminare l’artista.");
    }
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
      Alert.alert(
        "Pack incompleto",
        "Inserisci lettera, prezzo e descrizione.",
      );
      return;
    }

    if (!isValidPrice(packPrice)) {
      Alert.alert(
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
      Alert.alert("Pack già esistente", `Il Pack ${cleanLetter} esiste già.`);
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
      Alert.alert("Campi mancanti", "Compila tutti i campi obbligatori.");
      return;
    }

    if (packs.length === 0) {
      Alert.alert("Pack mancanti", "Aggiungi almeno un pack a persona.");
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

      Alert.alert(
        "Evento salvato",
        "Evento, immagine, pack e supplementi sono sincronizzati live.",
      );
    } catch {
      setLoading(false);
      Alert.alert("Errore", "Non è stato possibile salvare l’evento.");
    }
  };

  const startEdit = (event: EventItem) => {
    setEditingId(event.id);
    setTitle(event.title || "");
    setDescription(event.description || "");
    setStartDate(event.startDate || "");
    setEndDate(event.endDate || "");
    setLocation(event.location || "");
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

  const deleteEvent = async (event: EventItem) => {
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

      if (editingId === event.id) resetForm();

      Alert.alert("Evento eliminato", "Evento eliminato correttamente.");
    } catch {
      Alert.alert("Errore", "Non è stato possibile eliminare l’evento.");
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

      <Text style={styles.title}>Gestione eventi</Text>

      <Text style={styles.subtitle}>
        Crea eventi, pack a persona, supplementi per tipologia camera e immagini
        cloud.
      </Text>

      <View style={styles.card}>
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

        <TextInput
          style={styles.input}
          placeholder="Dal es. 12/08/2026"
          placeholderTextColor={colors.placeholder}
          value={startDate}
          onChangeText={setStartDate}
        />

        <TextInput
          style={styles.input}
          placeholder="Al es. 15/08/2026"
          placeholderTextColor={colors.placeholder}
          value={endDate}
          onChangeText={setEndDate}
        />

        <TextInput
          style={styles.input}
          placeholder="Location evento"
          placeholderTextColor={colors.placeholder}
          value={location}
          onChangeText={setLocation}
        />

        <Text style={styles.sectionTitle}>Pack a persona</Text>

        <View style={styles.packForm}>
          <TextInput
            style={styles.input}
            placeholder="Lettera pack es. A"
            placeholderTextColor={colors.placeholder}
            value={packLetter}
            onChangeText={setPackLetter}
            editable={!editingPackId}
            autoCapitalize="characters"
            maxLength={1}
          />

          <TextInput
            style={styles.input}
            placeholder="Prezzo base a persona es. 250"
            placeholderTextColor={colors.placeholder}
            value={packPrice}
            onChangeText={(value) => setPackPrice(cleanPriceValue(value))}
            keyboardType="numeric"
          />

          <TextInput
            style={[styles.input, styles.textAreaSmall]}
            placeholder="Descrizione es. Full pass"
            placeholderTextColor={colors.placeholder}
            value={packDescription}
            onChangeText={setPackDescription}
            multiline
          />

          <Text style={styles.supplementTitle}>Supplementi camera</Text>

          <TextInput
            style={styles.input}
            placeholder="Supplemento Doppia es. 30"
            placeholderTextColor={colors.placeholder}
            value={supplementDoppia}
            onChangeText={(value) => setSupplementDoppia(cleanPriceValue(value))}
            keyboardType="numeric"
          />

          <TextInput
            style={styles.input}
            placeholder="Supplemento Tripla es. 0"
            placeholderTextColor={colors.placeholder}
            value={supplementTripla}
            onChangeText={(value) => setSupplementTripla(cleanPriceValue(value))}
            keyboardType="numeric"
          />

          <TextInput
            style={styles.input}
            placeholder="Supplemento Quadrupla es. 0"
            placeholderTextColor={colors.placeholder}
            value={supplementQuadrupla}
            onChangeText={(value) => setSupplementQuadrupla(cleanPriceValue(value))}
            keyboardType="numeric"
          />

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
          <TouchableOpacity style={styles.cancelButton} onPress={resetForm}>
            <Text style={styles.cancelButtonText}>Annulla modifica</Text>
          </TouchableOpacity>
        ) : null}
      </View>


      <View style={styles.card}>
        <Text style={styles.cardTitle}>
          {editingArtistId ? "Modifica artista" : "Gestione artisti"}
        </Text>

        <Text style={styles.artistHelpText}>
          Carica artisti, DJ e ospiti da mostrare live nella sezione Esplora.
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
          <Image
            source={{ uri: artistImagePreviewUri || artistImage }}
            style={styles.preview}
            resizeMode="cover"
          />
        ) : null}

        <TouchableOpacity
          style={[styles.saveButton, loading && styles.saveButtonDisabled]}
          onPress={saveArtist}
          disabled={loading || uploadingArtistImage}
        >
          <Ionicons
            name={editingArtistId ? "save-outline" : "add-outline"}
            size={22}
            color={colors.text}
          />

          <Text style={styles.saveButtonText}>
            {editingArtistId ? "Salva artista" : "Pubblica artista"}
          </Text>
        </TouchableOpacity>

        {editingArtistId ? (
          <TouchableOpacity style={styles.cancelButton} onPress={resetArtistForm}>
            <Text style={styles.cancelButtonText}>Annulla modifica artista</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <Text style={styles.sectionTitle}>Artisti pubblicati</Text>

      {artists.length === 0 ? (
        <View style={styles.emptyBox}>
          <Ionicons name="musical-notes-outline" size={50} color={colors.secondary} />
          <Text style={styles.emptyTitle}>Nessun artista</Text>
          <Text style={styles.emptyText}>Gli artisti pubblicati compariranno qui.</Text>
        </View>
      ) : (
        artists.map((artist) => (
          <View key={artist.id} style={styles.eventCard}>
            {artist.image ? (
              <Image source={{ uri: artist.image }} style={styles.eventImage} />
            ) : null}

            <Text style={styles.eventTitle}>{artist.name || "Artista senza nome"}</Text>

            {artist.instagram ? (
              <Text style={styles.eventLocation}>Instagram: @{artist.instagram}</Text>
            ) : null}

            <Text style={styles.eventDescription}>
              {artist.description || "Nessuna descrizione."}
            </Text>

            <View style={styles.actions}>
              <TouchableOpacity style={styles.editButton} onPress={() => startEditArtist(artist)}>
                <Ionicons name="create-outline" size={22} color={colors.text} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.editButton,
                  { backgroundColor: artist.isVisible === false ? colors.warning : colors.success },
                ]}
                onPress={() => toggleArtistVisibility(artist)}
              >
                <Ionicons
                  name={artist.isVisible === false ? "eye-off-outline" : "eye-outline"}
                  size={22}
                  color={colors.text}
                />
              </TouchableOpacity>

              <TouchableOpacity style={styles.deleteButton} onPress={() => deleteArtist(artist)}>
                <Ionicons name="trash-outline" size={22} color={colors.text} />
              </TouchableOpacity>
            </View>
          </View>
        ))
      )}

      <Text style={styles.sectionTitle}>Eventi pubblicati</Text>

      {events.length === 0 ? (
        <View style={styles.emptyBox}>
          <Ionicons name="calendar" size={50} color={colors.secondary} />

          <Text style={styles.emptyTitle}>Nessun evento</Text>

          <Text style={styles.emptyText}>
            Gli eventi pubblicati compariranno qui.
          </Text>
        </View>
      ) : (
        events.map((event) => (
          <View key={event.id} style={styles.eventCard}>
            {event.image ? (
              <Image source={{ uri: event.image }} style={styles.eventImage} />
            ) : null}

            <Text style={styles.eventTitle}>
              {event.title || "Evento senza titolo"}
            </Text>

            <Text style={styles.eventDate}>
              Dal {event.startDate || "-"} al {event.endDate || "-"}
            </Text>

            <Text style={styles.eventLocation}>
              {event.location || "Location non inserita"}
            </Text>

            <Text style={styles.eventDescription}>
              {event.description || "Nessuna descrizione."}
            </Text>

            <View style={styles.priceBox}>
              {Array.isArray(event.packs) && event.packs.length > 0 ? (
                event.packs.map((pack) => (
                  <Text key={pack.id} style={styles.priceText}>
                    Pack {pack.letter}: €{pack.price} • Doppia +€
                    {pack.supplementDoppia || "0"} • Tripla +€
                    {pack.supplementTripla || "0"} • Quadrupla +€
                    {pack.supplementQuadrupla || "0"}
                  </Text>
                ))
              ) : (
                <Text style={styles.priceText}>Nessun pack.</Text>
              )}
            </View>

            <View style={styles.actions}>
              <TouchableOpacity
                style={styles.editButton}
                onPress={() => startEdit(event)}
              >
                <Ionicons name="create-outline" size={22} color={colors.text} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => deleteEvent(event)}
              >
                <Ionicons name="trash-outline" size={22} color={colors.text} />
              </TouchableOpacity>
            </View>
          </View>
        ))
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
      fontSize: 40,
      fontWeight: "900",
      marginBottom: 10,
    },

    subtitle: {
      color: colors.secondary,
      fontSize: 16,
      marginBottom: 26,
      lineHeight: 23,
    },

    card: {
      backgroundColor: colors.card,
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

    textArea: {
      minHeight: 110,
      textAlignVertical: "top",
    },

    textAreaSmall: {
      minHeight: 80,
      textAlignVertical: "top",
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
      color: colors.text,
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
      flexDirection: "row",
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
      borderRadius: 20,
      marginBottom: 18,
      backgroundColor: colors.background,
    },

    saveButton: {
      backgroundColor: colors.primary,
      borderRadius: 20,
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

    eventCard: {
      backgroundColor: colors.card,
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
