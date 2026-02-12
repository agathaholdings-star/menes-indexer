/**
 * Therapist name utilities
 * - Parse name/age from raw strings like "あやの(19)"
 * - Filter out placeholder names like "THERAPISTセラピスト"
 * - Clean names for display (remove trailing parenthetical age)
 */

const PLACEHOLDER_PATTERNS = [
  /^THERAPISTセラピスト$/i,
  /^therapist$/i,
  /^セラピスト$/,
  /^テスト$/,
  /^test$/i,
  /^no\s*name$/i,
  /^名前未設定$/,
  /^---$/,
];

/** Check if name is a placeholder that should be excluded from display */
export function isPlaceholderName(name: string): boolean {
  const trimmed = name.trim();
  if (!trimmed) return true;
  return PLACEHOLDER_PATTERNS.some((p) => p.test(trimmed));
}

/** Parse "あやの(19)" → { name: "あやの", age: 19 }. Falls back to dbAge. */
export function parseNameAge(
  raw: string,
  dbAge: number | null
): { name: string; age: number } {
  const match = raw.match(/^(.+?)\((\d{2})\)$/);
  if (match) {
    return { name: match[1], age: dbAge || Number(match[2]) };
  }
  return { name: raw, age: dbAge || 0 };
}

/** Remove trailing parenthetical (age) from name for display */
export function cleanTherapistName(raw: string): string {
  return raw.replace(/\s*\(\d{2}\)$/, "").trim();
}
