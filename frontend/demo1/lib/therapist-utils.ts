/**
 * Therapist name utilities
 * - Parse name/age from raw strings like "あやの(19)"
 * - Filter out placeholder names like "THERAPISTセラピスト"
 * - Clean names for display (remove trailing parenthetical age)
 */

const PLACEHOLDER_PATTERNS = [
  /^therapist$/i,
  /^test$/i,
  /^no\s*name$/i,
  /^名前未設定$/,
  /^テスト$/,
  /^---$/,
  // "プロフィール" / "profile" variants — all are page titles, not real names
  /プロフィール/,
  /^profile$/i,
  // "セラピスト" / "THERAPIST" as standalone or prefix
  /セラピスト/,
  /therapist/i,
  // Navigation / page element names scraped as names
  /キャスト(紹介|一覧)/,
  /在籍(表|一覧)/,
  /ランキング/,
  // Shop names stored as therapist names
  /^スタッフ\//,
  /金のエステ/,
  /神のエステ/,
  /小悪魔/,
  // Mojibake (garbled UTF-8)
  /^[ãâ].{5,}$/,
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

/**
 * Apply placeholder name exclusion filters to a Supabase query on the therapists table.
 * This filters at the SQL level so `.limit()` returns real therapists, not placeholders.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function excludePlaceholderNames(query: any): any {
  return query
    .not("name", "ilike", "%プロフィール%")
    .not("name", "ilike", "%profile%")
    .not("name", "ilike", "%THERAPIST%")
    .not("name", "ilike", "%セラピスト%")
    .not("name", "ilike", "%キャスト紹介%")
    .not("name", "ilike", "%在籍表%")
    .not("name", "ilike", "%staff%")
    .not("name", "ilike", "%スタッフ/%")
    .not("name", "ilike", "%ランキング%")
    .not("name", "ilike", "%金のエステ%")
    .not("name", "ilike", "%神のエステ%")
    .not("name", "ilike", "%小悪魔%")
    .not("name", "eq", "---");
}
