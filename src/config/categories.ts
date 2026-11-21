/**
 * Canonical category vocabulary shared by every source (Telegram captions,
 * hand-entered Firestore docs, TMDB enrichment). Pills list these first, in this
 * order, followed by any other categories present in the data.
 */
export const CATEGORY_ORDER = [
  "Action",
  "Comedy",
  "Drama",
  "Romance",
  "Animation",
  "Sci-Fi",
  "Fantasy",
  "Thriller",
  "Horror",
  "Adventure",
  "Crime",
  "Mystery",
  "Documentary",
  "Family",
] as const;

const ALIASES: Record<string, string> = {
  "science fiction": "Sci-Fi",
  "sci fi": "Sci-Fi",
  scifi: "Sci-Fi",
  sf: "Sci-Fi",
  "rom-com": "Romance",
  romcom: "Romance",
  anime: "Animation",
  animated: "Animation",
  cartoon: "Animation",
  docs: "Documentary",
  documentaries: "Documentary",
  suspense: "Thriller",
};

const CANONICAL = new Map(CATEGORY_ORDER.map((name) => [name.toLowerCase(), name]));

/** Maps any spelling/alias to its canonical name; unknown names are title-cased. */
export function normalizeCategory(name: string): string {
  const key = name.trim().toLowerCase().replace(/\s+/g, " ");
  if (!key) return name;
  const alias = ALIASES[key] ?? CANONICAL.get(key);
  if (alias) return alias;
  return key.replace(/(^|[\s-])\p{L}/gu, (char) => char.toUpperCase());
}

/**
 * Splits a category field that lists several ("Comedy, Adventure",
 * "Comedy / Adventure", "Action & Adventure") into canonical names,
 * de-duplicated, first one first.
 */
export function splitCategories(text: string): string[] {
  const names = text
    .split(/\s*[,/&]\s*/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map(normalizeCategory);
  return [...new Set(names)];
}

const rank = (name: string) => {
  const index = (CATEGORY_ORDER as readonly string[]).indexOf(name);
  return index === -1 ? CATEGORY_ORDER.length : index;
};

/** Canonical categories first (configured order), then the rest as given. */
export const orderCategories = (names: readonly string[]) =>
  [...names].sort((a, b) => rank(a) - rank(b));
