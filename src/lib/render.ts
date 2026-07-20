import { SwissQRBill } from "swissqrbill/svg";
import type { BillDocument, DocumentMode, LineItem, Settings } from "./types";
import { computeTotals, isPriced } from "./types";
import {
  compactIban,
  escapeHtml,
  formatDate,
  formatIban,
  formatMoney,
  formatQuantity,
  multilineHtml,
  renderTextBlocks,
} from "./format";

// Shared by renderSheet() (the first page's real header) and renderQrPage()
// (a second, independent copy for the QR-bill page, which — being a fixed
// single page rendered separately from .doc-body — doesn't go through
// paginateDocBody()'s clone-per-page logic; content pages 2+ get their
// header from cloning whichever one renderSheet() produced here).
function renderHeaderGrid(
  doc: BillDocument,
  settings: Settings,
  label: string,
): string {
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
    label === "Offerte"
      ? ["Gültig bis:", formatDate(doc.validUntil)]
      : ["Zahlbar bis:", formatDate(doc.dueDate)],
  ]
    .map(
      ([key, value]) =>
        `<tr><td>${key}</td><td>${escapeHtml(value!)}</td></tr>`,
    )
    .join("");

  return `
    <div class="header-grid">
      <div class="sender">${senderLines}</div>
      <table class="invoice-data"><tbody>${dataRows}</tbody></table>
    </div>`;
}

export function renderSheet(
  doc: BillDocument,
  settings: Settings,
  mode: DocumentMode,
): string {
  const totals = computeTotals(doc);
  const label = mode === "offerte" ? "Offerte" : "Rechnung";

  const clientLines = [
    doc.clientName,
    doc.clientAddress,
    `${doc.clientZip} ${doc.clientCity}`.trim(),
  ]
    .filter(Boolean)
    .map(escapeHtml)
    .join("<br>");

  const itemRows = renderItemRows(doc.items);

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
      ${renderHeaderGrid(doc, settings, label)}

      <div class="billed-to">
        ${label} an:<br>
        ${clientLines}
      </div>

      ${renderTextBlocks(doc.introText, "doc-text")}

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

      ${renderTextBlocks(doc.outroText, "doc-text")}

      ${paymentLines ? `<table class="payment"><tbody>${paymentLines}</tbody></table>` : ""}
      ${mode === "rechnung" ? `<p class="qr-note">Der QR-Zahlteil befindet sich auf der letzten Seite.</p>` : ""}

      <div class="closing">
        <div>***</div>
        ${doc.goodbyeText ? `<div>${multilineHtml(doc.goodbyeText)}</div>` : ""}
        <div>${escapeHtml(settings.name)}</div>
      </div>
    </div>
    ${mode === "rechnung" ? `<div class="doc-page-break"></div>${renderQrPage(doc, settings, totals.total)}` : ""}`;
}

function renderItemRows(items: LineItem[], depth = 0): string {
  return items
    .map((item, index) => {
      const pos = depth === 0 ? String(index + 1) : "";
      const indentStyle =
        depth > 0 ? ` style="padding-left: ${depth * 12}pt"` : "";
      const description = `${depth > 0 ? "– " : ""}${escapeHtml(item.description)}`;

      if (item.items && item.items.length > 0) {
        return `
          <tr class="item section">
            <td class="pos">${pos}</td>
            <td${indentStyle}>${description}</td>
            <td class="num"></td>
            <td class="num"></td>
            <td class="num"></td>
          </tr>
          ${renderItemRows(item.items, depth + 1)}`;
      }

      const priced = isPriced(item);
      const quantity = item.quantity ?? 1;
      const unit = item.unit ?? "";
      const amount = priced ? quantity * item.unitPrice! : undefined;

      return `
        <tr class="item">
          <td class="pos">${pos}</td>
          <td${indentStyle}>${description}</td>
          <td class="num">${priced ? formatMoney(item.unitPrice!) : ""}</td>
          <td class="num">${priced ? escapeHtml(`${formatQuantity(quantity)} ${unit}`.trim()) : ""}</td>
          <td class="num">${amount !== undefined ? formatMoney(amount) : ""}</td>
        </tr>`;
    })
    .join("");
}

function renderQrPage(doc: BillDocument, settings: Settings, total: number): string {
  return `
    <div class="qr-page">
      ${renderHeaderGrid(doc, settings, "Rechnung")}
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
