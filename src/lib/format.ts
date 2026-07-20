export function formatMoney(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  const [integer, fraction] = Math.abs(rounded).toFixed(2).split(".");
  const grouped = integer!.replace(/\B(?=(\d{3})+(?!\d))/g, "'");
  return `${rounded < 0 ? "-" : ""}${grouped}.${fraction}`;
}

export function formatQuantity(value: number): string {
  return String(Math.round(value * 100) / 100);
}

export function formatDate(iso: string): string {
  const [year, month, day] = iso.split("-");
  if (!year || !month || !day) return iso;
  return `${day}.${month}.${year}`;
}

export function formatIban(iban: string): string {
  const compact = iban.replace(/\s/g, "").toUpperCase();
  return compact.replace(/(.{4})/g, "$1 ").trim();
}

export function compactIban(iban: string): string {
  return iban.replace(/\s/g, "").toUpperCase();
}

export function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function multilineHtml(text: string): string {
  return escapeHtml(text).replaceAll("\n", "<br>");
}

// Splits on a literal <pb> (or <pb/>) marker so authors can force a manual
// page break inside intro/outro text; each segment becomes its own
// paragraph, with the paragraph after each marker flagged to start a fresh
// page (both for print's native break-before and the screen pagination).
// Empty segments (a leading <pb> to push the whole block to a new page, a
// trailing one, or accidental doubles) are dropped rather than rendered as
// blank paragraphs, but still carry their break forward to the next segment
// that actually has content.
export function renderTextBlocks(text: string, className: string): string {
  if (!text) return "";
  const segments = text.split(/<pb\s*\/?>/i);
  const paragraphs: string[] = [];
  let pendingBreak = false;
  segments.forEach((segment, index) => {
    if (index > 0) pendingBreak = true;
    if (segment.trim() === "") return;
    const breakClass = pendingBreak ? " page-break-before" : "";
    paragraphs.push(`<p class="${className}${breakClass}">${multilineHtml(segment)}</p>`);
    pendingBreak = false;
  });
  return paragraphs.join("");
}
