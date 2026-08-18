import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { collection, doc, getDocs, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "../firebase";

export function setupPushNotificationHandler() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

type RegisterPushParams = {
  role: "admin" | "teacher";
  username: string;
  teacherId?: string;
};

function getProjectId() {
  return (
    Constants.expoConfig?.extra?.eas?.projectId ||
    Constants.easConfig?.projectId ||
    "97ea2947-8d2d-4dc6-acb3-bbf6322b9e78"
  );
}

function tokenToDocId(token: string) {
  return token.replace(/[^a-zA-Z0-9_-]/g, "_");
}

export async function registerForPushNotificationsAsync({
  role,
  username,
  teacherId = "",
}: RegisterPushParams) {
  try {
    if (!Device.isDevice) {
      console.log("Push notifications richiedono un dispositivo fisico.");
      return null;
    }

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "Notifiche YoSoy Events",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#0B3A75",
        sound: "default",
      });
    }

    const currentPermissions = await Notifications.getPermissionsAsync();
    let finalStatus = currentPermissions.status;

    if (finalStatus !== "granted") {
      const requestedPermissions = await Notifications.requestPermissionsAsync();
      finalStatus = requestedPermissions.status;
    }

    if (finalStatus !== "granted") {
      console.log("Permesso notifiche non concesso.");
      return null;
    }

    const projectId = getProjectId();
    const tokenResult = await Notifications.getExpoPushTokenAsync({ projectId });
    const expoPushToken = tokenResult.data;

    await AsyncStorage.setItem("expoPushToken", expoPushToken);

    const tokenDocId = tokenToDocId(expoPushToken);

    await setDoc(
      doc(db, "pushTokens", tokenDocId),
      {
        expoPushToken,
        role,
        username,
        teacherId,
        platform: Platform.OS,
        app: "YoSoyEvents",
        active: true,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );

    return expoPushToken;
  } catch (error) {
    console.log("Errore registrazione push token:", error);
    return null;
  }
}


type PushPayload = {
  title: string;
  body: string;
  data?: Record<string, any>;
};

async function sendExpoPushMessages(tokens: string[], payload: PushPayload) {
  try {
    const uniqueTokens = Array.from(new Set(tokens.filter(Boolean)));

    if (uniqueTokens.length === 0) return;

    const messages = uniqueTokens.map((token) => ({
      to: token,
      sound: "default",
      title: payload.title,
      body: payload.body,
      data: payload.data || {},
      priority: "high",
      channelId: "default",
    }));

    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(messages),
    });

    const result = await response.json();
    console.log("Push inviate:", result);
  } catch (error) {
    console.log("Errore invio push:", error);
  }
}

export async function sendPushNotificationsToRoleAsync(
  role: "admin" | "teacher",
  title: string,
  body: string,
  data: Record<string, any> = {},
) {
  try {
    const snapshot = await getDocs(collection(db, "pushTokens"));

    const tokens = snapshot.docs
      .map((item) => item.data() as any)
      .filter((item) => item.active !== false)
      .filter((item) => item.role === role)
      .map((item) => item.expoPushToken)
      .filter(Boolean);

    await sendExpoPushMessages(tokens, { title, body, data });
  } catch (error) {
    console.log("Errore push role:", error);
  }
}

export async function sendPushNotificationToUsernameAsync(
  username: string,
  title: string,
  body: string,
  data: Record<string, any> = {},
) {
  try {
    const snapshot = await getDocs(collection(db, "pushTokens"));

    const tokens = snapshot.docs
      .map((item) => item.data() as any)
      .filter((item) => item.active !== false)
      .filter((item) => item.username === username)
      .map((item) => item.expoPushToken)
      .filter(Boolean);

    await sendExpoPushMessages(tokens, { title, body, data });
  } catch (error) {
    console.log("Errore push username:", error);
  }
}
