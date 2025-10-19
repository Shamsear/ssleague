/**
 * Fuzzy matching utilities for comparing names (players, teams)
 * Uses Levenshtein distance for similarity calculation
 * Performance optimized with memoization
 */

export interface MatchResult {
  name: string;
  similarity: number;
  isExactMatch: boolean;
  isFuzzyMatch: boolean;
  distance: number;
}

// Memoization cache for distance calculations
const distanceCache = new Map<string, number>();
const cacheKeyGenerator = (str1: string, str2: string) => `${str1}:${str2}`;

/**
 * Calculate Levenshtein distance between two strings (memoized)
 * @param str1 First string
 * @param str2 Second string
 * @returns Minimum number of edits required to transform str1 to str2
 */
function levenshteinDistance(str1: string, str2: string): number {
  // Check cache first
  const cacheKey = cacheKeyGenerator(str1, str2);
  if (distanceCache.has(cacheKey)) {
    return distanceCache.get(cacheKey)!;
  }
  
  const m = str1.length;
  const n = str2.length;
  
  // Create a 2D array to store distances
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
  
  // Initialize first column and row
  for (let i = 0; i <= m; i++) {
    dp[i][0] = i;
  }
  for (let j = 0; j <= n; j++) {
    dp[0][j] = j;
  }
  
  // Fill the dp array
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(
          dp[i - 1][j],     // deletion
          dp[i][j - 1],     // insertion
          dp[i - 1][j - 1]  // substitution
        );
      }
    }
  }
  
  const result = dp[m][n];
  
  // Cache the result
  distanceCache.set(cacheKey, result);
  
  // Limit cache size to prevent memory issues (keep last 1000 entries)
  if (distanceCache.size > 1000) {
    const firstKey = distanceCache.keys().next().value;
    distanceCache.delete(firstKey);
  }
  
  return result;
}

/**
 * Calculate similarity percentage between two strings
 * @param str1 First string
 * @param str2 Second string
 * @returns Similarity percentage (0-100)
 */
export function calculateSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();
  
  if (s1 === s2) return 100;
  if (s1.length === 0 || s2.length === 0) return 0;
  
  const distance = levenshteinDistance(s1, s2);
  const maxLength = Math.max(s1.length, s2.length);
  const similarity = ((maxLength - distance) / maxLength) * 100;
  
  return Math.round(similarity * 100) / 100;
}

/**
 * Normalize a name for comparison (remove extra spaces, special chars, lowercase)
 * @param name Name to normalize
 * @returns Normalized name
 */
export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')  // Replace multiple spaces with single space
    .replace(/[^\w\s]/g, ''); // Remove special characters
}

/**
 * Find potential matches for a name from a list of existing names
 * @param inputName Name to search for
 * @param existingNames List of existing names to compare against
 * @param threshold Minimum similarity threshold (0-100), default 70
 * @param maxResults Maximum number of results to return, default 5
 * @returns Array of match results sorted by similarity
 */
export function findMatches(
  inputName: string,
  existingNames: string[],
  threshold: number = 70,
  maxResults: number = 5
): MatchResult[] {
  const normalizedInput = normalizeName(inputName);
  const results: MatchResult[] = [];
  
  for (const existingName of existingNames) {
    const normalizedExisting = normalizeName(existingName);
    
    // Check for exact match
    if (normalizedInput === normalizedExisting) {
      results.push({
        name: existingName,
        similarity: 100,
        isExactMatch: true,
        isFuzzyMatch: false,
        distance: 0
      });
      continue;
    }
    
    // Calculate similarity
    const similarity = calculateSimilarity(inputName, existingName);
    const distance = levenshteinDistance(normalizedInput, normalizedExisting);
    
    // Only include if similarity meets threshold
    if (similarity >= threshold) {
      results.push({
        name: existingName,
        similarity,
        isExactMatch: false,
        isFuzzyMatch: true,
        distance
      });
    }
  }
  
  // Sort by similarity (descending) and then by distance (ascending)
  results.sort((a, b) => {
    if (b.similarity !== a.similarity) {
      return b.similarity - a.similarity;
    }
    return a.distance - b.distance;
  });
  
  // Return top N results
  return results.slice(0, maxResults);
}

/**
 * Check if a name is likely a duplicate of any existing names
 * @param inputName Name to check
 * @param existingNames List of existing names
 * @param threshold Similarity threshold for considering a duplicate (default 85)
 * @returns True if a potential duplicate is found
 */
export function isPotentialDuplicate(
  inputName: string,
  existingNames: string[],
  threshold: number = 85
): boolean {
  const matches = findMatches(inputName, existingNames, threshold, 1);
  return matches.length > 0;
}

/**
 * Get suggestions for correcting a name based on existing names
 * @param inputName Name to correct
 * @param existingNames List of existing correct names
 * @param threshold Minimum similarity for suggestions (default 60)
 * @returns Array of suggested corrections
 */
export function getSuggestions(
  inputName: string,
  existingNames: string[],
  threshold: number = 60
): string[] {
  const matches = findMatches(inputName, existingNames, threshold, 5);
  return matches.map(m => m.name);
}

/**
 * Batch find matches for multiple names (optimized)
 * @param inputNames Names to search for
 * @param existingNames List of existing names to compare against
 * @param threshold Minimum similarity threshold
 * @returns Map of input name to array of match results
 */
export function batchFindMatches(
  inputNames: string[],
  existingNames: string[],
  threshold: number = 70
): Map<string, MatchResult[]> {
  const results = new Map<string, MatchResult[]>();
  
  // Process in batches to avoid blocking
  for (const inputName of inputNames) {
    const matches = findMatches(inputName, existingNames, threshold);
    if (matches.length > 0) {
      results.set(inputName, matches);
    }
  }
  
  return results;
}

/**
 * Clear the memoization cache (useful for testing or memory management)
 */
export function clearCache(): void {
  distanceCache.clear();
}
