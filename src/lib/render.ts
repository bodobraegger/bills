import { SwissQRBill } from "swissqrbill/svg";
import type { BillDocument, DocumentMode, Settings } from "./types";
import { computeTotals } from "./types";
import {
  compactIban,
  escapeHtml,
  formatDate,
  formatIban,
  formatMoney,
  formatQuantity,
  multilineHtml,
} from "./format";

export function renderSheet(
  doc: BillDocument,
  settings: Settings,
  mode: DocumentMode,
): string {
  const totals = computeTotals(doc);
  const title = mode === "offerte" ? "OFFERTE" : "RECHNUNG";
  const clientLabel = mode === "offerte" ? "OFFERTE AN" : "RECHNUNG AN";

  const metaCells = [
    metaCell("DATUM", formatDate(doc.date)),
    mode === "offerte"
      ? metaCell("GÜLTIG BIS", formatDate(doc.validUntil))
      : metaCell("ZAHLBAR BIS", formatDate(doc.dueDate)),
    metaCell("WÄHRUNG", doc.currency),
  ];
  if (settings.vatNumber) {
    metaCells.push(metaCell("MWST-NR.", settings.vatNumber));
  }

  const itemRows = doc.items
    .map(
      (item, index) => `
        <tr>
          <td class="num">${String(index + 1).padStart(2, "0")}</td>
          <td>${escapeHtml(item.description)}</td>
          <td class="num">${formatQuantity(item.quantity)}</td>
          <td>${escapeHtml(item.unit)}</td>
          <td class="num">${formatMoney(item.unitPrice)}</td>
          <td class="num">${formatMoney(item.quantity * item.unitPrice)}</td>
        </tr>`,
    )
    .join("");

  const vatRow = doc.vatEnabled
    ? `<tr>
         <td class="label">MWST ${formatQuantity(doc.vatRate)}%</td>
         <td class="num">${formatMoney(totals.vat)}</td>
       </tr>`
    : "";
  const subtotalRow = doc.vatEnabled
    ? `<tr>
         <td class="label">ZWISCHENSUMME</td>
         <td class="num">${formatMoney(totals.subtotal)}</td>
       </tr>`
    : "";

  const contactParts = [settings.email, settings.phone]
    .filter(Boolean)
    .map(escapeHtml);

  return `
    <div class="doc-body">
      <header class="doc-header">
        <div class="sender-name">${escapeHtml(settings.name)}</div>
        <div class="sender-address">
          ${escapeHtml(settings.address)}<br>
          ${escapeHtml(`${settings.zip} ${settings.city}`)}
          ${contactParts.length > 0 ? `<br>${contactParts.join("<br>")}` : ""}
        </div>
      </header>

      <div class="doc-title-row">
        <h1>${title}</h1>
        <span class="doc-number">NR. ${escapeHtml(doc.number)}</span>
      </div>

      <table class="meta"><tr>${metaCells.join("")}</tr></table>

      <div class="client-block">
        <div class="block-label">${clientLabel}</div>
        <div class="client-address">
          ${escapeHtml(doc.clientName)}<br>
          ${multilineHtml(doc.clientAddress)}<br>
          ${escapeHtml(`${doc.clientZip} ${doc.clientCity}`.trim())}
        </div>
      </div>

      ${doc.introText ? `<p class="doc-text">${multilineHtml(doc.introText)}</p>` : ""}

      <table class="items">
        <thead>
          <tr>
            <th class="num">POS.</th>
            <th>BESCHREIBUNG</th>
            <th class="num">MENGE</th>
            <th>EINHEIT</th>
            <th class="num">ANSATZ</th>
            <th class="num">BETRAG</th>
          </tr>
        </thead>
        <tbody>${itemRows}</tbody>
      </table>

      <table class="totals">
        ${subtotalRow}
        ${vatRow}
        <tr class="grand-total">
          <td class="label">TOTAL ${doc.currency}${doc.vatEnabled ? "" : " (exkl. MWST)"}</td>
          <td class="num">${formatMoney(totals.total)}</td>
        </tr>
      </table>

      ${doc.closingText ? `<p class="doc-text">${multilineHtml(doc.closingText)}</p>` : ""}

      <footer class="doc-footer">
        <span>IBAN ${escapeHtml(formatIban(settings.iban))}</span>
        <span>${escapeHtml(`${settings.name}, ${settings.address}, ${settings.zip} ${settings.city}`)}</span>
      </footer>
    </div>
    ${mode === "rechnung" ? renderQrPart(doc, settings, totals.total) : ""}`;
}

function metaCell(label: string, value: string): string {
  return `<td><div class="cell-label">${label}</div><div class="cell-value">${escapeHtml(value)}</div></td>`;
}

function renderQrPart(
  doc: BillDocument,
  settings: Settings,
  total: number,
): string {
  try {
    const bill = new SwissQRBill(
      {
        currency: doc.currency,
        amount: total > 0 ? Math.round(total * 100) / 100 : undefined,
        message: `Rechnung ${doc.number}`,
        creditor: {
          account: compactIban(settings.iban),
          name: settings.name,
          address: settings.address,
          zip: settings.zip,
          city: settings.city,
          country: settings.country || "CH",
        },
        debtor:
          doc.clientName && doc.clientAddress && doc.clientZip && doc.clientCity
            ? {
                name: doc.clientName,
                address: doc.clientAddress,
                zip: doc.clientZip,
                city: doc.clientCity,
                country: "CH",
              }
            : undefined,
      },
      { language: "DE" },
    );
    return `<div class="qr-part">${bill.toString()}</div>`;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return `<div class="qr-part qr-error">QR-Rechnung konnte nicht erstellt werden: ${escapeHtml(message)}</div>`;
  }
}
