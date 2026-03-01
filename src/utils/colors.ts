export function normalizeHexColor(input: string | null | undefined): string | null {
  if (!input) return null;

  const trimmed = input.trim();
  if (trimmed.length === 0) return null;

  const shortMatch = /^#([0-9a-fA-F]{3})$/.exec(trimmed);
  if (shortMatch) {
    const [r, g, b] = shortMatch[1].split('');
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }

  const fullMatch = /^#([0-9a-fA-F]{6})$/.exec(trimmed);
  if (fullMatch) {
    return `#${fullMatch[1]}`.toUpperCase();
  }

  return null;
}
