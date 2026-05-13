/**
 * In-memory FTS-like word matching.
 * Returns true if every token in `keyword` appears as a word (or simple plural variant)
 * in `dealItemName`. Mirrors Postgres plainto_tsquery('english', ...) behavior.
 */
export function ftsLikeMatch(keyword: string, dealItemName: string): boolean {
  const kwTokens = keyword.toLowerCase().split(/\W+/).filter(Boolean);
  if (kwTokens.length === 0) return false;
  const dealTokens = new Set(dealItemName.toLowerCase().split(/\W+/).filter(Boolean));
  return kwTokens.every(kwt =>
    dealTokens.has(kwt) ||
    dealTokens.has(kwt + 's') ||
    dealTokens.has(kwt + 'es') ||
    (kwt.endsWith('s') && dealTokens.has(kwt.slice(0, -1))) ||
    (kwt.endsWith('es') && dealTokens.has(kwt.slice(0, -2))),
  );
}
