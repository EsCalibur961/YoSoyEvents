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

function safePushText(value: unknown, fallback: string, maxLength: number) {
  const text = String(value || fallback).trim();
  return text.slice(0, maxLength);
}

export const sendPushOnNotificationCreated = onDocumentCreated(
  "notifications/{notificationId}",
  async (event) => {
    const notification = event.data?.data();

    if (!notification) {
      logger.warn("Notifica vuota, nessuna push inviata.");
      return;
    }

    const title = safePushText(notification.title, "YoSoy Events", 120);
    const body = safePushText(notification.message, "Hai una nuova notifica.", 500);
    const type = safePushText(notification.type, "system", 40);
    const eventId = safePushText(notification.eventId, "", 160);
    const targetRole = safePushText(notification.targetRole, "", 20);
    const targetUsername = safePushText(notification.targetUsername, "", 100);

    let tokensQuery = db.collection("pushTokens").where("active", "==", true);
    if (targetUsername) tokensQuery = tokensQuery.where("username", "==", targetUsername);
    else if (targetRole && targetRole !== "all") tokensQuery = tokensQuery.where("role", "==", targetRole);
    const tokensSnapshot = await tokensQuery.get();

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

      if (!response.ok) {
        logger.error("Invio Expo push non riuscito", { status: response.status });
        continue;
      }
      logger.info("Expo push inviate", { count: chunk.length });
    }
  },
);
