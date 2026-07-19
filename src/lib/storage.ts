import type { BillDocument, Settings } from "./types";
import { defaultSettings } from "./types";

const SETTINGS_KEY = "bills.settings";
const DOCUMENTS_KEY = "bills.documents";
const CURRENT_ID_KEY = "bills.currentDocumentId";

export function loadSettings(): Settings {
  const stored = readJson<Partial<Settings>>(SETTINGS_KEY);
  return { ...defaultSettings(), ...stored };
}

export function saveSettings(settings: Settings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export function loadDocuments(): BillDocument[] {
  return readJson<BillDocument[]>(DOCUMENTS_KEY) ?? [];
}

export function saveDocuments(documents: BillDocument[]): void {
  localStorage.setItem(DOCUMENTS_KEY, JSON.stringify(documents));
}

export function loadCurrentId(): string | null {
  return localStorage.getItem(CURRENT_ID_KEY);
}

export function saveCurrentId(id: string): void {
  localStorage.setItem(CURRENT_ID_KEY, id);
}

function readJson<T>(key: string): T | null {
  const raw = localStorage.getItem(key);
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}
