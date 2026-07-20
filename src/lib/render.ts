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
  const label = mode === "offerte" ? "Offerte" : "Rechnung";

  const senderLines = [
    settings.name,
    settings.address,
    `${settings.zip} ${settings.city}`,
    settings.email,
    settings.phone,
  ]
    .filter(Boolean)
    .map(escapeHtml)
    .join("<br>");

  const dataRows = [
    [`${label} Nr.:`, doc.number],
    ["Erstellt:", formatDate(doc.date)],
    mode === "offerte"
      ? ["Gültig bis:", formatDate(doc.validUntil)]
      : ["Zahlbar bis:", formatDate(doc.dueDate)],
  ]
    .map(
      ([key, value]) =>
        `<tr><td>${key}</td><td>${escapeHtml(value!)}</td></tr>`,
    )
    .join("");

  const clientLines = [
    doc.clientName,
    doc.clientAddress,
    `${doc.clientZip} ${doc.clientCity}`.trim(),
  ]
    .filter(Boolean)
    .map(escapeHtml)
    .join("<br>");

  const itemRows = doc.items
    .map(
      (item, index) => `
        <tr class="item">
          <td class="pos">${index + 1}</td>
          <td>${escapeHtml(item.description)}</td>
          <td class="num">${formatMoney(item.unitPrice)}</td>
          <td class="num">${escapeHtml(`${formatQuantity(item.quantity)} ${item.unit}`.trim())}</td>
          <td class="num">${formatMoney(item.quantity * item.unitPrice)}</td>
        </tr>`,
    )
    .join("");

  const doubleLine = `<tr class="double-line"><td colspan="5"><div></div></td></tr>`;
  const totalsRows = doc.vatEnabled
    ? `<tr class="hline-above">
         <td colspan="4" class="totals-label">Zwischensumme</td>
         <td class="num">${formatMoney(totals.subtotal)}</td>
       </tr>
       <tr>
         <td colspan="4" class="totals-label">MWST (${formatQuantity(doc.vatRate)}%)</td>
         <td class="num">${formatMoney(totals.vat)}</td>
       </tr>
       ${doubleLine}
       <tr>
         <td colspan="4" class="totals-label">Total</td>
         <td class="num">${formatMoney(totals.total)}</td>
       </tr>`
    : `${doubleLine}
       <tr>
         <td colspan="4" class="totals-label">Total</td>
         <td class="num">${formatMoney(totals.total)}</td>
       </tr>`;

  const paymentLines =
    mode === "rechnung"
      ? [
          ["Zahlung:", `IBAN ${formatIban(settings.iban)}`],
          settings.vatNumber ? ["MWST-Nr.:", settings.vatNumber] : null,
        ]
          .filter((line): line is [string, string] => line !== null)
          .map(
            ([key, value]) =>
              `<tr><td>${key}</td><td>${escapeHtml(value)}</td></tr>`,
          )
          .join("")
      : "";

  return `
    <div class="doc-body">
      <div class="header-grid">
        <div class="sender">${senderLines}</div>
        <table class="invoice-data"><tbody>${dataRows}</tbody></table>
      </div>

      <div class="billed-to">
        ${label} an:<br>
        ${clientLines}
      </div>

      ${doc.introText ? `<p class="doc-text">${multilineHtml(doc.introText)}</p>` : ""}

      <div class="order-title">${label} ${escapeHtml(doc.number)}</div>

      <table class="items">
        <thead>
          <tr>
            <th class="pos">#</th>
            <th>Beschreibung</th>
            <th class="num">Ansatz</th>
            <th class="num">Menge</th>
            <th class="num">Betrag (${doc.currency})</th>
          </tr>
        </thead>
        <tbody>
          ${itemRows}
          ${totalsRows}
        </tbody>
      </table>

      ${paymentLines ? `<table class="payment"><tbody>${paymentLines}</tbody></table>` : ""}
      ${mode === "rechnung" ? `<p class="qr-note">Der QR-Zahlteil befindet sich auf Seite 2.</p>` : ""}

      <div class="closing">
        <div>***</div>
        ${doc.closingText ? `<div>${multilineHtml(doc.closingText)}</div>` : ""}
        <div>${escapeHtml(settings.name)}</div>
      </div>
    </div>
    ${mode === "rechnung" ? renderQrPage(doc, settings, totals.total) : ""}`;
}

function renderQrPage(doc: BillDocument, settings: Settings, total: number): string {
  return `
    <div class="qr-page">
      <div class="qr-page-label">${escapeHtml(`Rechnung ${doc.number}`)} · Zahlteil</div>
      ${renderQrPart(doc, settings, total)}
    </div>`;
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
