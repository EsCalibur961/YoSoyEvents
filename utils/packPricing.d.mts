export type PackPricingPack = {
  id?: string;
  letter?: string;
  price?: string | number;
  supplementDoppia?: string | number;
  supplementTripla?: string | number;
  supplementQuadrupla?: string | number;
};
export type PackPricingGuest = {
  selectedPackId?: string;
  selectedPackLetter?: string;
  selectedPackPrice?: string;
};
export function moneyNumber(value: unknown): number;
export function roundMoney(value: unknown): number;
export function getPackSupplement(pack: PackPricingPack | null | undefined, roomType: string): number;
export function calculatePackFinalPrice(pack: PackPricingPack | null | undefined, roomType: string): number;
export function serializePackPrice(value: unknown): string;
export function applyPackSelectionPrice<T extends PackPricingGuest>(guest: T, pack: PackPricingPack | null, roomType: string): T;
export function findSelectedPack(packs: PackPricingPack[], guest: PackPricingGuest): PackPricingPack | null;
export function repriceGuestForRoom<T extends PackPricingGuest>(guest: T, packs: PackPricingPack[], roomType: string): T;
export function getGuestFinalPrice(guest: PackPricingGuest, pack?: PackPricingPack | null, roomType?: string): number;
export function sumGuestFinalPrices(guests: PackPricingGuest[]): number;
