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
// paragraph, with every paragraph after the first flagged to start a fresh
// page (both for print's native break-before and the screen pagination).
export function renderTextBlocks(text: string, className: string): string {
  if (!text) return "";
  return text
    .split(/<pb\s*\/?>/i)
    .map((segment, index) => {
      const breakClass = index > 0 ? " page-break-before" : "";
      return `<p class="${className}${breakClass}">${multilineHtml(segment)}</p>`;
    })
    .join("");
}
