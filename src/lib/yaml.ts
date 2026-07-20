import { dump, load } from "js-yaml";
import type { BillDocument, LineItem } from "./types";
import { emptyItem, isoDatePlusDays, isoToday } from "./types";

interface YamlItem {
  description: string;
  quantity?: number;
  unit?: string;
  unitPrice?: number;
  items?: YamlItem[];
}

interface YamlDocument {
  number: string;
  date: string;
  validUntil?: string;
  dueDate?: string;
  currency?: string;
  vat?: { enabled?: boolean; rate?: number };
  client?: {
    name?: string;
    address?: string;
    zip?: string;
    city?: string;
  };
  intro?: string;
  items: YamlItem[];
  outro?: string;
}

function itemToYaml(item: LineItem): YamlItem {
  const yamlItem: YamlItem = { description: item.description };
  if (item.quantity !== undefined) yamlItem.quantity = item.quantity;
  if (item.unit !== undefined) yamlItem.unit = item.unit;
  if (item.unitPrice !== undefined) yamlItem.unitPrice = item.unitPrice;
  if (item.items) yamlItem.items = item.items.map(itemToYaml);
  return yamlItem;
}

// js-yaml auto-parses unquoted dates ("2026-07-20") into Date objects and
// numeric-looking strings into numbers, so anything typed as a plain string
// or optional number in our schema needs defensive coercion on the way in.
function toYamlString(value: unknown): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return value === undefined || value === null ? "" : String(value);
}

function toOptionalNumber(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const num = Number(value);
  return Number.isFinite(num) ? num : undefined;
}

function itemFromYaml(item: YamlItem): LineItem {
  return {
    description: toYamlString(item.description),
    quantity: toOptionalNumber(item.quantity),
    unit: item.unit !== undefined ? toYamlString(item.unit) : undefined,
    unitPrice: toOptionalNumber(item.unitPrice),
    items: item.items?.map(itemFromYaml),
  };
}

export function documentToYaml(doc: BillDocument): string {
  const yamlDoc: YamlDocument = {
    number: doc.number,
    date: doc.date,
    validUntil: doc.validUntil,
    dueDate: doc.dueDate,
    currency: doc.currency,
    vat: { enabled: doc.vatEnabled, rate: doc.vatRate },
    client: {
      name: doc.clientName,
      address: doc.clientAddress,
      zip: doc.clientZip,
      city: doc.clientCity,
    },
    intro: doc.introText || undefined,
    items: doc.items.map(itemToYaml),
    outro: doc.closingText || undefined,
  };
  return dump(yamlDoc, { lineWidth: 100 });
}

export function documentFromYaml(text: string): BillDocument {
  const parsed = load(text);
  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("YAML muss ein Objekt sein");
  }
  const yamlDoc = parsed as Partial<YamlDocument>;
  const items = (yamlDoc.items ?? []).map(itemFromYaml);

  return {
    id: crypto.randomUUID(),
    number: yamlDoc.number ? toYamlString(yamlDoc.number) : "",
    date: yamlDoc.date ? toYamlString(yamlDoc.date) : isoToday(),
    validUntil: yamlDoc.validUntil
      ? toYamlString(yamlDoc.validUntil)
      : isoDatePlusDays(30),
    dueDate: yamlDoc.dueDate ? toYamlString(yamlDoc.dueDate) : isoDatePlusDays(30),
    clientName: toYamlString(yamlDoc.client?.name),
    clientAddress: toYamlString(yamlDoc.client?.address),
    clientZip: toYamlString(yamlDoc.client?.zip),
    clientCity: toYamlString(yamlDoc.client?.city),
    introText: toYamlString(yamlDoc.intro),
    closingText: toYamlString(yamlDoc.outro),
    items: items.length > 0 ? items : [emptyItem()],
    vatEnabled: yamlDoc.vat?.enabled ?? false,
    vatRate: toOptionalNumber(yamlDoc.vat?.rate) ?? 8.1,
    currency: toYamlString(yamlDoc.currency) === "EUR" ? "EUR" : "CHF",
  };
}
