/**
 * ID Parser Registry
 * Routes OCR text to the appropriate parser based on detected ID type
 * Consolidates logic for parsing 17 Philippine ID types
 * 
 * This is the main extraction engine. Individual parsers can be split
 * into separate files later as the system grows.
 */

import { BARANGAY_KEYWORDS, BLACKLIST_KEYWORDS, KNOWN_CITIES, KNOWN_PROVINCES, METADATA_KEYWORDS } from '@/constants/ocr';
import type { ParsedIDData } from '@/types/ocr';
import { detectIdType } from '../id-detector';

/**
 * Province to Region mapping for Philippines
 * Auto-populates region based on province extraction
 */
const PROVINCE_TO_REGION: Record<string, string> = {
  'BATANGAS': 'CALABARZON',
  'LAGUNA': 'CALABARZON',
  'CAVITE': 'CALABARZON',
  'QUEZON': 'CALABARZON',
  'RIZAL': 'CALABARZON',
  'BULACAN': 'NCR/CALABARZON',
  'NEW ECIJA': 'CENTRAL LUZON',
  'PAMPANGA': 'CENTRAL LUZON',
  'TARLAC': 'CENTRAL LUZON',
  'PANGASINAN': 'ILOCOS',
  'ILOCOS': 'ILOCOS',
  'NUEVA VIZCAYA': 'CAR',
  'IFUGAO': 'CAR',
  'BENGUET': 'CAR',
  'MOUNTAIN PROVINCE': 'CAR',
  'CAGAYAN': 'CAGAYAN VALLEY',
  'ISABELA': 'CAGAYAN VALLEY',
  'QUIRINO': 'CAGAYAN VALLEY',
  'ILOILO': 'WESTERN VISAYAS',
  'CAPIZ': 'WESTERN VISAYAS',
  'AKLAN': 'WESTERN VISAYAS',
  'ANTIQUE': 'WESTERN VISAYAS',
  'CEBU': 'CENTRAL VISAYAS',
  'NEGROS': 'CENTRAL VISAYAS',
  'SIQUIJOR': 'CENTRAL VISAYAS',
  'BOHOL': 'CENTRAL VISAYAS',
  'DAVAO': 'DAVAO',
  'COMPOSTELA': 'DAVAO',
  'MISAMIS': 'NORTHERN MINDANAO',
  'LANAO': 'AUTONOMOUS REGION',
  'MAGUINDANAO': 'AUTONOMOUS REGION',
  'SURIGAO': 'CARAGA',
  'AGUSAN': 'CARAGA',
  'DINAGAT': 'CARAGA',
  'ALBAY': 'BICOL',
  'CAMARINES': 'BICOL',
  'SORSOGON': 'BICOL',
  'MASBATE': 'BICOL',
  'PALAWAN': 'MIMAROPA',
  'ROMBLON': 'MIMAROPA',
};

/**
 * Fix common OCR character confusions
 */
function fixOCRCharacters(text: string): string {
  let fixed = text;
  
  // Common OCR letter confusions
  const confusions: Record<string, string> = {
    '0': 'O',  // Zero to letter O
    '1': 'I',  // One to letter I
    'l': 'I',  // lowercase l to I
    'ł': 'I',  // Polish L to I
    '7': 'T',  // Seven to T
    'B': '8',  // B to 8 - reverse mapping for numbers
    'S': '5',  // S to 5 - reverse mapping for numbers
  };
  
  // Replace in strings that look like names (mostly uppercase)
  if (fixed.toUpperCase() === fixed) {
    for (const [bad, good] of Object.entries(confusions)) {
      fixed = fixed.replace(new RegExp(bad.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), good);
    }
  }
  
  return fixed;
}

/**
 * Clean OCR noise from extracted values
 */
export function cleanField(text: string): string {
  if (!text) return '';
  
  let cleaned = text.trim();
  
  // Remove leading special characters and spaces (but preserve letters/numbers)
  cleaned = cleaned.replace(/^[^A-Za-z0-9]+/, '');
  
  // Remove trailing special characters (except commas and apostrophes in names)
  cleaned = cleaned.replace(/[^A-Za-z0-9,.'\s]+$/g, '');
  
  // Remove problematic characters: • (bullet), « », etc.
  cleaned = cleaned.replace(/[•«»""''""]/g, '');
  
  // Remove leading quotes/apostrophes from words
  cleaned = cleaned.replace(/\s+['"`]/g, ' ');
  cleaned = cleaned.replace(/^['"`]/g, '');
  
  // Normalize multiple commas and spaces
  cleaned = cleaned.replace(/,+/g, ',');
  cleaned = cleaned.replace(/\s*,\s*/g, ', ');
  cleaned = cleaned.replace(/\s+/g, ' ');
  
  // Fix OCR character confusions
  cleaned = fixOCRCharacters(cleaned);
  
  return cleaned.trim();
}

/**
 * Normalize OCR-corrupted address tokens
 * Fixes common character confusions: 5→S, 8→B, ELK→BLK (address context only)
 * Thoroughly handles all corruption patterns to ensure proper field classification
 */
function normalizeAddressToken(token: string): string {
  if (!token || token.length === 0) return '';
  
  let normalized = token.trim();
  
  // === FIX 5→S (very common OCR corruption) ===
  // Handle multiple patterns to catch all cases
  
  // Pattern 1: "A5" at end of word or string (ITAA5, BATANGA5)
  // This is the most common: last letter is A, corrupted to 5
  normalized = normalized.replace(/A5(\s|$)/g, 'AS$1');
  
  // Pattern 2: Any letter followed by 5 at word boundary
  normalized = normalized.replace(/([A-Z])5(\s|$)/g, '$1S$2');
  
  // Pattern 3: Digit 5 between letters (no space separator): BATANGA5CITY → BATANGASCITY
  normalized = normalized.replace(/([A-Z])5([A-Z])/g, '$1S$2');
  
  // === FIX 8→B (common OCR confusion) ===
  // Pattern 1: 8 at start or after space, followed by vowel
  normalized = normalized.replace(/^8([AEIOU])/i, 'B$1');
  normalized = normalized.replace(/(\s)8([AEIOU])/g, '$1B$2');
  
  // Pattern 2: 8 between letters
  normalized = normalized.replace(/([A-Z])8([A-Z])/g, '$1B$2');
  
  // === FIX ELK→BLK (address context: "Block" in addresses) ===
  // Only replace when it's clearly the word "ELK" (not part of another word)
  normalized = normalized.replace(/\bELK\b/gi, 'BLK');
  
  return normalized;
}

/**
 * Validate if text looks like a valid house number
 * Rejects values with place names or city/province keywords
 */
function isValidHouseNumber(text: string): boolean {
  if (!text || text.length === 0) return false;
  
  const cleaned = text.trim();
  const upper = cleaned.toUpperCase();
  
  // Reject if contains place keywords -  NEVER put city/province in house number
  const placeKeywords = ['CITY', 'MUNICIPALITY', 'PROVINCE', 'BARANGAY', 'BATANGAS', 'MANILA', 'CEBU', 'QUEZON', 'LAGUNA', 'CAVITE'];
  if (placeKeywords.some(kw => upper.includes(kw))) {
    console.log(`[Validate] ❌ Rejecting house_no: contains place keyword "${text}"`);
    return false;
  }
  
  // Reject if too long
  if (cleaned.length > 25) {
    console.log(`[Validate] ❌ Rejecting house_no: too long (${cleaned.length}): "${text}"`);
    return false;
  }
  
  // Reject if too many letters (likely a place name, not house number)
  const letterCount = (cleaned.match(/[A-Za-z]/g) || []).length;
  const letterPct = letterCount / cleaned.length;
  if (letterPct > 0.8) {
    console.log(`[Validate] ❌ Rejecting house_no: too alphabetic (${(letterPct*100).toFixed(0)}%): "${text}"`);
    return false;
  }
  
  if (cleaned.length < 2) return false;
  if (!/^\d/.test(cleaned)) return false;
  
  // Accept valid house number patterns
  const validHousePattern = /^\d+(?:[\s\-\/]?[A-Z]?[\s\-\/]?\d*)*$/i;
  return validHousePattern.test(cleaned);
}

/**
 * Identify if text is likely a barangay name
 */
function isLikelyBarangay(text: string): boolean {
  const upper = text.toUpperCase();
  // CRITICAL: Check for barangay keywords FIRST - these are definitive
  if (BARANGAY_KEYWORDS.some(kw => upper.includes(kw))) {
    console.log(`[Barangay] ✅ Keyword match found in "${upper}"`);
    return true;
  }
  // Fallback: Generic pattern for barangay names
  const words = text.split(/\s+/).length;
  if (words <= 3 && text.length < 40 && !upper.includes('CITY') && !upper.includes('PROVINCE')) {
    console.log(`[Barangay] ✅ Generic pattern match for "${upper}" (${words} words, ${text.length} chars)`);
    return true;
  }
  console.log(`[Barangay] ❌ Not a barangay: "${upper}" (${words} words, ${text.length} chars, keywords: ${!BARANGAY_KEYWORDS.some(kw => upper.includes(kw))})`);
  return false;
}

/**
 * Check if text likely contains a corrupted CITY keyword
 * Handles OCR errors like "cry" instead of "city", "citv", etc.
 */
function hasCorruptedCityKeyword(text: string): boolean {
  const upper = text.toUpperCase();
  // Direct matches
  if (upper.includes('CITY') || upper.includes('MUNICIPALITY') || upper.includes('MUNI')) return true;
  
  // Common OCR corruptions of "CITY"
  if (upper.includes('CIT') && (upper.includes('Y') || upper.includes('CRY') || upper.includes('CITV') || upper.includes('CITI'))) return true;
  if (upper.includes('CRY')) return true; // "city" → "cry"
  if (upper.includes('CITV')) return true; // "city" → "citv"
  if (upper.includes('CITI')) return true; // "city" → "citi"
  if (upper.includes('MUN')) return true; // "municipality" partial
  
  return false;
}

/**
 * Identify if text is likely a city or municipality
 */
function isLikelyCityOrMunicipality(text: string): boolean {
  const upper = text.toUpperCase();
  // Check for explicit keywords first
  if (upper.includes('CITY') || upper.includes('MUNICIPALITY') || upper.includes('MUNI')) {
    console.log(`[City] ✅ Explicit keyword found in "${upper}"`);
    return true;
  }
  // Check against known cities
  if (KNOWN_CITIES.some(city => upper.includes(city))) {
    console.log(`[City] ✅ Known city match found in "${upper}"`); 
    return true;
  }
  // Check for corrupted keywords
  if (upper.includes('CIT') || upper.includes('CRY') || upper.includes('MUN')) {
    console.log(`[City] ✅ Corrupted keyword found in "${upper}"`);
    return true;
  }
  console.log(`[City] ❌ Not a city: "${upper}"`);
  return false;
}

/**
 * Identify if text is likely a province name
 */
function isLikelyProvince(text: string): boolean {
  const upper = text.toUpperCase();
  if (upper.includes('PROVINCE') || upper.includes('PROV')) return true;
  if (KNOWN_PROVINCES.some(prov => upper.includes(prov))) return true;
  return false;
}

/**
 * Parse full address string into components intelligently
 */
function parseAddressComponents(addressString: string): Partial<ParsedIDData> {
  if (!addressString || !addressString.trim()) {
    return {};
  }

  const components: Partial<ParsedIDData> = {
    addressHouseNo: '',
    addressStreet: '',
    addressBarangay: '',
    addressCityMunicipality: '',
    addressProvince: '',
    addressRegion: ''
  };
  
  let normalized = addressString
    .replace(/\.|;/g, ',')
    .replace(/\r\n/g, ',')
    .replace(/\n/g, ',');
  
  const parts = normalized
    .split(',')
    .map(p => p.trim())
    .filter(p => p.length > 1)
    .filter(p => p.length > 0)
    // CRITICAL: Normalize each part BEFORE classification to fix OCR corruption
    .map(p => normalizeAddressToken(p));
  
  console.log(`[AddressParser] Normalized address and split into ${parts.length} part(s):`);
  parts.forEach((p, idx) => console.log(`   [${idx}] "${p}"`));
  
  const classified: Array<{ part: string; type: string }> = [];
  
  for (const part of parts) {
    let type = 'unknown';
    
    if (part.length <= 1) {
      type = 'skip';
    } else if (/^\d+$/.test(part)) {
      type = 'postalCode';
    } else if (isValidHouseNumber(part)) {
      type = 'houseNo';
    } else if (isLikelyProvince(part)) {
      type = 'province';
    } else if (isLikelyCityOrMunicipality(part)) {
      type = 'municipality';
    } else if (isLikelyBarangay(part)) {
      type = 'barangay';
    } else {
      type = 'unknown';
    }
    
    classified.push({ part, type });
    console.log(`   [${type.padEnd(14)}] "${part}"`);
  }
  
  for (const { part, type } of classified) {
    if (type === 'skip' || type === 'postalCode') {
      continue;
    } else if (type === 'houseNo' && !components.addressHouseNo) {
      components.addressHouseNo = part;
    } else if (type === 'province' && !components.addressProvince) {
      components.addressProvince = part;
      // Auto-populate region from province
      const provinceUpper = part.toUpperCase();
      components.addressRegion = PROVINCE_TO_REGION[provinceUpper] || '';
    } else if (type === 'municipality' && !components.addressCityMunicipality) {
      components.addressCityMunicipality = part;
    } else if (type === 'barangay' && !components.addressBarangay) {
      components.addressBarangay = part;
    } else if (type === 'unknown') {
      if (!components.addressStreet) {
        components.addressStreet = part;
      }
    }
  }
  
  console.log(`[AddressParser] Final mapping:`);
  console.log(`   houseNo: "${components.addressHouseNo}"`);
  console.log(`   street: "${components.addressStreet}"`);
  console.log(`   barangay: "${components.addressBarangay}"`);
  console.log(`   city/municipality: "${components.addressCityMunicipality}"`);
  console.log(`   province: "${components.addressProvince}"`);
  console.log(`   region: "${components.addressRegion}"`);

  return components;
}

/**
 * Normalize OCR name by removing diacritics
 */
function normalizeOCRName(text: string): string {
  if (!text) return text;
  try {
    const normalized = text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .normalize('NFC');
    return normalized;
  } catch (e) {
    return text;
  }
}

/**
 * Extract lines that don't contain blacklist keywords
 */
function filterDataLines(
  textlines: string[],
  additionalBlacklist: string[] = []
): string[] {
  const combinedBlacklist = new Set([
    ...BLACKLIST_KEYWORDS,
    ...additionalBlacklist,
  ]);

  return textlines.filter(line => {
    if (line.trim().length < 2) return false;
    const upperLine = line.toUpperCase();
    const words = upperLine.split(/[\s,]+/);

    let blacklistCount = 0;
    let metadataCount = 0;

    for (const word of words) {
      if (combinedBlacklist.has(word)) blacklistCount++;
      if (METADATA_KEYWORDS.has(word)) metadataCount++;
    }

    if (blacklistCount > 1) return false;
    if (metadataCount >= 2) return false;

    return true;
  });
}

/**
 * Find label and extract the value on the next line(s)
 */
function extractAfterLabel(
  lines: string[],
  labelPatterns: string[]
): string {
  for (let i = 0; i < lines.length - 1; i++) {
    const lineTrimmed = lines[i].toUpperCase().trim();

    for (const pattern of labelPatterns) {
      if (lineTrimmed.includes(pattern)) {
        let j = i + 1;
        while (j < lines.length) {
          const nextLine = lines[j].trim();
          if (nextLine.length >= 2) {
            return cleanField(nextLine);
          }
          j++;
        }
      }
    }
  }

  return '';
}

/**
 * Parse generic name format: "LASTNAME, FIRSTNAME" or "FIRSTNAME LASTNAME"
 */
function parseNameValue(nameValue: string): {
  firstName: string;
  lastName: string;
} {
  const cleaned = cleanField(nameValue);
  if (!cleaned) return { firstName: '', lastName: '' };

  console.log(`[ParseName] Input: "${nameValue}" → Cleaned: "${cleaned}"`);

  if (cleaned.includes(',')) {
    const [lastPart, firstPart] = cleaned
      .split(',')
      .map(p => p.trim());
    if (lastPart && firstPart) {
      // Extract first word from each part (handles middle names)
      let lastName = lastPart.split(/\s+/)[0];
      let firstName = firstPart.split(/\s+/)[0];
      
      // Extra cleanup for any remaining special chars
      lastName = lastName.replace(/[^A-Za-z-']/g, '').trim();
      firstName = firstName.replace(/[^A-Za-z-']/g, '').trim();
      
      if (lastName && firstName) {
        console.log(`[ParseName] ✅ Found name: firstName="${firstName}", lastName="${lastName}"`);
        return { firstName, lastName };
      }
    }
  }

  const words = cleaned.split(/\s+/).filter(w => w && w.length >= 2);
  if (words.length >= 2) {
    let firstName = words[0];
    let lastName = words.slice(1).join(' ');
    
    // Extra cleanup
    firstName = firstName.replace(/[^A-Za-z-']/g, '').trim();
    lastName = lastName.replace(/[^A-Za-z-']/g, '').trim();
    
    if (firstName && lastName) {
      console.log(`[ParseName] ✅ Found name (space-separated): firstName="${firstName}", lastName="${lastName}"`);
      return { firstName, lastName };
    }
  } else if (words.length === 1) {
    let firstName = words[0].replace(/[^A-Za-z-']/g, '').trim();
    if (firstName) {
      console.log(`[ParseName] ⚠️ Single word name: firstName="${firstName}", lastName=""`);
      return { firstName, lastName: '' };
    }
  }

  console.log(`[ParseName] ❌ Could not parse name from: "${cleaned}"`);
  return { firstName: '', lastName: '' };
}

/**
 * Generic parser for unknown ID types
 */
/**
 * Check if a word is a fuzzy match for a keyword (handles OCR misspellings)
 * Example: "uceNse" matches "LICENSE" (6/7 chars in roughly same positions)
 */
function isFuzzyKeywordMatch(word: string, keyword: string): boolean {
  const w = word.toUpperCase();
  const k = keyword.toUpperCase();
  
  // Exact match
  if (w.includes(k)) return true;
  
  // Fuzzy match: at least 60% of keyword chars appear in word
  if (w.length > 0 && k.length > 0) {
    const charMatches = k.split('').filter(char => w.includes(char)).length;
    const matchRatio = charMatches / k.length;
    if (matchRatio >= 0.6 && Math.abs(w.length - k.length) <= 2) {
      return true;
    }
  }
  
  return false;
}

/**
 * Detect if a line is garbage or document metadata (not actual user data)
 * More conservative - only filter obvious garbage
 */
function isGarbageOrMetadataLine(line: string): boolean {
  const upper = line.toUpperCase();
  const trimmed = line.trim();
  
  // Very short lines (but keep 2-3 char lines as they might be initials)
  if (trimmed.length === 0) return true;
  if (trimmed.length === 1) return true;
  
  // Lines that are purely numbers or IDs
  if (/^\d+[\s\-/]*\d*$/.test(trimmed)) return true;
  
  // Lines with mostly numbers and special chars (like "D01-a4-004529" or "2028/12/29")
  const digitPct = (trimmed.match(/\d/g) || []).length / trimmed.length;
  if (digitPct > 0.6 && trimmed.length < 25) return true;
  
  // Lines that start with obvious non-name keywords
  const startsWithGarbage = [
    'EYES',
    'COLOR',
    'HAIR',
    'BLOOD',
    'HEIGHT',
    'WEIGHT',
    'RESTRICTION',
    'VALIDITY',
    'EXPIRATION',
  ];
  
  if (startsWithGarbage.some(keyword => upper.startsWith(keyword))) {
    console.log(`[Garbage] Filtering line starting with metadata keyword: "${trimmed}"`);
    return true;
  }
  
  // Very corrupted lines (multiple sequences of 3+ consonants)
  const consonantSequences = (trimmed.match(/[bcdfghjklmnpqrstvwxyz]{3,}/gi) || []).length;
  if (consonantSequences > 2) {
    console.log(`[Garbage] Filtering heavily corrupted line: "${trimmed}"`);
    return true;
  }
  
  return false;
}

/**
 * Detect if a line is a document header or metadata
 * More conservative - only filter clear headers
 */
function isHeaderOrMetadataLine(line: string): boolean {
  const upper = line.toUpperCase();
  
  // First check if it's obvious garbage
  if (isGarbageOrMetadataLine(line)) {
    return true;
  }
  
  // Exact phrase matching for common Philippine ID headers
  const commonHeaderPhrases = [
    'REPUBLIC OF THE PHILIPPINES',
    'REPUBLIC OF',
    'DEPARTMENT OF',
    'VALID IDENTIFICATION',
    'OFFICIAL USE ONLY',
    'NOT VALID FOR',
  ];
  
  if (commonHeaderPhrases.some(phrase => upper.includes(phrase))) {
    console.log(`[Header] Detected header phrase: "${line}"`);
    return true;
  }
  
  // Document type headers - MUST be present AND line must be short
  const documentHeaders = [
    'REPUBLIC',
    'PHILIPPINES',
    "DRIVER'S",
    'DRIVERS',
    'LICENSE',
    'PASSPORT',
    'IDENTIFICATION',
    'NATIONAL ID',
    'PHILSYS',
    'UMID',
    'PRC',
    'COMMISSION',
    'GOVERNMENT',
    'DEPARTMENT',
    'OFFICE',
    'CERTIFICATE',
    'CLEARANCE',
    'TRANSPORTAT',
    'LAND',
  ];
  
  // If line contains 2+ header keywords, it's likely a header
  if (line.length < 50) {
    const headerKeywordCount = documentHeaders.filter(kw => upper.includes(kw)).length;
    if (headerKeywordCount >= 2) {
      console.log(`[Header] Detected header by keywords (${headerKeywordCount} keywords): "${line}"`);
      return true;
    }
  }
  
  // Otherwise keep it - let the name/address extraction logic handle it
  return false;
}


function parseGenericID(lines: string[]): Partial<ParsedIDData> {
  let firstName = '';
  let lastName = '';
  let address = '';
  let addressBarangay = '';
  let addressCityMunicipality = '';
  let addressProvince = '';
  let addressRegion = '';
  let addressStreet = '';
  let addressHouseNo = '';

  console.log(`\n[Generic] ==================== GENERIC PARSER START ====================`);
  console.log(`[Generic] Total lines to process: ${lines.length}`);
  
  // Filter out header/metadata lines
  const dataLines = lines.filter(line => {
    const isHeader = isHeaderOrMetadataLine(line);
    if (isHeader) {
      console.log(`[Generic] FILTERED (header): "${line}"`);
    }
    return !isHeader;
  });
  
  console.log(`[Generic] After filtering headers: ${dataLines.length} meaningful data lines remain\n`);
  dataLines.forEach((line, idx) => {
    console.log(`[Generic]   Line[${idx}]: "${line}"`);
  });

  // Find name by looking for name-like patterns in data lines
  // PRIORITIZE: Lines with commas (LASTNAME, FIRSTNAME format - common in PH IDs)
  console.log(`\n[Generic] === SEARCHING FOR NAME ===`);
  console.log(`[Generic] Strategy 1: Look for comma-separated format (LASTNAME, FIRSTNAME)`);
  
  // First pass: Look for lines with commas (more reliable for names)
  for (let i = 0; i < dataLines.length; i++) {
    const line = dataLines[i].trim();
    
    if (line.includes(',')) {
      const parts = line.split(',');
      const letterPct = (line.match(/[A-Za-z]/g) || []).length / line.length;
      
      console.log(`[Generic] Found comma-separated line ${i}: "${line}"`);
      console.log(`[Generic]   - Parts: ${parts.length}, Letters: ${(letterPct * 100).toFixed(1)}%`);
      
      // Check if it's likely a name (mostly letters, no numbers)
      if (letterPct >= 0.7 && !line.match(/\d{4,}/)) {
        const parsed = parseNameValue(line);
        
        if (parsed.firstName || parsed.lastName) {
          firstName = parsed.firstName;
          lastName = parsed.lastName;
          console.log(`[Generic] ✅ NAME FOUND (comma format): firstName="${firstName}", lastName="${lastName}"`);
          break;
        }
      } else {
        console.log(`[Generic] ⊘ Skipping (not name-like: ${letterPct < 0.7 ? 'too many non-letters' : 'contains numbers'})`);
      }
    }
  }
  
  // Second pass: Look for space-separated names (if no comma-separated found)
  if (!firstName && !lastName) {
    console.log(`[Generic] Strategy 2: Look for space-separated format (FIRSTNAME LASTNAME)`);
    
    for (let i = 0; i < Math.min(10, dataLines.length); i++) {
      const line = dataLines[i].trim();
      const words = line.split(/\s+/).filter(w => w.length > 0);
      const letterPct = (line.match(/[A-Za-z]/g) || []).length / line.length;

      console.log(`[Generic] Checking line ${i}: "${line}"`);
      console.log(`[Generic]   - Words: ${words.length}, Letters: ${(letterPct * 100).toFixed(1)}%`);

      // Look for lines that have name characteristics:
      // - 2+ words (first name, last name, maybe middle name)
      // - Mostly letters (70%+ alphabetic to be strict)
      // - No commas (already checked those above)
      if (words.length >= 2 && letterPct >= 0.7 && !line.includes(',')) {
        // Check if all words are reasonable (mostly letters)
        const allWordsReasonable = words.every(w => {
          const wordLetters = (w.match(/[A-Za-z]/g) || []).length;
          const wordPct = w.length > 0 ? wordLetters / w.length : 0;
          return wordPct >= 0.75; // Very strict - at least 75% letters per word
        });
        
        if (allWordsReasonable) {
          const parsed = parseNameValue(line);
          
          if (parsed.firstName || parsed.lastName) {
            firstName = parsed.firstName;
            lastName = parsed.lastName;
            console.log(`[Generic] ✅ NAME FOUND (space format): firstName="${firstName}", lastName="${lastName}"`);
            break;
          } else {
            console.log(`[Generic] ⚠️ Parsed but no valid name parts extracted`);
          }
        } else {
          console.log(`[Generic] ⚠️ Contains too many non-letter characters, skipping`);
        }
      } else {
        const reason = words.length < 2 ? 'too few words' : 'too many special chars or has comma';
        console.log(`[Generic] ⊘ Skipping (${reason})`);
      }
    }
  }

  if (!firstName && !lastName) {
    console.log(`[Generic] ⚠️ No name found after checking all lines`);
  }

  // Find address by extracting structured components from multiple lines
  // Using smart OCR normalization and field validation
  console.log(`\n[Generic] === SEARCHING FOR ADDRESS (WITH OCR CORRECTION) ===`);
  
  // Look through lines to extract address components
  for (let i = 0; i < dataLines.length; i++) {
    const line = dataLines[i].trim();
    const upper = line.toUpperCase();
    
    // Skip lines that are clearly the name we already found
    if ((firstName && lastName && line === `${lastName}, ${firstName}`) ||
        (firstName && lastName && line === `${firstName} ${lastName}`)) {
      console.log(`[Generic] Skipping name line: "${line}"`);
      continue;
    }
    
    // Skip very short lines
    if (line.length < 8) {
      console.log(`[Generic] Skipping short line: "${line}"`);
      continue;
    }

    console.log(`[Generic] Analyzing line ${i}: "${line}"`);
    
    // Pattern 1: BARANGAY, CITY or BARANGAY. CITY format
    // Example: "GULOD ITAAS. BATANGAS CITY" or "GULOD ITAAS, BATANGAS CITY" or "GULOD ITAAS. BATANGAS cry" (corrupted)
    // After normalization: "GULOD ITAAS. BATANGAS CITY" → barangay="GULOD ITAAS", city="BATANGAS CITY"
    const hasDelimiter = line.includes(',') || line.includes('.');
    const hasCityKeyword = hasCorruptedCityKeyword(line);
    console.log(`[Generic] Checking Pattern 1 (BARANGAY. CITY format):`);
    console.log(`[Generic]   hasDelimiter: ${hasDelimiter} (line="${line}")`);
    console.log(`[Generic]   hasCityKeyword: ${hasCityKeyword}`);
    
    if (hasDelimiter && hasCityKeyword) {
      console.log(`[Generic] 🔍 Pattern 1 matched (has delimiter + CITY/MUNICIPALITY keyword, including corrupted ones)`);
      // Split by comma or period
      const parts = line.split(/[,.]/).map(p => p.trim());
      console.log(`[Generic] Split into ${parts.length} parts: [${parts.map(p => `"${p}"`).join(', ')}]`);
      
      if (parts.length >= 2) {
        // First part = barangay (normalize OCR issues)
        let barangayRaw = cleanField(parts[0]);
        let barangayNormalized = normalizeAddressToken(barangayRaw);
        
        console.log(`[Generic] Part[0] classification:`);
        console.log(`[Generic]   raw="${barangayRaw}"`);
        console.log(`[Generic]   normalized="${barangayNormalized}"`);
        console.log(`[Generic]   isLikelyBarangay(normalized)=${isLikelyBarangay(barangayNormalized)}`);
        
        // Validate it's actually a barangay
        if (isLikelyBarangay(barangayNormalized)) {
          addressBarangay = barangayNormalized;
          console.log(`[Generic] ✅ BARANGAY FOUND: "${barangayRaw}" → "${addressBarangay}"`);
        } else {
          console.log(`[Generic] ⊘ First part doesn't look like barangay: "${barangayRaw}"`);
          console.log(`[Generic]   BARANGAY_KEYWORDS check: ${BARANGAY_KEYWORDS.some(kw => barangayNormalized.toUpperCase().includes(kw))}`);
          console.log(`[Generic]   Word count: ${barangayNormalized.split(/\s+/).length}, Length: ${barangayNormalized.length}`);
        }
        
        // Second part = City/Municipality (normalize then validate)
        let cityRaw = cleanField(parts[1]);
        // Remove "(CAPITAL)" or similar annotations
        cityRaw = cityRaw.replace(/\([^)]*\)/g, '').trim();
        // Replace corrupted city keyword with proper text
        cityRaw = cityRaw.replace(/cry$/i, 'city').replace(/citv$/i, 'city').replace(/citi$/i, 'city');
        let cityNormalized = normalizeAddressToken(cityRaw);
        
        console.log(`[Generic] Part[1] classification:`);
        console.log(`[Generic]   raw="${parts[1]}"`);
        console.log(`[Generic]   cleaned="${cityRaw}"`);
        console.log(`[Generic]   normalized="${cityNormalized}"`);
        console.log(`[Generic]   isLikelyCityOrMunicipality(normalized)=${isLikelyCityOrMunicipality(cityNormalized)}`);
        
        if (isLikelyCityOrMunicipality(cityNormalized)) {
          addressCityMunicipality = cityNormalized;
          console.log(`[Generic] ✅ CITY FOUND: "${cityRaw}" → "${addressCityMunicipality}"`);
        } else {
          console.log(`[Generic] ⊘ Part doesn't look like city: "${cityRaw}"`);
          console.log(`[Generic]   Keyword check (CITY): ${cityNormalized.toUpperCase().includes('CITY')}`);
          console.log(`[Generic]   Known cities check: ${KNOWN_CITIES.some(city => cityNormalized.toUpperCase().includes(city))}`);
        }
      }
    } else if (hasDelimiter || hasCityKeyword) {
      console.log(`[Generic] ⊘ Pattern 1 not matched: hasDelimiter=${hasDelimiter}, hasCityKeyword=${hasCityKeyword}`);
    }
    
    // Pattern 2: PROVINCE, ZIPCODE format
    // Example: "8ATANGA5, 4200" → "BATANGAS, 4200"
    // Don't match if line has city keyword (corrupted or not)
    if (line.includes(',') && !hasCorruptedCityKeyword(line) && line.match(/,\s*\d{4,}/)) {
      console.log(`[Generic] 🔍 Pattern 2 matched (PROVINCE, ZIPCODE format)`);
      const parts = line.split(',').map(p => p.trim());
      
      if (parts.length >= 2) {
        let provinceRaw = cleanField(parts[0]);
        let provinceNormalized = normalizeAddressToken(provinceRaw);
        
        console.log(`[Generic] Province candidate: raw="${provinceRaw}" → normalized="${provinceNormalized}"`);
        
        if (isLikelyProvince(provinceNormalized)) {
          addressProvince = provinceNormalized;
          
          // Auto-populate region based on province mapping
          const provinceUpper = provinceNormalized.toUpperCase();
          addressRegion = PROVINCE_TO_REGION[provinceUpper] || '';
          
          // Extract zipcode (digits after comma)
          const zipMatch = line.match(/,\s*(\d{4,})/);
          if (zipMatch) {
            const zipcode = zipMatch[1];
            console.log(`[Generic] ✅ PROVINCE+ZIPCODE FOUND: "${provinceRaw}" → "${addressProvince}", zipcode="${zipcode}"`);
            if (addressRegion) {
              console.log(`[Generic] ✅ REGION AUTO-POPULATED: "${provinceNormalized}" → "${addressRegion}"`);
            }
          }
        } else {
          console.log(`[Generic] ⊘ Doesn't look like province: "${provinceRaw}"`);
        }
      }
    }
    
    // Pattern 3: Lines with province keywords (if patterns 1&2 didn't match)
    // BUT: Don't match if line contains barangay, city (including corrupted), or other address keywords
    if (!addressProvince && !hasCorruptedCityKeyword(line) && !upper.includes('BARANGAY') && !upper.includes('BRGY') && isLikelyProvince(line)) {
      console.log(`[Generic] 🔍 Pattern 3 matched (line looks like province, no city keywords)`);
      let provinceRaw = cleanField(line);
      let provinceNormalized = normalizeAddressToken(provinceRaw);
      
      console.log(`[Generic] Province candidate: raw="${provinceRaw}" → normalized="${provinceNormalized}"`);
      
      if (provinceNormalized.length > 3) {
        addressProvince = provinceNormalized;
        
        // Auto-populate region based on province mapping
        const provinceUpper = provinceNormalized.toUpperCase();
        addressRegion = PROVINCE_TO_REGION[provinceUpper] || '';
        
        console.log(`[Generic] ✅ PROVINCE FOUND: "${provinceRaw}" → "${addressProvince}"`);
        if (addressRegion) {
          console.log(`[Generic] ✅ REGION AUTO-POPULATED: "${provinceNormalized}" → "${addressRegion}"`);
        } else {
          console.log(`[Generic] ⚠️ No region mapping found for province: "${provinceNormalized}"`);
        }
      }
    }
  }

  // Build generic address from parts if structured extraction worked
  if (addressBarangay || addressCityMunicipality || addressProvince) {
    const parts = [];
    if (addressBarangay) parts.push(addressBarangay);
    if (addressCityMunicipality) parts.push(addressCityMunicipality);
    if (addressProvince) parts.push(addressProvince);
    address = parts.join(', ');
    console.log(`[Generic] 📍 FULL ADDRESS COMPOSED: "${address}"`);
  }

  if (!address && !addressBarangay && !addressCityMunicipality && !addressProvince) {
    console.log(`[Generic] ⚠️ No address components found`);
  }

  // Ensure addressHouseNo is only set if valid
  // Do NOT place city/province names there
  if (addressHouseNo && !isValidHouseNumber(addressHouseNo)) {
    console.log(`[Generic] ⚠️ Rejecting invalid house_no: "${addressHouseNo}" - doesn't match house number pattern`);
    addressHouseNo = '';
  }

  console.log(`[Generic] ==================== GENERIC PARSER END ====================`);
  console.log(`[Generic] FINAL VALUES TO RETURN:`);
  console.log(`  firstName: "${firstName}"`);
  console.log(`  lastName: "${lastName}"`);
  console.log(`  address: "${address}"`);
  console.log(`  addressBarangay: "${addressBarangay}"`);
  console.log(`  addressCityMunicipality: "${addressCityMunicipality}"`);
  console.log(`  addressProvince: "${addressProvince}"`);
  console.log(`  addressRegion: "${addressRegion}"`);
  console.log(`  addressStreet: "${addressStreet}"`);
  console.log(`  addressHouseNo: "${addressHouseNo}"`);
  console.log(`[Generic] ====================\n`);

  return { 
    firstName, 
    lastName, 
    address,
    addressBarangay,
    addressCityMunicipality,
    addressProvince,
    addressRegion,
    addressStreet,
    addressHouseNo,
  };
}

/**
 * Main parseIDText function
 * Routes to appropriate parser based on ID type detection
 */
export function parseIDText(rawOcrText: string): ParsedIDData {
  console.log('\n\n========== ID PARSING STARTED ==========\n');
  
  // STEP 1: Detect ID type
  const detectionResult = detectIdType(rawOcrText);
  console.log(`\n📋 Detected ID Type: ${detectionResult.type} (${detectionResult.confidence})`);
  
  // STEP 2: Prepare for parsing - split into lines
  const lines = rawOcrText.trim().split('\n').map(l => l.trim());
  console.log(`\n📋 Text split into ${lines.length} lines`);
  
  // STEP 3: Route to parser based on ID type (for now, use generic)
  // In the future, each type can have its own optimized parser
  const parserResult = parseGenericID(lines);
  
  // STEP 4: Use individual address components from parseGenericID
  // parseGenericID already extracts and auto-populates region, so use those components directly
  // Fallback to parseAddressComponents only if individual components are empty
  let addressComponents = {
    addressHouseNo: parserResult.addressHouseNo || '',
    addressStreet: parserResult.addressStreet || '',
    addressBarangay: parserResult.addressBarangay || '',
    addressCityMunicipality: parserResult.addressCityMunicipality || '',
    addressProvince: parserResult.addressProvince || '',
    addressRegion: parserResult.addressRegion || '',
  };
  
  // Only parse combined address string if no individual components were extracted
  if (!addressComponents.addressBarangay && !addressComponents.addressCityMunicipality && !addressComponents.addressProvince) {
    const fallback = parseAddressComponents(parserResult.address || '');
    addressComponents.addressHouseNo = addressComponents.addressHouseNo || fallback.addressHouseNo || '';
    addressComponents.addressStreet = addressComponents.addressStreet || fallback.addressStreet || '';
    addressComponents.addressBarangay = addressComponents.addressBarangay || fallback.addressBarangay || '';
    addressComponents.addressCityMunicipality = addressComponents.addressCityMunicipality || fallback.addressCityMunicipality || '';
    addressComponents.addressProvince = addressComponents.addressProvince || fallback.addressProvince || '';
    addressComponents.addressRegion = addressComponents.addressRegion || fallback.addressRegion || '';
  }
  
  // STEP 5: Determine confidence
  const extractedFields = [];
  if (parserResult.firstName) extractedFields.push('firstName');
  if (parserResult.lastName) extractedFields.push('lastName');
  if (parserResult.address) extractedFields.push('address');
  
  let confidence: 'high' | 'medium' | 'low' = 'low';
  if (extractedFields.length === 3 && detectionResult.confidence === 'high') {
    confidence = 'high';
  } else if (extractedFields.length >= 2) {
    confidence = 'medium';
  } else {
    confidence = 'low';
  }
  
  console.log(`\n✅ Parsing complete:`);
  console.log(`   firstName: "${parserResult.firstName}"`);
  console.log(`   lastName: "${parserResult.lastName}"`);
  console.log(`   address: "${parserResult.address}"`);
  console.log(`   addressComponents extracted from parseGenericID:`);
  console.log(`     addressBarangay: "${addressComponents.addressBarangay}"`);
  console.log(`     addressCityMunicipality: "${addressComponents.addressCityMunicipality}"`);
  console.log(`     addressProvince: "${addressComponents.addressProvince}"`);
  console.log(`     addressRegion: "${addressComponents.addressRegion}"`);
  console.log(`   confidence: ${confidence}`);
  console.log('========== ID PARSING COMPLETED ==========\n\n');
  
  return {
    firstName: normalizeOCRName(parserResult.firstName || ''),
    lastName: normalizeOCRName(parserResult.lastName || ''),
    address: parserResult.address || '',
    addressHouseNo: addressComponents.addressHouseNo,
    addressStreet: addressComponents.addressStreet,
    addressBarangay: addressComponents.addressBarangay,
    addressCityMunicipality: addressComponents.addressCityMunicipality,
    addressProvince: addressComponents.addressProvince,
    addressRegion: addressComponents.addressRegion,
    confidence,
    detectedIdType: detectionResult.type,
    rawOcrText,
  };
}

/**
 * Validate if parsed data is acceptable (at least 1 field extracted)
 */
export function validateParsedData(data: ParsedIDData): boolean {
  const hasFirstName = !!(data.firstName && data.firstName.trim());
  const hasLastName = !!(data.lastName && data.lastName.trim());
  const hasAddress = !!(data.address && data.address.trim());
  
  const hasAnyField = hasFirstName || hasLastName || hasAddress;
  
  console.log(`\n[Validation] Checking parsed data:`);
  console.log(`   firstName present: ${hasFirstName}`);
  console.log(`   lastName present: ${hasLastName}`);
  console.log(`   address present: ${hasAddress}`);
  console.log(`   At least 1 field extracted: ${hasAnyField}`);
  
  return hasAnyField;
}

/**
 * Format parsed data for display
 */
export function formatParsedData(data: ParsedIDData): ParsedIDData {
  return {
    firstName: cleanField(data.firstName),
    lastName: cleanField(data.lastName),
    address: cleanField(data.address),
    addressHouseNo: normalizeAddressToken(cleanField(data.addressHouseNo || '')),
    addressStreet: normalizeAddressToken(cleanField(data.addressStreet || '')),
    addressBarangay: normalizeAddressToken(cleanField(data.addressBarangay || '')),
    addressCityMunicipality: normalizeAddressToken(cleanField(data.addressCityMunicipality || '')),
    addressProvince: normalizeAddressToken(cleanField(data.addressProvince || '')),
    addressRegion: normalizeAddressToken(cleanField(data.addressRegion || '')),
    confidence: data.confidence,
    detectedIdType: data.detectedIdType,
  };
}

/**
 * Get confidence message for display
 */
export function getConfidenceMessage(confidence: 'high' | 'medium' | 'low'): string {
  const messages = {
    high: 'High confidence extraction - data was read accurately',
    medium: 'Medium confidence extraction - please verify fields',
    low: 'Low confidence extraction - please review and correct',
  };
  return messages[confidence];
}
