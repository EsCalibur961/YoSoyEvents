const admin = require("firebase-admin");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const logger = require("firebase-functions/logger");

admin.initializeApp();

function uniqueTokens(tokens) {
  return Array.from(new Set(tokens.filter(Boolean)));
}

async function getTokens(notification) {
  let q = admin.firestore().collection("pushTokens").where("active", "==", true);

  if (notification.targetUsername) {
    q = q.where("username", "==", notification.targetUsername);
  } else if (notification.targetRole) {
    q = q.where("role", "==", notification.targetRole);
  }

  const snap = await q.get();
  return uniqueTokens(
    snap.docs
      .map((d) => String(d.data().expoPushToken || ""))
      .filter((t) => t.startsWith("ExponentPushToken["))
  );
}

async function sendExpo(tokens, title, body, data) {
  if (!tokens.length) {
    logger.info("Nessun token destinatario trovato.");
    return;
  }

  const messages = tokens.map((to) => ({
    to,
    sound: "default",
    title,
    body,
    data,
    priority: "high",
    channelId: "default",
  }));

  for (let i = 0; i < messages.length; i += 100) {
    const chunk = messages.slice(i, i + 100);

    const res = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Accept-Encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(chunk),
    });

    const json = await res.json();
    logger.info("Expo push result", json);
  }
}

exports.sendPushOnNotificationCreated = onDocumentCreated(
  {
    document: "notifications/{notificationId}",
    region: "europe-west1",
  },
  async (event) => {
    const snap = event.data;
    if (!snap) return;

    const n = snap.data() || {};
    const notificationId = event.params.notificationId;

    const title = n.title || "YoSoy Events";
    const body = n.message || "";
    const tokens = await getTokens(n);

    await sendExpo(tokens, title, body, {
      notificationId,
      type: n.type || "system",
      eventId: n.eventId || "",
      targetRole: n.targetRole || "",
      targetUsername: n.targetUsername || "",
      requestId: n.requestId || "",
      teacherUsername: n.teacherUsername || "",
    });

    await snap.ref.set(
      {
        pushSent: true,
        pushSentAt: admin.firestore.FieldValue.serverTimestamp(),
        pushRecipients: tokens.length,
      },
      { merge: true }
    );
  }
);
