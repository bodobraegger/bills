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
import exampleDocumentYaml from "./example-document.yaml?raw";

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
    const example = documentFromYaml(exampleDocumentYaml);
    documents.push(example.document);
    // On a real first visit there's no stored settings yet, so the example's
    // sender doubles as a filled-in preview of the "Absender & IBAN" fields;
    // a self-hosted deployment that already configures its own
    // PUBLIC_DEFAULT_* sender (see defaultSettings() in types.ts) keeps that
    // instead of being overwritten by the demo sender.
    if (example.sender && !settings.name) {
      settings = example.sender;
      saveSettings(settings);
    }
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

// Must match document.css: .doc-body's own padding.
const PAGE_MARGIN_TOP_MM = 19;
const PAGE_MARGIN_BOTTOM_MM = 10;

// Modeled on vue-smart-pages (github.com/Renovamen/oh-my-cv's pagination
// package): rather than cloning content into separate cropped page boxes
// (which this app tried first — every version had some way for the same
// content to end up visible twice, since the clip window and the JS break
// math were two different sources of truth that could disagree), insert a
// spacer element directly into the *same*, single, never-duplicated content
// flow at each break point. On screen the spacer's margin-top pushes
// whatever follows down by roughly a page height, just for a visual
// division; @media print ignores that margin entirely and instead gives the
// spacer break-before:page, print's own reliable native mechanism — so
// print's correctness never depends on the JS height math being precise.
//
// Break points land between .doc-body's top-level children (never inside
// one, so a paragraph or table is never cut mid-content) unless a child
// carries the page-break-before marker (from a manual <pb> in the source
// text — see renderTextBlocks in format.ts), which always forces a break.
function measureOuterHeight(el: Element): number {
  const style = getComputedStyle(el);
  return (
    el.getBoundingClientRect().height +
    (Number.parseFloat(style.marginTop) || 0) +
    (Number.parseFloat(style.marginBottom) || 0)
  );
}

function paginateDocBody(): void {
  const docBody = sheet.querySelector<HTMLElement>(".doc-body");
  if (!docBody) return;
  const headerGrid = docBody.querySelector<HTMLElement>(".header-grid");
  if (!headerGrid) return;

  const fullPageHeightPx = PAGE_HEIGHT_MM * MM_TO_PX;
  const paddingTopPx = PAGE_MARGIN_TOP_MM * MM_TO_PX;
  const paddingBottomPx = PAGE_MARGIN_BOTTOM_MM * MM_TO_PX;
  const baseContentBudgetPx = fullPageHeightPx - paddingTopPx - paddingBottomPx;

  // Measured once per run: the "continued" note reserves room on every
  // page's budget (it's only actually placed on pages that turn out not to
  // be last, but which page is last isn't known in advance — see the
  // .qr-page-transition margin comment below for the same trade-off), and
  // the repeated header reserves room on every page except the first,
  // which already has the real one.
  const continuedNote = document.createElement("p");
  continuedNote.className = "doc-continued-note";
  continuedNote.textContent = "(Fortsetzung auf der nächsten Seite)";
  docBody.append(continuedNote);
  const continuedNoteHeight = measureOuterHeight(continuedNote);
  continuedNote.remove();
  const headerCloneHeight = measureOuterHeight(headerGrid);

  const budgetForPage = (pageIndex: number) =>
    baseContentBudgetPx - continuedNoteHeight - (pageIndex > 0 ? headerCloneHeight : 0);

  let pageIndex = 0;
  // Starts at headerCloneHeight/1, not 0, on every page after the first:
  // paginateDocBody() inserts a repeated header at the top of each new page
  // (see below), which itself counts as this page's first "child" for
  // budget and redundant-break-detection purposes.
  let pageHeightSoFar = 0;
  let childrenOnCurrentPage = 0;
  let previousBreakWasForced = false;
  for (const child of [...docBody.children]) {
    if (child instanceof HTMLElement && child.classList.contains("doc-page-break")) {
      continue;
    }
    const childHeight = measureOuterHeight(child);
    const forceBreak =
      child instanceof HTMLElement && child.classList.contains("page-break-before");
    const budget = budgetForPage(pageIndex);
    const overflow: boolean = pageHeightSoFar + childHeight > budget;
    // A <pb> landing right after another break (this page has had exactly
    // one child so far) would strand that lone child alone on a near-empty
    // page — redundant with the break that just happened, unless that prior
    // break was also forced (consecutive <pb>s are a deliberate blank
    // page, so those should still stack).
    const redundantForce: boolean =
      forceBreak && childrenOnCurrentPage === 1 && !previousBreakWasForced;
    const effectiveForceBreak: boolean = forceBreak && !redundantForce;

    if (pageHeightSoFar > 0 && (effectiveForceBreak || overflow)) {
      const note = continuedNote.cloneNode(true) as HTMLElement;
      docBody.insertBefore(note, child);

      const spacer = document.createElement("div");
      spacer.className = "doc-page-break doc-page-break--forced";
      spacer.style.marginTop = `${fullPageHeightPx - pageHeightSoFar - continuedNoteHeight - paddingTopPx}px`;
      spacer.style.paddingBottom = `${paddingBottomPx}px`;
      docBody.insertBefore(spacer, child);

      const headerClone = headerGrid.cloneNode(true) as HTMLElement;
      docBody.insertBefore(headerClone, child);

      pageIndex++;
      pageHeightSoFar = headerCloneHeight;
      childrenOnCurrentPage = 1;
      previousBreakWasForced = effectiveForceBreak;
    }
    pageHeightSoFar += childHeight;
    childrenOnCurrentPage++;
  }

  // The plain (non --forced) divider rendered in render.ts right before
  // .qr-page, if this is a Rechnung: doc-body's last page is never actually
  // the last page of the document in that case, so it always gets a
  // "continued" note too, and the same "fill out the rest of the current
  // page" margin treatment an internal break gets, for a consistent look
  // between an ordinary content page break and the transition into the
  // QR-bill page. That margin is skipped only when doc-body fits on a
  // single page with no repeated header/note added at all — its own
  // min-height:297mm already pads it out to a full page, and adding this
  // too would double it.
  const qrDivider = docBody.nextElementSibling;
  if (qrDivider instanceof HTMLElement && qrDivider.classList.contains("doc-page-break")) {
    const singleUnpaddedPage = pageIndex === 0 && childrenOnCurrentPage === 1;
    if (singleUnpaddedPage) {
      qrDivider.style.marginTop = "0px";
    } else {
      const note = continuedNote.cloneNode(true) as HTMLElement;
      docBody.append(note);
      pageHeightSoFar += continuedNoteHeight;
      qrDivider.style.marginTop = `${fullPageHeightPx - pageHeightSoFar - paddingTopPx}px`;
    }
  }
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
