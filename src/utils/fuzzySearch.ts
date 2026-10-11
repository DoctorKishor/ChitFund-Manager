/**
 * Advanced Fuzzy & Phonetic Matching Engine for Chit Fund Subscribers
 * Handles South Indian transliteration variations (e.g. Savithiri vs Savithri/Savitri,
 * Anbazhakan vs Anbazhagan, Jagadees vs Jagadish, Krithic vs Krithik),
 * typos, missing/extra vowels, consonant skeletons, and Levenshtein distances.
 */

export function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,      // deletion
        dp[i][j - 1] + 1,      // insertion
        dp[i - 1][j - 1] + cost // substitution
      );
    }
  }
  return dp[m][n];
}

/**
 * Phonetic normalization tailored for Indian / Tamil English transliterations
 */
export function normalizePhonetic(str: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .replace(/ee/g, 'i')
    .replace(/oo/g, 'u')
    .replace(/th/g, 't')
    .replace(/sh/g, 's')
    .replace(/zh/g, 'l')
    .replace(/w/g, 'v')
    .replace(/k/g, 'g')
    .replace(/ch/g, 'c')
    .replace(/dh/g, 'd')
    .replace(/bh/g, 'b')
    .replace(/kh/g, 'g')
    .replace(/(.)\1+/g, '$1'); // collapse double consonants (e.g. tt -> t, mm -> m)
}

/**
 * Consonant skeleton: preserves the first character, then drops all internal vowels.
 * E.g. 'savithiri' -> 'svtr', 'savithr' -> 'svtr' (100% skeleton match!)
 */
export function consonantSkeleton(str: string): string {
  const norm = normalizePhonetic(str);
  if (!norm) return '';
  const first = norm[0];
  const rest = norm.slice(1).replace(/[aeiou]/g, '');
  return (first + rest).replace(/(.)\1+/g, '$1');
}

/**
 * Compute similarity score between a search query and target string (0.0 to 1.0)
 */
export function computeFuzzyScore(query: string, target: string): number {
  const q = query.trim().toLowerCase();
  const t = target.trim().toLowerCase();
  if (!q || !t) return 0;

  // 1. Exact match
  if (t === q) return 1.0;
  // 2. Starts with query
  if (t.startsWith(q)) return 0.96;
  // 3. Substring match
  if (t.includes(q)) return 0.91;

  // 4. Word-level substring & prefix match
  const targetWords = t.split(/[\s,.-]+/);
  for (const w of targetWords) {
    if (w === q) return 0.95;
    if (w.startsWith(q)) return 0.93;
    if (w.includes(q)) return 0.88;
  }

  // 5. Phonetic normalized comparison
  const qNorm = normalizePhonetic(q);
  const tNorm = normalizePhonetic(t);
  if (qNorm && tNorm) {
    if (tNorm === qNorm) return 0.92;
    if (tNorm.startsWith(qNorm)) return 0.89;
    if (tNorm.includes(qNorm)) return 0.86;

    for (const w of targetWords) {
      const wNorm = normalizePhonetic(w);
      if (wNorm === qNorm) return 0.91;
      if (wNorm.startsWith(qNorm)) return 0.88;
      if (wNorm.includes(qNorm)) return 0.85;
    }
  }

  // 6. Consonant skeleton comparison (Immune to inserted/omitted vowels)
  const qSkel = consonantSkeleton(q);
  const tSkel = consonantSkeleton(t);
  if (qSkel && tSkel && qSkel.length >= 2) {
    if (tSkel === qSkel) return 0.85;
    if (tSkel.startsWith(qSkel)) return 0.83;
    if (tSkel.includes(qSkel)) return 0.80;

    for (const w of targetWords) {
      const wSkel = consonantSkeleton(w);
      if (wSkel === qSkel) return 0.84;
      if (wSkel.startsWith(qSkel)) return 0.82;
      if (wSkel.includes(qSkel)) return 0.79;
    }
  }

  // 7. Levenshtein edit distance & prefix tolerance
  let maxLevSim = 0;
  for (const w of targetWords) {
    if (!w) continue;
    const dist = levenshteinDistance(q, w);
    const maxLen = Math.max(q.length, w.length);
    const sim = 1 - dist / maxLen;
    if (sim > maxLevSim) maxLevSim = sim;

    // Prefix levenshtein (when query matches the beginning of a longer word with small typo)
    if (w.length > q.length) {
      const prefix = w.slice(0, q.length);
      const pDist = levenshteinDistance(q, prefix);
      const pSim = (1 - pDist / q.length) * 0.9;
      if (pSim > maxLevSim) maxLevSim = pSim;
    }
  }

  // Also check whole string levenshtein
  const wholeDist = levenshteinDistance(q, t);
  const wholeSim = 1 - wholeDist / Math.max(q.length, t.length);
  if (wholeSim > maxLevSim) maxLevSim = wholeSim;

  return Math.max(maxLevSim, 0);
}

export interface FuzzyMatchItem<T> {
  item: T;
  score: number;
  isExact: boolean;
  isFuzzy: boolean;
  matchedField: 'name' | 'phone' | 'alias' | 'ticket';
  matchedValue: string;
}

export interface FuzzySearchResult<T> {
  exactMatches: FuzzyMatchItem<T>[];
  fuzzyMatches: FuzzyMatchItem<T>[];
  allMatches: FuzzyMatchItem<T>[];
  didYouMean: FuzzyMatchItem<T> | null;
}

/**
 * Perform a full fuzzy search over subscribers with automatic "Did you mean?" extraction
 */
export function searchSubscribersFuzzy<T>(
  query: string,
  items: T[],
  extract: (item: T) => {
    name: string;
    phone?: string | null;
    alias?: string | null;
    ticket?: number | string | null;
  }
): FuzzySearchResult<T> {
  const clean = query.trim();
  if (!clean) {
    return {
      exactMatches: [],
      fuzzyMatches: [],
      allMatches: [],
      didYouMean: null,
    };
  }

  const results: FuzzyMatchItem<T>[] = [];
  const cleanDigits = clean.replace(/\D/g, '');

  for (const item of items) {
    const { name, phone, alias, ticket } = extract(item);
    let bestScore = 0;
    let matchedField: 'name' | 'phone' | 'alias' | 'ticket' = 'name';
    let matchedValue = name;

    // 1. Name match
    const nameScore = computeFuzzyScore(clean, name);
    if (nameScore > bestScore) {
      bestScore = nameScore;
      matchedField = 'name';
      matchedValue = name;
    }

    // 2. Alias match
    if (alias) {
      const aliasScore = computeFuzzyScore(clean, alias);
      if (aliasScore > bestScore) {
        bestScore = aliasScore;
        matchedField = 'alias';
        matchedValue = alias;
      }
    }

    // 3. Phone match (exact substring or suffix)
    if (phone && cleanDigits.length >= 3) {
      const phoneDigits = phone.replace(/\D/g, '');
      if (phoneDigits.includes(cleanDigits)) {
        const phoneScore = phoneDigits === cleanDigits ? 1.0 : 0.94;
        if (phoneScore > bestScore) {
          bestScore = phoneScore;
          matchedField = 'phone';
          matchedValue = phone;
        }
      }
    }

    // 4. Ticket match (exact ticket number)
    if (ticket !== undefined && ticket !== null) {
      const ticketStr = String(ticket).trim();
      const queryTicket = clean.replace(/^[#t]/i, '').trim();
      if (ticketStr === queryTicket) {
        bestScore = 1.0;
        matchedField = 'ticket';
        matchedValue = `Ticket #${ticketStr}`;
      }
    }

    // Include if score meets minimum threshold (0.60 for fuzzy)
    if (bestScore >= 0.60) {
      const isExact = bestScore >= 0.90;
      results.push({
        item,
        score: bestScore,
        isExact,
        isFuzzy: !isExact,
        matchedField,
        matchedValue,
      });
    }
  }

  // Sort descending by score
  results.sort((a, b) => b.score - a.score);

  const exactMatches = results.filter(r => r.isExact);
  const fuzzyMatches = results.filter(r => r.isFuzzy);

  // "Did you mean?" candidate:
  // If there are NO exact matches, but we have close fuzzy matches (score >= 0.65),
  // pick the top-ranked match as the "Did you mean?" recommendation!
  let didYouMean: FuzzyMatchItem<T> | null = null;
  if (exactMatches.length === 0 && fuzzyMatches.length > 0 && fuzzyMatches[0].score >= 0.65) {
    didYouMean = fuzzyMatches[0];
  }

  return {
    exactMatches,
    fuzzyMatches,
    allMatches: results,
    didYouMean,
  };
}
