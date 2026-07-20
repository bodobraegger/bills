export type DocumentMode = "offerte" | "rechnung";

export interface LineItem {
  description: string;
  quantity?: number;
  unit?: string;
  unitPrice?: number;
  items?: LineItem[];
}

export interface BillDocument {
  id: string;
  number: string;
  date: string;
  validUntil: string;
  dueDate: string;
  clientName: string;
  clientAddress: string;
  clientZip: string;
  clientCity: string;
  introText: string;
  outroText: string;
  goodbyeText: string;
  items: LineItem[];
  vatEnabled: boolean;
  vatRate: number;
  currency: "CHF" | "EUR";
}

export interface Settings {
  name: string;
  address: string;
  zip: string;
  city: string;
  country: string;
  iban: string;
  email: string;
  phone: string;
  vatNumber: string;
}

export interface Totals {
  subtotal: number;
  vat: number;
  total: number;
}

export function defaultSettings(): Settings {
  const env = import.meta.env;
  return {
    name: env.PUBLIC_DEFAULT_NAME ?? "",
    address: env.PUBLIC_DEFAULT_ADDRESS ?? "",
    zip: env.PUBLIC_DEFAULT_ZIP ?? "",
    city: env.PUBLIC_DEFAULT_CITY ?? "",
    country: env.PUBLIC_DEFAULT_COUNTRY ?? "CH",
    iban: env.PUBLIC_DEFAULT_IBAN ?? "",
    email: env.PUBLIC_DEFAULT_EMAIL ?? "",
    phone: env.PUBLIC_DEFAULT_PHONE ?? "",
    vatNumber: env.PUBLIC_DEFAULT_VAT_NUMBER ?? "",
  };
}

export function emptyItem(): LineItem {
  return { description: "", quantity: 1, unit: "h", unitPrice: 0 };
}

export function createDocument(number: string): BillDocument {
  return {
    id: crypto.randomUUID(),
    number,
    date: isoToday(),
    validUntil: isoDatePlusDays(30),
    dueDate: isoDatePlusDays(30),
    clientName: "",
    clientAddress: "",
    clientZip: "",
    clientCity: "",
    introText: "",
    outroText: "",
    goodbyeText: "Besten Dank für Ihr Vertrauen.",
    items: [emptyItem()],
    vatEnabled: false,
    vatRate: 8.1,
    currency: "CHF",
  };
}

export function cloneDocument(
  source: BillDocument,
  number: string,
): BillDocument {
  return {
    ...structuredClone(source),
    id: crypto.randomUUID(),
    number,
    date: isoToday(),
    validUntil: isoDatePlusDays(30),
    dueDate: isoDatePlusDays(30),
  };
}

export function suggestNumber(documents: BillDocument[]): string {
  const year = new Date().getFullYear();
  const prefix = `${year}-`;
  const sequences = documents
    .filter((doc) => doc.number.startsWith(prefix))
    .map((doc) => Number.parseInt(doc.number.slice(prefix.length), 10))
    .filter((sequence) => Number.isFinite(sequence));
  const next = sequences.length > 0 ? Math.max(...sequences) + 1 : 1;
  return `${prefix}${String(next).padStart(3, "0")}`;
}

export function isPriced(item: LineItem): boolean {
  return item.unitPrice !== undefined;
}

export function itemAmount(item: LineItem): number {
  if (item.items) {
    return item.items.reduce((sum, child) => sum + itemAmount(child), 0);
  }
  if (!isPriced(item)) return 0;
  return (item.quantity ?? 1) * item.unitPrice!;
}

export function computeTotals(doc: BillDocument): Totals {
  const subtotal = doc.items.reduce((sum, item) => sum + itemAmount(item), 0);
  const vat = doc.vatEnabled ? subtotal * (doc.vatRate / 100) : 0;
  return { subtotal, vat, total: subtotal + vat };
}

export function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}

export function isoDatePlusDays(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}
