export function formatDisplaySlug(raw: string | undefined): string {
  if (typeof raw !== "string" || raw === "") {
    return "";
  }

  const withSpaces = raw.replace(/_/g, " ");
  return withSpaces.charAt(0).toUpperCase() + withSpaces.slice(1);
}
