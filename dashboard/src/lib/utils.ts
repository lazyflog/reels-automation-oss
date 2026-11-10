export function formatDateTime(dateStr: string): string {
  // The backend returns naive UTC timestamps — append Z so they are parsed as UTC,
  // then render in the viewer's own locale and timezone.
  const utc = dateStr.endsWith("Z") || /[+-]\d{2}:?\d{2}$/.test(dateStr)
    ? dateStr
    : dateStr + "Z";
  return new Date(utc).toLocaleString();
}
