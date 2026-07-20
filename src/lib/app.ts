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
import { documentFromYaml, documentToYaml } from "./yaml";

let settings: Settings = loadSettings();
let documents: BillDocument[] = loadDocuments();
let current: BillDocument;
let previewMode: DocumentMode = "rechnung";

const sheet = query<HTMLDivElement>("#sheet");
const documentSelect = query<HTMLSelectElement>("#document-select");
const itemsBody = query<HTMLTableSectionElement>("#items-body");

const MM_TO_PX = 96 / 25.4;
const PAGE_HEIGHT_MM = 297;

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
  bindYamlButtons();
  refreshEditor();
  renderPreview();
  // Custom fonts use font-display:block, so the very first pagination
  // measurement can run against fallback-font metrics; re-measure once the
  // real fonts are in so the page count/split points are accurate.
  document.fonts.ready.then(() => renderPreview());
}

function persist(): void {
  saveDocuments(documents);
  saveCurrentId(current.id);
  refreshDocumentSelect();
}

function renderPreview(): void {
  sheet.innerHTML = renderSheet(current, settings, previewMode);
  sheet.className = `sheet ${previewMode}`;
  // Pagination is a screen-only cosmetic enhancement; it must never be able
  // to break the rest of the app (in particular printAs(), which calls
  // renderPreview() synchronously before window.print() — an uncaught
  // exception here would silently abort that call chain and the print
  // dialog would never open).
  try {
    paginateDocBody();
  } catch (error) {
    console.error("paginateDocBody failed:", error);
  }
}

// Must match document.css: .doc-body's own padding, and .doc-page-slot's.
const PAGE_MARGIN_TOP_MM = 19;
const PAGE_MARGIN_BOTTOM_MM = 10;

// The browser's native print pagination already splits an overflowing
// .doc-body across multiple physical pages correctly (with real top/bottom
// margins on every page, via box-decoration-break:clone in document.css),
// but on screen it just renders as one tall box. This mirrors that: clip
// .doc-body's pure content (no padding baked in) into one .doc-page-slot per
// A4 page, each supplying its own fresh top/bottom padding, clipping a
// (PAGE_HEIGHT_MM - PAGE_MARGIN_TOP_MM - PAGE_MARGIN_BOTTOM_MM)-tall window
// via a shifted .doc-page-inner. @media print resets the clipping so print
// keeps using the single flow it already fragments correctly on its own.
//
// Break points land between .doc-body's top-level children (never inside
// one, so a paragraph or table is never cut mid-content) unless a child
// carries the page-break-before marker (from a manual <pb> in the source
// text — see renderTextBlocks in format.ts), which always forces a break.
function paginateDocBody(): void {
  const docBody = sheet.querySelector<HTMLElement>(".doc-body");
  if (!docBody) return;

  const fullPageHeightPx = PAGE_HEIGHT_MM * MM_TO_PX;
  const docBodyTop = docBody.getBoundingClientRect().top;
  const totalHeight = docBody.getBoundingClientRect().height;
  if (totalHeight <= fullPageHeightPx) return;

  const paddingTopPx = PAGE_MARGIN_TOP_MM * MM_TO_PX;
  const pageContentBudgetPx =
    (PAGE_HEIGHT_MM - PAGE_MARGIN_TOP_MM - PAGE_MARGIN_BOTTOM_MM) * MM_TO_PX;

  const children = [...docBody.children] as HTMLElement[];
  // .doc-body's own top padding is baked into these measurements (children
  // are pushed down by it); strip it out so offsets are relative to the
  // pure content flow, since each slot supplies its own fresh padding
  // instead of relying on it appearing once at the top of the whole thing.
  const childBottoms = children.map(
    (child) => child.getBoundingClientRect().bottom - docBodyTop - paddingTopPx,
  );

  const pageStartOffsets = [0];
  let currentPageStart = 0;
  let lastChildBottom = 0;
  for (let i = 0; i < children.length; i++) {
    const bottom = childBottoms[i]!;
    const forceBreak = children[i]!.classList.contains("page-break-before");
    if (
      lastChildBottom > currentPageStart &&
      (forceBreak || bottom - currentPageStart > pageContentBudgetPx)
    ) {
      currentPageStart = lastChildBottom;
      pageStartOffsets.push(currentPageStart);
    }
    // A single child (e.g. one long paragraph) can still be taller than a
    // whole page's budget even starting fresh on its own page; fall back to
    // forced breaks within it rather than letting it silently overflow past
    // the slot's overflow:hidden clip.
    while (bottom - currentPageStart > pageContentBudgetPx) {
      currentPageStart += pageContentBudgetPx;
      pageStartOffsets.push(currentPageStart);
    }
    lastChildBottom = bottom;
  }
  if (pageStartOffsets.length <= 1) return;

  const innerHtml = docBody.innerHTML;
  const fragment = document.createDocumentFragment();
  for (const startOffsetPx of pageStartOffsets) {
    const slot = document.createElement("div");
    slot.className = "doc-page-slot";
    const inner = document.createElement("div");
    inner.className = "doc-page-inner";
    inner.style.marginTop = `${-startOffsetPx}px`;
    inner.innerHTML = innerHtml;
    slot.append(inner);
    fragment.append(slot);
  }
  docBody.replaceWith(fragment);
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

function refreshSettingsFields(): void {
  for (const input of queryAll<HTMLInputElement>("[data-setting]")) {
    const key = input.dataset.setting as keyof Settings;
    input.value = settings[key];
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

function bindYamlButtons(): void {
  query<HTMLButtonElement>("#export-yaml").addEventListener("click", () => {
    const blob = new Blob([documentToYaml(current, settings)], { type: "text/yaml" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const label = previewMode === "offerte" ? "Offerte" : "Rechnung";
    link.download = `${current.number || "dokument"}-${label}.yaml`;
    link.click();
    URL.revokeObjectURL(url);
  });

  const fileInput = query<HTMLInputElement>("#import-yaml-input");
  query<HTMLButtonElement>("#import-yaml").addEventListener("click", () => {
    fileInput.click();
  });

  fileInput.addEventListener("change", () => {
    const file = fileInput.files?.[0];
    fileInput.value = "";
    if (!file) return;
    file
      .text()
      .then((text) => {
        const { document: doc, sender } = documentFromYaml(text);
        if (!doc.number) doc.number = suggestNumber(documents);
        documents.push(doc);
        current = doc;
        if (sender) {
          settings = sender;
          saveSettings(settings);
          refreshSettingsFields();
        }
        persist();
        refreshEditor();
        renderPreview();
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        alert(`YAML konnte nicht importiert werden: ${message}`);
      });
  });
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
  document.title = [current.number, label].filter(Boolean).join("-");

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
