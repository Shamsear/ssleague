// Levenshtein distance function
function levenshteinDistance(str1, str2) {
  const matrix = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
}

// Test the matching logic
const name1 = "Abu";
const name2 = "Aboobaker Siddique";

const name1Lower = name1.toLowerCase().trim();
const name2Lower = name2.toLowerCase().trim();
const shorterName = name1Lower.length < name2Lower.length ? name1Lower : name2Lower;
const longerName = name1Lower.length >= name2Lower.length ? name1Lower : name2Lower;

console.log(`Testing: "${name1}" vs "${name2}"`);
console.log(`Shorter: "${shorterName}"`);
console.log(`Longer: "${longerName}"`);
console.log(`\nChecks:`);
console.log(`  Length >= 3: ${shorterName.length >= 3}`);
console.log(`  Includes: ${longerName.includes(shorterName)}`);
console.log(`  Starts with: ${longerName.startsWith(shorterName)}`);
console.log(`  Word starts: ${longerName.split(/\s+/).some(word => word.startsWith(shorterName))}`);

// Check fuzzy prefix for each word
const words = longerName.split(/\s+/);
console.log(`\nFuzzy prefix check:`);
words.forEach(word => {
  const prefix = word.substring(0, shorterName.length);
  const dist = levenshteinDistance(prefix, shorterName);
  console.log(`  Word "${word}" -> prefix "${prefix}" vs "${shorterName}" = distance ${dist}`);
});

const fuzzyMatch = longerName.split(/\s+/).some(word => 
  levenshteinDistance(word.substring(0, shorterName.length), shorterName) <= 1
);
console.log(`  Fuzzy match (≤1): ${fuzzyMatch}`);

const isSubstring = shorterName.length >= 3 && (
  longerName.includes(shorterName) ||
  longerName.startsWith(shorterName) ||
  longerName.split(/\s+/).some(word => word.startsWith(shorterName)) ||
  longerName.split(/\s+/).some(word => levenshteinDistance(word.substring(0, shorterName.length), shorterName) <= 1)
);

console.log(`\n✅ Match found: ${isSubstring}`);
