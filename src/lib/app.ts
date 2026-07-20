import type { BillDocument, DocumentMode, LineItem, Settings } from "./types";
import { cloneDocument, createDocument, emptyItem, suggestNumber } from "./types";
import {
  loadCurrentId,
  loadDocuments,
  loadSettings,
  saveCurrentId,
  saveDocuments,
  saveSettings,
} from "./storage";
import { renderSheet } from "./render";

let settings: Settings = loadSettings();
let documents: BillDocument[] = loadDocuments();
let current: BillDocument;
let previewMode: DocumentMode = "rechnung";

const sheet = query<HTMLDivElement>("#sheet");
const documentSelect = query<HTMLSelectElement>("#document-select");
const itemsBody = query<HTMLTableSectionElement>("#items-body");

init();

function init(): void {
  if (documents.length === 0) {
    documents.push(createDocument(suggestNumber(documents)));
  }
  current =
    documents.find((doc) => doc.id === loadCurrentId()) ?? documents[0]!;

  bindSettingsInputs();
  bindDocumentInputs();
  bindToolbar();
  refreshEditor();
  renderPreview();
}

function persist(): void {
  saveDocuments(documents);
  saveCurrentId(current.id);
  refreshDocumentSelect();
}

function renderPreview(): void {
  sheet.innerHTML = renderSheet(current, settings, previewMode);
  sheet.className = `sheet ${previewMode}`;
}

function bindSettingsInputs(): void {
  for (const input of queryAll<HTMLInputElement>("[data-setting]")) {
    const key = input.dataset.setting as keyof Settings;
    input.value = settings[key];
    input.addEventListener("input", () => {
      settings[key] = input.value;
      saveSettings(settings);
      renderPreview();
    });
  }
}

function bindDocumentInputs(): void {
  for (const input of queryAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
    "[data-doc]",
  )) {
    input.addEventListener("input", () => {
      const key = input.dataset.doc as keyof BillDocument;
      if (input instanceof HTMLInputElement && input.type === "checkbox") {
        (current[key] as boolean) = input.checked;
      } else if (input instanceof HTMLInputElement && input.type === "number") {
        (current[key] as number) = input.valueAsNumber || 0;
      } else {
        (current[key] as string) = input.value;
      }
      persist();
      renderPreview();
    });
  }
}

function refreshDocumentFields(): void {
  for (const input of queryAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
    "[data-doc]",
  )) {
    const key = input.dataset.doc as keyof BillDocument;
    if (input instanceof HTMLInputElement && input.type === "checkbox") {
      input.checked = current[key] as boolean;
    } else {
      input.value = String(current[key]);
    }
  }
}

function refreshEditor(): void {
  refreshDocumentFields();
  refreshItemRows();
  refreshDocumentSelect();
}

function refreshDocumentSelect(): void {
  documentSelect.innerHTML = "";
  for (const doc of documents) {
    const option = document.createElement("option");
    option.value = doc.id;
    option.textContent = doc.clientName
      ? `${doc.number} · ${doc.clientName}`
      : doc.number;
    option.selected = doc.id === current.id;
    documentSelect.append(option);
  }
}

function refreshItemRows(): void {
  itemsBody.innerHTML = "";
  current.items.forEach((item, index) => {
    itemsBody.append(buildItemRow(item, index));
  });
}

function buildItemRow(item: LineItem, index: number): HTMLTableRowElement {
  const row = document.createElement("tr");
  const hasChildren = Boolean(item.items && item.items.length > 0);

  row.append(
    itemCell(item.description, "text", "Beschreibung", (value) => {
      item.description = value;
    }),
  );

  if (hasChildren) {
    const summary = document.createElement("td");
    summary.colSpan = 3;
    summary.className = "item-summary";
    summary.textContent = `${item.items!.length} verschachtelte Positionen (nur per YAML bearbeitbar)`;
    row.append(summary);
  } else {
    row.append(
      itemCell(String(item.quantity ?? ""), "number", "", (value) => {
        item.quantity = Number.parseFloat(value) || 0;
      }),
      itemCell(item.unit ?? "", "text", "h", (value) => {
        item.unit = value;
      }),
      itemCell(String(item.unitPrice ?? ""), "number", "0.00", (value) => {
        item.unitPrice = Number.parseFloat(value) || 0;
      }),
    );
  }

  const removeCell = document.createElement("td");
  const removeButton = document.createElement("button");
  removeButton.type = "button";
  removeButton.className = "remove-item";
  removeButton.textContent = "×";
  removeButton.title = "Position entfernen";
  removeButton.addEventListener("click", () => {
    current.items.splice(index, 1);
    if (current.items.length === 0) current.items.push(emptyItem());
    persist();
    refreshItemRows();
    renderPreview();
  });
  removeCell.append(removeButton);
  row.append(removeCell);

  return row;
}

function itemCell(
  value: string,
  type: string,
  placeholder: string,
  apply: (value: string) => void,
): HTMLTableCellElement {
  const cell = document.createElement("td");
  const input = document.createElement("input");
  input.type = type;
  input.value = value;
  input.placeholder = placeholder;
  if (type === "number") {
    input.step = "0.05";
    input.min = "0";
  }
  input.addEventListener("input", () => {
    apply(input.value);
    persist();
    renderPreview();
  });
  cell.append(input);
  return cell;
}

function bindToolbar(): void {
  query<HTMLButtonElement>("#add-item").addEventListener("click", () => {
    current.items.push(emptyItem());
    persist();
    refreshItemRows();
    renderPreview();
  });

  query<HTMLButtonElement>("#new-document").addEventListener("click", () => {
    const doc = cloneDocument(current, suggestNumber(documents));
    documents.push(doc);
    current = doc;
    persist();
    refreshEditor();
    renderPreview();
  });

  query<HTMLButtonElement>("#delete-document").addEventListener("click", () => {
    if (!confirm(`Dokument ${current.number} löschen?`)) return;
    documents = documents.filter((doc) => doc.id !== current.id);
    if (documents.length === 0) {
      documents.push(createDocument(suggestNumber(documents)));
    }
    current = documents[documents.length - 1]!;
    persist();
    refreshEditor();
    renderPreview();
  });

  documentSelect.addEventListener("change", () => {
    const selected = documents.find((doc) => doc.id === documentSelect.value);
    if (!selected) return;
    current = selected;
    saveCurrentId(current.id);
    refreshEditor();
    renderPreview();
  });

  for (const button of queryAll<HTMLButtonElement>("[data-mode]")) {
    button.addEventListener("click", () => {
      previewMode = button.dataset.mode as DocumentMode;
      updateModeButtons();
      renderPreview();
    });
  }
  updateModeButtons();

  for (const button of queryAll<HTMLButtonElement>("[data-print]")) {
    button.addEventListener("click", () => {
      printAs(button.dataset.print as DocumentMode);
    });
  }
}

function updateModeButtons(): void {
  for (const button of queryAll<HTMLButtonElement>("[data-mode]")) {
    button.classList.toggle("active", button.dataset.mode === previewMode);
  }
}

function printAs(mode: DocumentMode): void {
  const previousMode = previewMode;
  const previousTitle = document.title;

  previewMode = mode;
  updateModeButtons();
  renderPreview();

  const label = mode === "offerte" ? "Offerte" : "Rechnung";
  const client = current.clientName.replace(/\s+/g, "-");
  document.title = [label, current.number, client].filter(Boolean).join("_");

  window.addEventListener(
    "afterprint",
    () => {
      document.title = previousTitle;
      previewMode = previousMode;
      updateModeButtons();
      renderPreview();
    },
    { once: true },
  );

  requestAnimationFrame(() => window.print());
}

function query<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Element not found: ${selector}`);
  return element;
}

function queryAll<T extends Element>(selector: string): T[] {
  return [...document.querySelectorAll<T>(selector)];
}
