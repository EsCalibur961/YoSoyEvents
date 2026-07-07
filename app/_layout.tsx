import AsyncStorage from "@react-native-async-storage/async-storage";
import { Stack } from "expo-router";
import * as Updates from "expo-updates";
import { addDoc, collection, doc, getDoc, serverTimestamp, updateDoc } from "firebase/firestore";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, AppState, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import NetInfo from "@react-native-community/netinfo";
import { ThemeProvider } from "../contexts/ThemeContext";
import { db } from "../firebase";
import { setupPushNotificationHandler, sendPushNotificationsToRoleAsync } from "../services/pushNotifications";

const getTeacherFullName = (teacherData: any) => {
  const fullName = `${teacherData?.firstName || ""} ${teacherData?.lastName || ""}`.trim();
  return fullName || teacherData?.username || "Un maestro";
};

const shouldNotifyOnline = (lastOnlineNotificationAt: any) => {
  if (!lastOnlineNotificationAt) return true;

  const lastDate =
    typeof lastOnlineNotificationAt?.toDate === "function"
      ? lastOnlineNotificationAt.toDate()
      : new Date(lastOnlineNotificationAt);

  if (Number.isNaN(lastDate.getTime())) return true;

  return Date.now() - lastDate.getTime() > 10 * 60 * 1000;
};

const updateTeacherPresence = async (isOnline: boolean, notifyAdmin = true) => {
  try {
    const loggedUser = await AsyncStorage.getItem("loggedUser");
    const teacherId = await AsyncStorage.getItem("teacherId");

    if (loggedUser !== "teacher" || !teacherId) return;

    const teacherRef = doc(db, "teachers", teacherId);

    if (!isOnline || !notifyAdmin) {
      await updateDoc(teacherRef, {
        isOnline,
        lastSeen: serverTimestamp(),
      });

      return;
    }

    const teacherSnap = await getDoc(teacherRef);
    const teacherData = teacherSnap.exists() ? teacherSnap.data() : null;
    const wasOnline = Boolean(teacherData?.isOnline);

    const shouldNotifyAdmin =
      !wasOnline && shouldNotifyOnline(teacherData?.lastOnlineNotificationAt);

    await updateDoc(teacherRef, {
      isOnline: true,
      lastSeen: serverTimestamp(),
      ...(shouldNotifyAdmin ? { lastOnlineNotificationAt: serverTimestamp() } : {}),
    });

    if (shouldNotifyAdmin) {
      const teacherName = getTeacherFullName(teacherData);

      await addDoc(collection(db, "notifications"), {
        title: "Maestro online",
        message: `${teacherName} è online.`,
        type: "system",
        targetRole: "admin",
        teacherId,
        teacherUsername: teacherData?.username || "",
        createdAt: new Date().toLocaleString("it-IT"),
        createdAtServer: serverTimestamp(),
      });

      await sendPushNotificationsToRoleAsync(
        "admin",
        "Maestro online",
        `${teacherName} è online.`,
        {
          type: "teacher_online",
          teacherId,
          teacherUsername: teacherData?.username || "",
        },
      );
    }
  } catch (error) {
    console.log("Presenza maestro non aggiornata:", error);
  }
};

export default function RootLayout() {
  const [loadingConnection, setLoadingConnection] = useState(true);
  const [isConnected, setIsConnected] = useState(true);
  const appStateRef = useRef(AppState.currentState);

  const checkConnection = async () => {
    try {
      setLoadingConnection(true);

      const state = await NetInfo.fetch();
      const connected =
        state.isConnected === true && state.isInternetReachable !== false;

      setIsConnected(connected);
    } catch {
      setIsConnected(false);
    } finally {
      setLoadingConnection(false);
    }
  };

  useEffect(() => {
    setupPushNotificationHandler();

    const checkForLiveUpdate = async () => {
      try {
        if (__DEV__) return;

        const update = await Updates.checkForUpdateAsync();

        if (update.isAvailable) {
          await Updates.fetchUpdateAsync();
          await Updates.reloadAsync();
        }
      } catch (error) {
        console.log("Expo update non applicato:", error);
      }
    };

    checkConnection();
    checkForLiveUpdate();

    const netInfoSubscription = NetInfo.addEventListener((state) => {
      const connected =
        state.isConnected === true && state.isInternetReachable !== false;

      setIsConnected(connected);
      setLoadingConnection(false);
    });

    if (AppState.currentState === "active") {
      updateTeacherPresence(true);
    }

    const heartbeatInterval = setInterval(() => {
      if (appStateRef.current === "active") {
        updateTeacherPresence(true, false);
      }
    }, 90000);

    const subscription = AppState.addEventListener("change", (state) => {
      appStateRef.current = state;

      if (state === "active") {
        checkConnection();
        updateTeacherPresence(true);
      } else if (state === "background" || state === "inactive") {
        updateTeacherPresence(false);
      }
    });

    return () => {
      clearInterval(heartbeatInterval);
      updateTeacherPresence(false);
      subscription.remove();
      netInfoSubscription();
    };
  }, []);

  if (loadingConnection) {
    return (
      <ThemeProvider>
        <View style={styles.statusContainer}>
          <Text style={styles.statusLogo}>YoSoy Events</Text>
          <ActivityIndicator size="large" color="#D9B44A" style={styles.loader} />
          <Text style={styles.statusTitle}>Caricamento dati...</Text>
          <Text style={styles.statusText}>
            Stiamo verificando connessione e sincronizzazione.
          </Text>
        </View>
      </ThemeProvider>
    );
  }

  if (!isConnected) {
    return (
      <ThemeProvider>
        <View style={styles.statusContainer}>
          <Text style={styles.statusLogo}>YoSoy Events</Text>
          <Text style={styles.offlineIcon}>📡</Text>
          <Text style={styles.statusTitle}>Connessione assente</Text>
          <Text style={styles.statusText}>
            YoSoyEvents richiede una connessione internet per sincronizzare
            camere, notifiche, pagamenti e presenza online.
          </Text>

          <TouchableOpacity style={styles.retryButton} onPress={checkConnection}>
            <Text style={styles.retryButtonText}>Riprova</Text>
          </TouchableOpacity>
        </View>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  statusContainer: {
    flex: 1,
    backgroundColor: "#061A36",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
  },

  statusLogo: {
    color: "#FFFFFF",
    fontSize: 32,
    fontWeight: "900",
    marginBottom: 28,
    letterSpacing: 1,
  },

  loader: {
    marginBottom: 22,
  },

  offlineIcon: {
    fontSize: 54,
    marginBottom: 20,
  },

  statusTitle: {
    color: "#FFFFFF",
    fontSize: 26,
    fontWeight: "900",
    textAlign: "center",
    marginBottom: 12,
  },

  statusText: {
    color: "#D8E1F2",
    fontSize: 16,
    lineHeight: 24,
    textAlign: "center",
    maxWidth: 340,
  },

  retryButton: {
    backgroundColor: "#0B3A75",
    borderRadius: 18,
    paddingVertical: 15,
    paddingHorizontal: 34,
    marginTop: 28,
  },

  retryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "900",
  },
});
