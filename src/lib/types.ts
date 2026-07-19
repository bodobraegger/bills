export type DocumentMode = "offerte" | "rechnung";

export interface LineItem {
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
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
  closingText: string;
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
  return {
    name: "Jane Doe",
    address: "Musterstrasse 1",
    zip: "0000",
    city: "Musterstadt",
    country: "CH",
    iban: "CH00 0000 0000 0000 0000 0",
    email: "name@example.com",
    phone: "",
    vatNumber: "",
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
    closingText: "Besten Dank für Ihr Vertrauen.",
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

export function computeTotals(doc: BillDocument): Totals {
  const subtotal = doc.items.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice,
    0,
  );
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
