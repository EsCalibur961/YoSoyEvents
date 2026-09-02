import { createRequire } from "node:module";
import { initializeApp as initializeClientApp } from "firebase/app";
import { collection, getDocsFromServer, getFirestore as getClientFirestore } from "firebase/firestore";
import { calculatePackFinalPrice, serializePackPrice } from "../utils/packPricing.mjs";

const apply = process.argv.includes("--apply");
const projectIdArg = process.argv.find((arg) => arg.startsWith("--project="));
const projectId = projectIdArg?.split("=")[1] || "yosoy-events";
const clientConfig = {
  // Config Web pubblica, mantenuta coerente con firebase.ts.
  apiKey: "AIzaSyCgse2JBg4Pah8k-gVUEGb6cLFwcbw",
  authDomain: `${projectId}.firebaseapp.com`,
  projectId,
  storageBucket: `${projectId}.firebasestorage.app`,
  messagingSenderId: "534651781819",
  appId: "1:534651781819:web:e89464d8dd311a3711df9e",
};

let eventDocs;
let roomDocs;
let adminFieldValue = null;

if (apply) {
  const requireFunctions = createRequire(new URL("../functions/package.json", import.meta.url));
  const { applicationDefault, getApps, initializeApp } = requireFunctions("firebase-admin/app");
  const { FieldValue, getFirestore } = requireFunctions("firebase-admin/firestore");
  if (!getApps().length) initializeApp({ credential: applicationDefault(), projectId });
  const adminDb = getFirestore();
  const [eventsSnapshot, roomsSnapshot] = await Promise.all([
    adminDb.collection("events").get(),
    adminDb.collection("roomsData").get(),
  ]);
  eventDocs = eventsSnapshot.docs.map((item) => ({ id: item.id, data: item.data(), ref: item.ref }));
  roomDocs = roomsSnapshot.docs.map((item) => ({ id: item.id, data: item.data(), ref: item.ref }));
  adminFieldValue = FieldValue;
} else {
  const clientDb = getClientFirestore(initializeClientApp(clientConfig));
  const [eventsSnapshot, roomsSnapshot] = await Promise.all([
    getDocsFromServer(collection(clientDb, "events")),
    getDocsFromServer(collection(clientDb, "roomsData")),
  ]);
  eventDocs = eventsSnapshot.docs.map((item) => ({ id: item.id, data: item.data(), ref: null }));
  roomDocs = roomsSnapshot.docs.map((item) => ({ id: item.id, data: item.data(), ref: null }));
}

const packs = eventDocs.flatMap((eventDoc) => {
  const event = eventDoc.data;
  return (Array.isArray(event.packs) ? event.packs : []).map((pack) => ({
    ...pack,
    eventId: eventDoc.id,
    eventTitle: event.title || eventDoc.id,
  }));
});

const rows = [];
for (const roomDoc of roomDocs) {
  const room = roomDoc.data;
  const guests = Array.isArray(room.guests) ? room.guests : [];
  guests.forEach((guest, guestIndex) => {
    if (!guest?.selectedPackId && !guest?.selectedPackLetter) return;
    const idMatches = guest.selectedPackId
      ? packs.filter((pack) => pack.id === guest.selectedPackId)
      : [];
    const matches = idMatches.length
      ? idMatches
      : packs.filter((pack) =>
          guest.selectedPackLetter &&
          String(pack.letter || "").trim().toLowerCase() ===
            String(guest.selectedPackLetter).trim().toLowerCase(),
        );
    const expectedValues = [...new Set(matches.map((pack) => calculatePackFinalPrice(pack, room.roomType)))];
    const current = Number(String(guest.selectedPackPrice || "0").replace(",", "."));
    const resolved = expectedValues.length === 1 && Number.isFinite(current);
    const expected = resolved ? expectedValues[0] : null;
    const status = !resolved ? "AMBIGUO" : current === expected ? "CORRETTO" : "SICURAMENTE_ERRATO";
    rows.push({
      status,
      roomId: roomDoc.id,
      roomRef: roomDoc.ref,
      roomData: room,
      guestIndex,
      teacher: room.teacherUsername || "-",
      camera: room.customName || `${room.roomType || "Camera"} #${room.roomIndex || "-"}`,
      ospite: `${guest.firstName || ""} ${guest.lastName || ""}`.trim() || `Posto ${guestIndex + 1}`,
      pack: guest.selectedPackLetter || guest.selectedPackId || "-",
      prezzoAttuale: Number.isFinite(current) ? current : guest.selectedPackPrice,
      supplementoAtteso: resolved ? expected - Number(matches[0]?.price || 0) : "?",
      prezzoFinaleAtteso: expected ?? "?",
      candidati: matches.map((pack) => `${pack.eventTitle}/${pack.id || pack.letter}`).join(", ") || "nessuno",
    });
  });
}

console.table(rows.map(({ roomRef, roomData, guestIndex, ...row }) => row));
const counts = rows.reduce((acc, row) => ({ ...acc, [row.status]: (acc[row.status] || 0) + 1 }), {});
console.log("Riepilogo:", counts);

if (!apply) {
  console.log("DRY-RUN: nessun documento modificato. Usa --apply solo dopo aver verificato il report.");
  process.exit(0);
}

const fixesByRoom = new Map();
for (const row of rows.filter((item) => item.status === "SICURAMENTE_ERRATO")) {
  const current = fixesByRoom.get(row.roomId) || { ref: row.roomRef, guests: [...row.roomData.guests] };
  current.guests[row.guestIndex] = {
    ...current.guests[row.guestIndex],
    selectedPackPrice: serializePackPrice(row.prezzoFinaleAtteso),
  };
  fixesByRoom.set(row.roomId, current);
}

for (const fix of fixesByRoom.values()) {
  await fix.ref.update({ guests: fix.guests, updatedAt: adminFieldValue.serverTimestamp() });
}
console.log(`APPLY completato: ${fixesByRoom.size} camere aggiornate.`);
