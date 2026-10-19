/** Kirill harflarini lotinga o'tkazish (sarlavha kirillda yozilsa ham manzil yasalsin) */
const CYRILLIC: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", ғ: "g", д: "d", е: "e", ё: "yo", ж: "j", з: "z", и: "i", й: "y",
  к: "k", қ: "q", л: "l", м: "m", н: "n", о: "o", ў: "o", п: "p", р: "r", с: "s", т: "t", у: "u",
  ф: "f", х: "x", ҳ: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sh", ъ: "", ы: "i", ь: "", э: "e", ю: "yu",
  я: "ya",
};

/**
 * Sarlavhadan sahifa manzili (slug) yasaydi: "Full Mock Test 11" → "full-mock-test-11".
 * Admin slug maydonini bo'sh qoldirsa, server shu bilan o'zi to'ldiradi.
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[Ѐ-ӿ]/g, (ch) => CYRILLIC[ch] ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[ʻʼ'‘’`]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
}
