import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { setGlobalOptions } from "firebase-functions";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import * as logger from "firebase-functions/logger";

initializeApp();
setGlobalOptions({ maxInstances: 10 });

const db = getFirestore();

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

function isExpoPushToken(token: string) {
  return (
    typeof token === "string" &&
    (token.startsWith("ExpoPushToken[") || token.startsWith("ExponentPushToken["))
  );
}

export const sendPushOnNotificationCreated = onDocumentCreated(
  "notifications/{notificationId}",
  async (event) => {
    const notification = event.data?.data();

    if (!notification) {
      logger.warn("Notifica vuota, nessuna push inviata.");
      return;
    }

    const title = String(notification.title || "YoSoy Events");
    const body = String(notification.message || "Hai una nuova notifica.");
    const type = String(notification.type || "system");
    const eventId = String(notification.eventId || "");

    const tokensSnapshot = await db
      .collection("pushTokens")
      .where("active", "==", true)
      .get();

    const tokens = Array.from(
      new Set(
        tokensSnapshot.docs
          .map((doc) => String(doc.data().expoPushToken || ""))
          .filter(isExpoPushToken),
      ),
    );

    if (tokens.length === 0) {
      logger.info("Nessun Expo Push Token registrato.");
      return;
    }

    const messages = tokens.map((token) => ({
      to: token,
      sound: "default",
      title,
      body,
      channelId: "default",
      priority: "high",
      data: {
        notificationId: event.params.notificationId,
        type,
        eventId,
      },
    }));

    const chunks = chunkArray(messages, 100);

    for (const chunk of chunks) {
      const response = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Accept-Encoding": "gzip, deflate",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(chunk),
      });

      const result = await response.json();
      logger.info("Expo push result", { result });
    }
  },
);
