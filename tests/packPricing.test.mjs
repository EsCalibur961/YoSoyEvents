import assert from "node:assert/strict";
import {
  applyPackSelectionPrice,
  calculatePackFinalPrice,
  getGuestFinalPrice,
  repriceGuestForRoom,
  sumGuestFinalPrices,
} from "../utils/packPricing.mjs";

const packB = {
  id: "pack-b",
  letter: "B",
  price: "199",
  supplementDoppia: "30",
  supplementTripla: "0",
  supplementQuadrupla: "0",
};
const packC = {
  id: "pack-c",
  letter: "C",
  price: "229",
  supplementDoppia: "10",
  supplementTripla: "0",
};
const guest = { firstName: "Test", selectedPackId: "", selectedPackLetter: "", selectedPackPrice: "" };

assert.equal(calculatePackFinalPrice(packB, "Tripla"), 199, "Pack B senza supplemento");
assert.equal(calculatePackFinalPrice(packB, "Doppia"), 229, "Pack B con supplemento 30");

const selectedB = applyPackSelectionPrice(guest, packB, "Doppia");
assert.equal(selectedB.selectedPackPrice, "229", "la selezione salva il prezzo finale");
assert.equal(getGuestFinalPrice(selectedB, packB, "Doppia"), 229, "229 non diventa 259");

const withoutSupplement = repriceGuestForRoom(selectedB, [packB], "Tripla");
assert.equal(withoutSupplement.selectedPackPrice, "199", "rimuovere il supplemento ripristina il base");

const changedPack = applyPackSelectionPrice(selectedB, packC, "Doppia");
assert.equal(changedPack.selectedPackPrice, "239", "cambio Pack ricalcolato");

const reopened = JSON.parse(JSON.stringify(selectedB));
assert.equal(getGuestFinalPrice(reopened), 229, "salvataggio e riapertura mantengono il totale");
assert.equal(sumGuestFinalPrices([selectedB, selectedB]), 458, "totale camera");
assert.equal(sumGuestFinalPrices([withoutSupplement, withoutSupplement]), 398, "totale senza supplemento");
assert.equal(
  sumGuestFinalPrices([selectedB, selectedB, withoutSupplement, withoutSupplement]),
  856,
  "totale maestro come somma camere",
);

console.log("Pack pricing tests: 10 casi superati");
