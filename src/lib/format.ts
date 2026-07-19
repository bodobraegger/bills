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
