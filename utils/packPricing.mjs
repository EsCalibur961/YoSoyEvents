const ROOM_SUPPLEMENT_FIELDS = {
  Doppia: "supplementDoppia",
  Tripla: "supplementTripla",
  Quadrupla: "supplementQuadrupla",
};

export function moneyNumber(value) {
  const normalized = String(value ?? "")
    .trim()
    .replace(/\s/g, "")
    .replace(",", ".");
  if (!normalized) return 0;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function roundMoney(value) {
  return Math.round((moneyNumber(value) + Number.EPSILON) * 100) / 100;
}

export function getPackSupplement(pack, roomType) {
  const field = ROOM_SUPPLEMENT_FIELDS[roomType];
  return field ? roundMoney(pack?.[field]) : 0;
}

export function calculatePackFinalPrice(pack, roomType) {
  return roundMoney(moneyNumber(pack?.price) + getPackSupplement(pack, roomType));
}

export function serializePackPrice(value) {
  return String(roundMoney(value));
}

export function applyPackSelectionPrice(guest, pack, roomType) {
  if (!pack) {
    return {
      ...guest,
      selectedPackId: "",
      selectedPackLetter: "",
      selectedPackPrice: "",
    };
  }

  return {
    ...guest,
    selectedPackId: pack.id || "",
    selectedPackLetter: pack.letter || "",
    // selectedPackPrice e il prezzo finale per ospite, supplemento incluso.
    selectedPackPrice: serializePackPrice(calculatePackFinalPrice(pack, roomType)),
  };
}

export function findSelectedPack(packs, guest) {
  const list = Array.isArray(packs) ? packs : [];
  const byId = list.find((pack) => pack?.id && pack.id === guest?.selectedPackId);
  if (byId) return byId;

  const letter = String(guest?.selectedPackLetter || "").trim().toLowerCase();
  if (!letter) return null;
  const byLetter = list.filter(
    (pack) => String(pack?.letter || "").trim().toLowerCase() === letter,
  );
  return byLetter.length === 1 ? byLetter[0] : null;
}

export function repriceGuestForRoom(guest, packs, roomType) {
  if (!guest?.selectedPackId && !guest?.selectedPackLetter) return { ...guest };
  const pack = findSelectedPack(packs, guest);
  return pack ? applyPackSelectionPrice(guest, pack, roomType) : { ...guest };
}

export function getGuestFinalPrice(guest, pack, roomType) {
  const stored = String(guest?.selectedPackPrice ?? "").trim();
  if (stored && Number.isFinite(Number(stored.replace(",", ".")))) {
    return roundMoney(stored);
  }
  return pack ? calculatePackFinalPrice(pack, roomType) : 0;
}

export function sumGuestFinalPrices(guests) {
  return roundMoney(
    (Array.isArray(guests) ? guests : []).reduce(
      (sum, guest) => sum + getGuestFinalPrice(guest),
      0,
    ),
  );
}
