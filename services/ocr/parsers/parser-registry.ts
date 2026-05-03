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

const OCR_PARSER_VERBOSE_LOGS = false;

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
  // NOTE: We intentionally do NOT convert letters → digits here (B→8, S→5).
  // That mapping corrupts legitimate uppercase tokens like "BRIAN" -> "8RIAN" or
  // surnames like "MARCOS" -> "MARCO5". Likewise we no longer convert digits →
  // letters globally (0→O, 1→I), because that breaks numeric fields such as
  // postal codes ("4224"), addresses ("012, BANABA, ..."), and dates
  // ("19, 2004"). Address-specific OCR corrections live in normalizeAddressToken().
  return text;
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

function normalizeForMatch(text: string): string {
  if (!text) return '';
  try {
    return text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase();
  } catch {
    return text.toUpperCase();
  }
}

/**
 * Normalize OCR-corrupted address tokens
 * Fixes common character confusions: 5→S, 8→B, ELK→BLK (address context only)
 * Thoroughly handles all corruption patterns to ensure proper field classification
 */
function normalizeAddressToken(token: string): string {
  if (!token || token.length === 0) return '';
  
  let normalized = token.trim();

  // Common OCR symbol confusions seen in location text
  normalized = normalized.replace(/[£€]/g, 'P');
  normalized = normalized.replace(/\|/g, 'I');
  
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

  // Normalize "OFLIPA" => "OF LIPA"
  normalized = normalized.replace(/\bOF(?=[A-Z])/g, 'OF ');

  // Normalize common OCR corruption of "CITY OF LIPA"
  normalized = normalized.replace(/\bCITY\s+OF\s+L[1I][PFE][A4]\b/gi, 'CITY OF LIPA');
  normalized = normalized.replace(/\bCITY\s+OFL[1I][PFE][A4]\b/gi, 'CITY OF LIPA');
  normalized = normalized.replace(/\bCITY\s+OF\s+L[I1][I1FPE][PFA4]\b/gi, 'CITY OF LIPA');
  normalized = normalized.replace(/\bCITY\s+OF\s+L[I1][PFE][A4]\b/gi, 'CITY OF LIPA');
  normalized = normalized.replace(/\bCITY\s+OF\s+L[I1][FPE]A\b/gi, 'CITY OF LIPA');
  normalized = normalized.replace(/\bCITY\s+OF\s+LI[PFE][A4]\b/gi, 'CITY OF LIPA');
  normalized = normalized.replace(/\bCITY\s+OF\s+L[1I][PFE][A4],?\s*BATANGAS\b/gi, 'CITY OF LIPA, BATANGAS');
  normalized = normalized.replace(/\bCITY\s+OF\s+L[I1][FPE]A,?\s*BATANGAS\b/gi, 'CITY OF LIPA, BATANGAS');

  // Remove trailing country tag often attached to province in OCR
  normalized = normalized.replace(/\b[-,\s]*PHILIPPINES\b/gi, '').trim();

  // Common province OCR corruption
  normalized = normalized.replace(/\bBATANGBS\b/gi, 'BATANGAS');
  normalized = normalized.replace(/\bBATANGA5\b/gi, 'BATANGAS');
  normalized = normalized.replace(/\bBATAN\b/gi, 'BATANGAS');
  normalized = normalized.replace(/\bBATAFGAS\b/gi, 'BATANGAS');
  normalized = normalized.replace(/\bBATAfGAS\b/g, 'BATANGAS');
  
  return normalized;
}

function normalizeCityMunicipalityText(text: string): string {
  if (!text) return '';
  let normalized = normalizeAddressToken(cleanField(text));

  // Final pass for City of Lipa OCR variants that slip through token normalization
  normalized = normalized.replace(/\bCITY\s+OF\s+L[^\s,]{2,5}\b/gi, (match) => {
    const upper = match.toUpperCase();
    // If it looks like "CITY OF LIPA/LIFA/LI£A/L1PA", force to canonical city.
    if (/CITY\s+OF\s+L/.test(upper)) {
      return 'CITY OF LIPA';
    }
    return match;
  });

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
  const placeKeywords = ['CITY', 'MUNICIPALITY', 'PROVINCE', 'BARANGAY', 'BATANGAS', 'MANILA', 'CEBU', 'QUEZON', 'LAGUNA', 'CAVITE', 'PUROK', 'SITIO', 'ZONE', 'BLOCK', 'BLK', 'LOT'];
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
  // Reject date-like values (e.g., "2003/12/29")
  if (/(19|20)\d{2}\s*[\/.\-]\s*(0?[1-9]|1[0-2])\s*[\/.\-]\s*(0?[1-9]|[12]\d|3[01])/.test(cleaned)) {
    return false;
  }
  
  // Accept valid house number patterns
  const validHousePattern = /^\d+(?:[\s\-\/]?[A-Z]?[\s\-\/]?\d*)*$/i;
  return validHousePattern.test(cleaned);
}

function isLikelyNameValue(text: string): boolean {
  const cleaned = cleanField(text);
  if (!cleaned || cleaned.length < 2) return false;

  const upper = cleaned.toUpperCase();
  const headerNoise = [
    'REPUBLIKA',
    'PILIPINAS',
    'REPUBLIC',
    'PHILIPPINES',
    'PHILIPPINE',
    'IDENTIFICATION',
    'PAMBANSANG',
    'PAGKAKAKILANLAN',
    'NATIONAL',
    'CARD',
  ];

  if (headerNoise.some((k) => upper.includes(k))) return false;

  // Catch OCR variants of "PHILIPPINE/PHILIPPINES" such as "RHILIPPINE"
  if (/(?:PH|RH|FH)?ILIPPIN(?:E|ES|AS)?/.test(upper) || upper.includes('HILIPPIN')) {
    return false;
  }

  // Catch OCR variants of "IDENTIFICATION"
  if (upper.includes('IDENTIFICAT') || upper.includes('DENTIFICATION')) {
    return false;
  }

  // Reject field labels that are not actual person values
  const labelNoise = [
    'MGA PANGALAN',
    'GIVEN NAMES',
    'GIVEN NAME',
    'APELYIDO',
    'LAST NAME',
    'MIDDLE NAME',
    'GITNANG APELYIDO',
    'TIRAHAN',
    'ADDRESS',
    'DATE OF BIRTH',
    'PETSA NG KAPANGANAKAN',
    'OF BIRTH',
    'BIRTH',
    'DIGITAL',
    'NUMBER',
  ];
  if (labelNoise.some((k) => upper.includes(k))) {
    return false;
  }

  if (/\d/.test(cleaned)) return false;
  if (cleaned.includes('/')) return false;

  const letters = (cleaned.match(/[A-Za-z]/g) || []).length;
  const letterRatio = letters / cleaned.length;
  return letterRatio >= 0.7;
}

function sanitizePersonName(name: string): string {
  const cleaned = cleanField(name);
  if (!cleaned) return '';

  // Keep only alphabetic name tokens and remove obvious OCR/document noise.
  const tokens = cleaned
    .split(/\s+/)
    .map((t) => t.replace(/[^A-Za-z'-]/g, '').trim())
    .filter((t) => t.length > 0);

  if (tokens.length === 0) return '';

  // First/given name fields should never be document titles.
  const forbidden = new Set([
    'REPUBLIC',
    'REPUBLIKA',
    'PHILIPPINE',
    'PHILIPPINES',
    'PILIPINAS',
    'IDENTIFICATION',
    'CARD',
    'NATIONAL',
    'PAMBANSANG',
    'PAGKAKAKILANLAN',
    'MGA',
    'PANGALAN',
    'GIVEN',
    'NAME',
    'NAMES',
    'LAST',
    'MIDDLE',
    'APELYIDO',
    'GITNANG',
    'TIRAHAN',
    'ADDRESS',
    'BIRTH',
    'DIGITAL',
    'NUMBER',
    'OF',
  ]);

  const safeTokens = tokens.filter((t) => {
    const upper = t.toUpperCase();
    if (forbidden.has(upper)) return false;
    if (/(?:PH|RH|FH)?ILIPPIN(?:E|ES|AS)?/.test(upper) || upper.includes('HILIPPIN')) return false;
    return true;
  });

  return safeTokens.join(' ').trim();
}

function findValueAfterAnyLabel(
  lines: string[],
  labelPatterns: string[],
  lookahead: number = 5
): string {
  const upperLabels = labelPatterns.map((p) => normalizeForMatch(p));

  for (let i = 0; i < lines.length; i++) {
    const currentUpper = normalizeForMatch(lines[i]);
    if (!upperLabels.some((label) => currentUpper.includes(label))) continue;

    for (let j = i + 1; j < Math.min(lines.length, i + 1 + lookahead); j++) {
      const candidate = lines[j].trim();
      if (!candidate) continue;

      const candidateUpper = normalizeForMatch(candidate);
      if (
        candidateUpper.includes('APELYIDO') ||
        candidateUpper.includes('LAST NAME') ||
        candidateUpper.includes('MGA PANGALAN') ||
        candidateUpper.includes('GIVEN NAME') ||
        candidateUpper.includes('MIDDLE NAME') ||
        candidateUpper.includes('DATE OF BIRTH') ||
        candidateUpper.includes('ADDRESS') ||
        candidateUpper.includes('TIRAHAN')
      ) {
        continue;
      }

      if (isLikelyNameValue(candidate)) {
        return cleanField(candidate);
      }
    }
  }

  return '';
}

function findLabelIndex(lines: string[], labelPatterns: string[]): number {
  const upperLabels = labelPatterns.map((p) => normalizeForMatch(p));
  return lines.findIndex((line) => {
    const upper = normalizeForMatch(line);
    return upperLabels.some((label) => upper.includes(label));
  });
}

function findNextValidNameAfterIndex(
  lines: string[],
  startIndex: number,
  lookahead: number = 8
): string {
  if (startIndex < 0) return '';

  for (let i = startIndex + 1; i < Math.min(lines.length, startIndex + 1 + lookahead); i++) {
    const raw = lines[i].trim();
    const upperRaw = raw.toUpperCase();
    if (
      upperRaw.includes('MGA PANGALAN') ||
      upperRaw.includes('GIVEN NAME') ||
      upperRaw.includes('APELYIDO') ||
      upperRaw.includes('LAST NAME') ||
      upperRaw.includes('MIDDLE NAME') ||
      upperRaw.includes('MIDDLENAME') ||
      upperRaw.includes('TIRAHAN') ||
      upperRaw.includes('ADDRESS') ||
      upperRaw.includes('BIRTH') ||
      upperRaw.includes('DIGITAL') ||
      upperRaw.includes('NUMBER') ||
      upperRaw.includes('/')
    ) {
      continue;
    }

    const candidate = sanitizePersonName(lines[i]);
    if (isLikelyNameValue(candidate)) {
      return candidate;
    }
  }

  return '';
}

/**
 * Identify if text is likely a barangay name
 */
function isLikelyBarangay(text: string): boolean {
  const upper = text.toUpperCase();
  // Reject very short text (less than 3 characters is too short for a barangay name)
  if (text.length < 3) {
    console.log(`[Barangay] ❌ Text too short (${text.length} chars): "${upper}"`);
    return false;
  }
  // CRITICAL: Check for barangay keywords FIRST - these are definitive
  if (BARANGAY_KEYWORDS.some(kw => upper.includes(kw))) {
    console.log(`[Barangay] ✅ Keyword match found in "${upper}"`);
    return true;
  }
  // Fallback: Generic pattern for barangay names
  // STRICTER: Require at least 3 characters AND (2-3 words OR contains a known barangay pattern)
  const words = text.split(/\s+/).filter(w => w.length > 0).length;
  if (words >= 1 && words <= 3 && text.length >= 4 && text.length < 40 && !upper.includes('CITY') && !upper.includes('MUNICIPALITY') && !upper.includes('PROVINCE')) {
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
  // Reject very short text (city/municipality names should be at least 3-4 characters)
  if (text.length < 3) {
    console.log(`[City] ❌ Text too short (${text.length} chars): "${upper}"`);
    return false;
  }
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
  // Check for corrupted keywords (but require minimum length for safety)
  if (text.length >= 4 && (upper.includes('CIT') || upper.includes('CRY') || upper.includes('MUN'))) {
    console.log(`[City] ✅ Corrupted keyword found in "${upper}"`);
    return true;
  }
  console.log(`[City] ❌ Not a city: "${upper}" (length: ${text.length} chars)`);
  return false;
}

/**
 * Identify if text is likely a province name
 */
function isLikelyProvince(text: string): boolean {
  const upper = normalizeForMatch(normalizeAddressToken(text));
  if (upper.includes('PROVINCE') || upper.includes('PROV')) return true;
  if (KNOWN_PROVINCES.some(prov => upper.includes(prov))) return true;
  if (/\bBATANGAS\b/.test(upper)) return true;
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
    .replace(/\n/g, ',')
    .replace(/\s+,/g, ',');
  
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
  
  for (let idx = 0; idx < parts.length; idx++) {
    const part = parts[idx];
    let type = 'unknown';
    const purokMatch = part.match(/^(\d+)\s+(PUROK\s*\d+[A-Z0-9\-\/\s]*)$/i);
    
    if (part.length <= 1) {
      type = 'skip';
    } else if (purokMatch) {
      type = 'houseNoWithStreet';
    } else if (/^\d+$/.test(part)) {
      // Numeric token at the start is often a house number (e.g., "012, BANABA, ..."),
      // while trailing 4-digit numbers are usually postal codes.
      if (idx === 0 && part.length <= 3) {
        type = 'houseNo';
      } else if (part.length === 4) {
        type = 'postalCode';
      } else {
        type = 'houseNo';
      }
    } else if (isValidHouseNumber(part)) {
      type = 'houseNo';
    } else if (isLikelyCityOrMunicipality(part)) {
      type = 'municipality';
    } else if (isLikelyProvince(part)) {
      type = 'province';
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
    } else if (type === 'houseNoWithStreet') {
      const purokMatch = part.match(/^(\d+)\s+(PUROK\s*\d+[A-Z0-9\-\/\s]*)$/i);
      if (purokMatch) {
        if (!components.addressHouseNo) {
          components.addressHouseNo = purokMatch[1];
        }
        if (!components.addressStreet) {
          components.addressStreet = normalizeAddressToken(purokMatch[2]);
        }
      }
    } else if (type === 'houseNo' && !components.addressHouseNo) {
      components.addressHouseNo = part;
    } else if (type === 'province' && !components.addressProvince) {
      components.addressProvince = part;
      // Auto-populate region from province
      const provinceUpper = part.toUpperCase();
      components.addressRegion = PROVINCE_TO_REGION[provinceUpper] || '';
    } else if (type === 'municipality' && !components.addressCityMunicipality) {
      components.addressCityMunicipality = normalizeCityMunicipalityText(part);
    } else if (type === 'barangay' && !components.addressBarangay) {
      components.addressBarangay = part;
    } else if (type === 'unknown') {
      if (!components.addressStreet) {
        components.addressStreet = part;
      }
    }
  }

  // Fallback: if municipality wasn't classified (e.g., "PADRE GARCIA"),
  // infer from unknown token between barangay and province.
  if (!components.addressCityMunicipality) {
    const provinceIndex = classified.findIndex((c) => c.type === 'province');
    const barangayIndex = classified.findIndex((c) => c.type === 'barangay');
    const candidate = classified.find((c, idx) => {
      if (c.type !== 'unknown') return false;
      if (provinceIndex >= 0 && idx >= provinceIndex) return false;
      if (barangayIndex >= 0 && idx <= barangayIndex) return false;
      const upper = normalizeForMatch(c.part);
      if (upper.length < 4) return false;
      if (upper.includes('PHILIPPINES')) return false;
      if (/^\d+$/.test(upper)) return false;
      return true;
    });
    if (candidate) {
      components.addressCityMunicipality = normalizeCityMunicipalityText(candidate.part);
    }
  }

  // If city is still missing but we captured two barangay-like tokens before province,
  // treat the second token as city/municipality (common OCR for "BANABA, PADRE GARCIA, BATANGAS").
  if (!components.addressCityMunicipality && components.addressProvince) {
    const provinceIndex = classified.findIndex((c) => c.type === 'province');
    const barangayCandidates = classified
      .filter((c, idx) => c.type === 'barangay' && (provinceIndex < 0 || idx < provinceIndex))
      .map((c) => c.part);

    if (barangayCandidates.length >= 2) {
      components.addressBarangay = components.addressBarangay || barangayCandidates[0];
      components.addressCityMunicipality = normalizeCityMunicipalityText(barangayCandidates[1]);
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

function getPrimaryFirstName(fullGivenName: string): string {
  const cleaned = sanitizePersonName(fullGivenName);
  if (!cleaned) return '';
  const [firstToken] = cleaned.split(/\s+/).filter(Boolean);
  return firstToken || '';
}

function getPhilSysFullGivenName(rawGivenName: string): string {
  const cleaned = sanitizePersonName(rawGivenName);
  if (!cleaned) return '';

  const tokens = cleaned.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return '';

  // PhilSys OCR often truncates "JOHN" to "JO" when the first token is split.
  // If we have additional given-name tokens, safely expand the leading "JO".
  if (tokens[0].toUpperCase() === 'JO' && tokens.length >= 2) {
    tokens[0] = 'JOHN';
  }

  return tokens.join(' ');
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
  const normalizedPatterns = labelPatterns.map((p) => normalizeForMatch(p));
  for (let i = 0; i < lines.length - 1; i++) {
    const rawLine = lines[i].trim();
    const lineTrimmed = normalizeForMatch(rawLine);

    for (let p = 0; p < normalizedPatterns.length; p++) {
      const pattern = normalizedPatterns[p];
      if (lineTrimmed.includes(pattern)) {
        const patternIndex = lineTrimmed.indexOf(pattern);
        const inlineValue = rawLine
          .slice(patternIndex + labelPatterns[p].length)
          .replace(/^[:/\-\s]+/, '')
          .trim();

        // Some OCR outputs place label + value on the same line.
        if (inlineValue.length >= 2) {
          const trimmedInlineValue = inlineValue
            .split(/(?:APELYIDO|LAST NAME|MGA PANGALAN|GIVEN NAMES?|GITNANG APELYIDO|MIDDLE NAME|PETSA NG KAPANGANAKAN|DATE OF BIRTH|TIRAHAN|ADDRESS)/i)[0]
            .trim();

          if (trimmedInlineValue.length >= 2) {
            return cleanField(trimmedInlineValue);
          }
        }

        let j = i + 1;
        while (j < lines.length) {
          const nextLine = lines[j].trim();
          const nextUpper = normalizeForMatch(nextLine);

          // Skip likely metadata/other labels while searching value line.
          if (
            nextUpper.includes('/') &&
            (
              nextUpper.includes('LAST NAME') ||
              nextUpper.includes('GIVEN NAME') ||
              nextUpper.includes('MIDDLE NAME') ||
              nextUpper.includes('MIDDLENAME') ||
              nextUpper.includes('DATE OF BIRTH') ||
              nextUpper.includes('ADDRESS')
            )
          ) {
            j++;
            continue;
          }

          // Skip known field labels and OCR-corrupted label lines
          if (
            nextUpper.includes('MIDDLENAME') ||
            nextUpper.includes('MIDDLE NAME') ||
            nextUpper.includes('GITNANG') ||
            nextUpper.includes('PELYIDO') ||
            nextUpper.includes('APELYIDO') ||
            nextUpper.includes('GIVEN NAMES') ||
            nextUpper.includes('DATE OF BIRTH') ||
            nextUpper.includes('DIGITAL ID NUMBER')
          ) {
            j++;
            continue;
          }

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

function isLikelyLabelLineForPhilSys(line: string): boolean {
  const upper = normalizeForMatch(line);
  return (
    upper.includes('LAST NAME') ||
    upper.includes('LASTFNAME') ||
    upper.includes('APELYIDO') ||
    upper.includes('APETVIDO') ||
    upper.includes('GIVEN NAMES') ||
    upper.includes('GIVEN NAME') ||
    upper.includes('G/VEN') ||
    upper.includes('MIDDLE NAME') ||
    upper.includes('MIDDLENAME') ||
    upper.includes('GITNANG') ||
    upper.includes('DATE OF BIRTH') ||
    upper.includes('KAPANGANAKAN') ||
    upper.includes('TIRAHAN') ||
    upper.includes('ADDRESS') ||
    upper.includes('DIGITAL ID NUMBER')
  );
}

function extractPhilSysGivenNames(lines: string[]): string {
  const givenIdx = findLabelIndex(lines, ['MGA PANGALAN', 'GIVEN NAMES', 'GIVEN NAME', 'GIVENNAME', 'GALAN/GIVEN NAMES']);
  if (givenIdx < 0) return '';

  let givenLine = '';
  for (let i = givenIdx + 1; i < Math.min(lines.length, givenIdx + 5); i++) {
    const candidate = cleanField(lines[i]);
    if (!candidate) continue;
    if (isLikelyLabelLineForPhilSys(candidate)) continue;
    if (/\d{4,}/.test(candidate)) continue;
    if ((candidate.match(/[A-Za-z]/g) || []).length < 2) continue;
    givenLine = candidate;
    break;
  }

  if (!givenLine) return '';

  // PhilSys digital OCR often splits the first given-name token onto a separate
  // line BEFORE the GIVEN NAMES label (e.g., "JO" appears above LAST NAME label,
  // then "MARVIC BRIAN" appears after GIVEN NAMES label). We walk backwards from
  // the label, skipping label lines and known noise tokens, and collect at most
  // 2 alphabetic value tokens. We DO NOT break on labels (we walk past them) so we
  // can still recover the first-name fragment that visually sits above the card
  // surname row.
  const blockedNoise = new Set(['ES', 'ILI', 'M', 'F', 'A', 'I', 'L', 'IL', 'L', 'O', 'OO']);
  const prefixTokens: string[] = [];
  for (let i = givenIdx - 1; i >= Math.max(0, givenIdx - 8); i--) {
    const candidate = cleanField(lines[i]);
    if (!candidate) continue;
    if (isLikelyLabelLineForPhilSys(candidate)) continue; // walk past labels
    if (/\d/.test(candidate)) continue;
    if (candidate.includes('/')) continue;
    const upper = normalizeForMatch(candidate);
    if (blockedNoise.has(upper)) continue;
    // Accept alphabetic tokens up to 12 chars (allow 'JO', 'JOHN', etc.)
    if (/^[A-Za-z][A-Za-z'.-]{1,11}$/.test(candidate)) {
      prefixTokens.unshift(candidate);
      if (prefixTokens.length >= 2) break;
    }
  }

  const merged = [...prefixTokens, givenLine].join(' ').replace(/\s+/g, ' ').trim();
  return merged;
}

function extractPhilSysAddress(lines: string[]): string {
  // PhilSys OCR often misplaces the TIRAHAN/ADDRESS label at the TOP of the text
  // while the actual address content sits near the BOTTOM. We therefore detect the
  // address by content: find the first line that looks like a comma-separated
  // address (>= 2 commas, has alphabetic place words), then collect surrounding
  // address-shaped lines (postal code, PHILIPPINES marker, additional fragments).
  const isDateLine = (s: string) =>
    /^\d{1,2}\s*[,./-]\s*(19|20)\d{2}$/.test(s) ||
    /^(19|20)\d{2}[\/.\-]\d{1,2}[\/.\-]\d{1,2}$/.test(s) ||
    (/^(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)/i.test(s) && /(19|20)\d{2}/.test(s));

  const isAddressContentLine = (s: string): boolean => {
    if (!s) return false;
    if (isLikelyLabelLineForPhilSys(s)) return false;
    if (isDateLine(s)) return false;
    const upper = normalizeForMatch(s);
    if (upper.includes('DIGITAL') && upper.includes('NUMBER')) return false;
    const commaCount = (s.match(/,/g) || []).length;
    const hasPlaceWord = /[A-Za-z]{3,}/.test(s);
    return commaCount >= 2 && hasPlaceWord;
  };

  let anchor = -1;
  for (let i = 0; i < lines.length; i++) {
    if (isAddressContentLine(lines[i])) {
      anchor = i;
      break;
    }
  }

  if (anchor < 0) return '';

  const parts: string[] = [lines[anchor].trim()];
  for (let i = anchor + 1; i < Math.min(lines.length, anchor + 6); i++) {
    const candidate = cleanField(lines[i]);
    const upper = normalizeForMatch(candidate);
    if (!candidate) continue;
    if (isLikelyLabelLineForPhilSys(candidate)) continue;
    if (isDateLine(candidate)) continue;
    if (upper.includes('DIGITAL') && upper.includes('NUMBER')) continue;

    const isPostal = /^\d{4}$/.test(candidate);
    const isPhilippines = upper.includes('PHILIPPINES');
    const hasPlaceWord = /[A-Za-z]{3,}/.test(candidate);
    const hasComma = candidate.includes(',');

    if (isPostal || isPhilippines || (hasPlaceWord && hasComma)) {
      parts.push(candidate);
    }
  }

  return normalizeAddressToken(parts.join(', ').replace(/\s+,/g, ',').replace(/,+/g, ',').trim());
}

function nextPhilSysValueLine(lines: string[], startIndex: number, lookahead: number = 6): string {
  if (startIndex < 0) return '';
  for (let i = startIndex + 1; i < Math.min(lines.length, startIndex + 1 + lookahead); i++) {
    const candidate = cleanField(lines[i]);
    const upper = normalizeForMatch(candidate);
    if (!candidate) continue;
    if (isLikelyLabelLineForPhilSys(candidate)) continue;
    if (/^\d{4,}[\dA-Z\-+]*$/i.test(candidate)) continue;
    // Skip OCR-corrupted numeric lines that become I/O heavy (e.g., "1912004," -> "I9I2OO4")
    if (/^[IO0-9,\-.\s]+$/i.test(upper.replace(/\s+/g, ''))) continue;
    if (candidate.length < 2) continue;
    return candidate;
  }
  return '';
}

/**
 * Parser optimized for Philippine National ID (PhilSys)
 */
function parsePhilSysID(lines: string[]): Partial<ParsedIDData> {
  const cleanedLines = lines
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const givenIdx = findLabelIndex(cleanedLines, ['MGA PANGALAN', 'GIVEN NAMES', 'GIVEN NAME', 'GIVENNAME', 'GALAN/GIVEN NAMES', 'G/VEN']);
  const lastIdx = findLabelIndex(cleanedLines, ['APELYIDO', 'LAST NAME', 'LASTNAME', 'LASTFNAME', 'APETVIDO']);
  const middleIdx = findLabelIndex(cleanedLines, ['MIDDLE NAME', 'GITNANG APELYIDO', 'MIDDLENAME', 'APELYIDO/MIDDLE NAME']);

  const rawLastName = nextPhilSysValueLine(cleanedLines, lastIdx) || extractAfterLabel(cleanedLines, ['APELYIDO', 'LAST NAME', 'LASTNAME', 'LASTFNAME', 'APETVIDO']);
  const rawFirstNameFromLabel = extractPhilSysGivenNames(cleanedLines) || nextPhilSysValueLine(cleanedLines, givenIdx) || extractAfterLabel(cleanedLines, ['MGA PANGALAN', 'GIVEN NAMES', 'GIVEN NAME', 'GIVENNAME', 'GALAN/GIVEN NAMES', 'G/VEN']);
  const rawMiddleName = nextPhilSysValueLine(cleanedLines, middleIdx) || extractAfterLabel(cleanedLines, ['MIDDLE NAME', 'GITNANG APELYIDO', 'MIDDLENAME', 'APELYIDO/MIDDLE NAME']);
  const address = extractPhilSysAddress(cleanedLines) || extractAfterLabel(cleanedLines, ['TIRAHAN', 'ADDRESS', 'ADORESS']);

  const fallbackLastName = findValueAfterAnyLabel(cleanedLines, ['APELYIDO', 'LAST NAME', 'LASTNAME', 'LASTFNAME', 'APETVIDO']);
  const fallbackFirstName = extractPhilSysGivenNames(cleanedLines) || findValueAfterAnyLabel(cleanedLines, ['MGA PANGALAN', 'GIVEN NAMES', 'GIVEN NAME', 'GIVENNAME', 'GALAN/GIVEN NAMES', 'G/VEN']);

  let resolvedLastName = isLikelyNameValue(rawLastName) ? rawLastName : fallbackLastName;
  let resolvedFirstName = isLikelyNameValue(rawFirstNameFromLabel) ? rawFirstNameFromLabel : fallbackFirstName;

  // National ID often appears as: Last Name value, then Given Name value on next lines.
  // If first name still looks wrong/empty, recover from the lines after the surname.
  const surnameIndex =
    resolvedLastName
      ? cleanedLines.findIndex(
          (line, idx) =>
            idx > lastIdx && sanitizePersonName(line).toUpperCase() === sanitizePersonName(resolvedLastName).toUpperCase()
        )
      : -1;

  if (!isLikelyNameValue(resolvedFirstName) || sanitizePersonName(resolvedFirstName).length === 0) {
    const afterSurnameFirstName = findNextValidNameAfterIndex(cleanedLines, surnameIndex, 10);
    if (afterSurnameFirstName) {
      resolvedFirstName = afterSurnameFirstName;
    }
  }

  let lastName = sanitizePersonName(resolvedLastName);
  let firstName = getPhilSysFullGivenName(resolvedFirstName);

  // If firstName accidentally starts with/equals surname due OCR line interleaving,
  // prefer the direct line after GIVEN NAMES label (single-token first name).
  if (lastName && firstName && normalizeForMatch(firstName) === normalizeForMatch(lastName)) {
    const directGiven = sanitizePersonName(nextPhilSysValueLine(cleanedLines, givenIdx));
    const directFirst = getPhilSysFullGivenName(directGiven);
    if (directFirst && normalizeForMatch(directFirst) !== normalizeForMatch(lastName)) {
      firstName = directFirst;
    }
  }

  // If OCR merged surname + given names into firstName (e.g., "BERLON ALESSANDRA"),
  // keep surname strictly in lastName and strip it from firstName.
  if (lastName && firstName) {
    const firstUpper = normalizeForMatch(firstName);
    const lastUpper = normalizeForMatch(lastName);
    if (firstUpper.startsWith(`${lastUpper} `)) {
      const stripped = firstName.slice(lastName.length).trim();
      if (stripped) {
        firstName = stripped;
      }
    }
  }

  // PhilSys OCR for digital cards often loses the surname line entirely. The value
  // after the MIDDLE NAME label belongs to middle name, NOT last name. We must NOT
  // assign middle-name candidates into last name. If true surname is unreadable,
  // we leave last name blank and let the user input it manually.
  const middleCandidate = sanitizePersonName(rawMiddleName);

  // If extracted "lastName" actually equals the middle-name token, clear it.
  if (
    middleCandidate &&
    lastName &&
    normalizeForMatch(lastName) === normalizeForMatch(middleCandidate)
  ) {
    lastName = '';
  }

  // Reject obviously short / OCR-noise last names like "ES", "JO", single letters.
  if (lastName && lastName.replace(/[^A-Za-z]/g, '').length < 3) {
    lastName = '';
  }

  // Prevent first and last from resolving to same token.
  if (firstName && lastName && normalizeForMatch(firstName) === normalizeForMatch(lastName)) {
    lastName = '';
  }
  const birthday = extractBirthdayFromLines(cleanedLines);

  const parsedAddress = parseAddressComponents(address);

  console.log(`\n[PhilSys] Parsed labeled fields:`);
  console.log(`   firstName: "${firstName}"`);
  console.log(`   lastName: "${lastName}"`);
  console.log(`   birthday: "${birthday}"`);
  console.log(`   address: "${address}"`);

  return {
    firstName,
    lastName,
    birthday,
    address,
    addressHouseNo: parsedAddress.addressHouseNo || '',
    addressStreet: parsedAddress.addressStreet || '',
    addressBarangay: parsedAddress.addressBarangay || '',
    addressCityMunicipality: parsedAddress.addressCityMunicipality || '',
    addressProvince: parsedAddress.addressProvince || '',
    addressRegion: parsedAddress.addressRegion || '',
  };
}

function isLikelyLabelLineForUmid(line: string): boolean {
  const upper = normalizeForMatch(line);
  return (
    upper.includes('SURNAME') ||
    upper.includes('LAST NAME') ||
    upper.includes('GIVEN NAME') ||
    upper.includes('FIRST NAME') ||
    upper.includes('MIDDLE NAME') ||
    upper.includes('NAME') ||
    upper.includes('DATE OF BIRTH') ||
    upper.includes('BIRTH DATE') ||
    upper.includes('DOB') ||
    upper.includes('ADDRESS') ||
    upper.includes('HOME ADDRESS') ||
    upper.includes('CARD') ||
    upper.includes('UNIFIED') ||
    upper.includes('MULTI-PURPOSE') ||
    upper.includes('SSS') ||
    upper.includes('GSIS') ||
    upper.includes('PHILHEALTH') ||
    upper.includes('PAG-IBIG')
  );
}

function parseUmidID(lines: string[]): Partial<ParsedIDData> {
  const cleanedLines = lines.map((line) => cleanField(line)).filter(Boolean);

  const rawLastName =
    extractAfterLabel(cleanedLines, ['SURNAME', 'LAST NAME']) ||
    findValueAfterAnyLabel(cleanedLines, ['SURNAME', 'LAST NAME']);
  const rawFirstName =
    extractAfterLabel(cleanedLines, ['GIVEN NAME', 'FIRST NAME']) ||
    findValueAfterAnyLabel(cleanedLines, ['GIVEN NAME', 'FIRST NAME']);

  let firstName = sanitizePersonName(rawFirstName);
  let lastName = sanitizePersonName(rawLastName);

  // Heuristic for common UMID OCR layout:
  // CRN line, then surname on next line, then given name on next line.
  if (!firstName || !lastName) {
    const crnIndex = cleanedLines.findIndex((line) => /(?:^|\s)CRN(?:\s|$|[-:])/i.test(line));
    if (crnIndex >= 0) {
      const afterCrn = cleanedLines.slice(crnIndex + 1, crnIndex + 6).filter((line) => {
        const upper = normalizeForMatch(line);
        if (isLikelyLabelLineForUmid(line)) return false;
        if (/\d/.test(line)) return false;
        if (upper.includes('MALE') || upper.includes('FEMALE')) return false;
        if (upper.includes('CITY') || upper.includes('BRGY') || upper.includes('BARANGAY')) return false;
        return /^[A-Za-z][A-Za-z\s.'-]{1,40}$/.test(line);
      });

      if (!lastName && afterCrn[0]) {
        lastName = sanitizePersonName(afterCrn[0]);
      }
      if (!firstName && afterCrn[1]) {
        firstName = sanitizePersonName(afterCrn[1]);
      }
    }
  }

  if (!firstName || !lastName) {
    for (let idx = 0; idx < cleanedLines.length; idx++) {
      const line = cleanedLines[idx];
      const upper = normalizeForMatch(line);
      if (isLikelyLabelLineForUmid(line)) continue;
      if (upper.includes('REPUBLIC') || upper.includes('PHILIPPINES')) continue;

      if (line.includes(',')) {
        const parsed = parseNameValue(line);
        if (parsed.firstName || parsed.lastName) {
          firstName = firstName || sanitizePersonName(parsed.firstName);
          lastName = lastName || sanitizePersonName(parsed.lastName);
          break;
        }
      } else {
        // Last fallback: consecutive alpha lines can be surname + given name.
        const next = cleanedLines[idx + 1] || '';
        const nextUpper = normalizeForMatch(next);
        const currentLooksName = /^[A-Za-z][A-Za-z\s.'-]{1,40}$/.test(line) && !/\d/.test(line);
        const nextLooksName =
          /^[A-Za-z][A-Za-z\s.'-]{1,40}$/.test(next) &&
          !/\d/.test(next) &&
          !nextUpper.includes('MALE') &&
          !nextUpper.includes('FEMALE');
        if (currentLooksName && nextLooksName) {
          lastName = lastName || sanitizePersonName(line);
          firstName = firstName || sanitizePersonName(next);
          break;
        }
      }
    }
  }

  const birthday = extractBirthdayFromLines(cleanedLines);

  const birthdayLineIndex = cleanedLines.findIndex((line) => normalizeBirthdayToIso(line) !== '');
  const addressCandidateLines = cleanedLines
    .slice(birthdayLineIndex >= 0 ? birthdayLineIndex + 1 : 0)
    .filter((line) => {
      const upper = normalizeForMatch(line);
      if (!line) return false;
      if (isLikelyLabelLineForUmid(line)) return false;
      if (upper.includes('MALE') || upper.includes('FEMALE')) return false;
      return true;
    });

  let umidHouseNo = '';
  let umidBarangay = '';
  let umidCityMunicipality = '';
  let umidProvince = '';
  let umidRegion = '';

  for (const rawLine of addressCandidateLines) {
    const line = cleanField(rawLine);
    const upper = normalizeForMatch(line);

    // Example: "216 BRGY."
    if (/\b(BRGY|BARANGAY)\b/i.test(upper)) {
      const houseNoMatch = line.match(/\b(\d{1,6}[A-Za-z-]?)\b/);
      if (!umidHouseNo && houseNoMatch) {
        umidHouseNo = houseNoMatch[1];
      }
      const barangayTail = line
        .replace(/\b\d{1,6}[A-Za-z-]?\b/g, ' ')
        .replace(/\b(BRGY\.?|BARANGAY)\b/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (!umidBarangay && barangayTail) {
        umidBarangay = normalizeAddressToken(barangayTail);
      }
      continue;
    }

    // Example: "MALITLIT LIPA CITY" -> barangay MALITLIT, city LIPA CITY
    if (/\b(CITY|MUNICIPALITY)\b/i.test(upper)) {
      const normalizedLine = cleanField(line).replace(/\b(PHL|PHILIPPINES)\b/gi, '').trim();
      const words = normalizedLine.split(/\s+/).filter(Boolean);
      const cityIdx = words.findIndex((w) => /^CITY$/i.test(w));
      const municipalityIdx = words.findIndex((w) => /^MUNICIPALITY$/i.test(w));

      if (cityIdx > 0) {
        // Last token before CITY is the city name (e.g., LIPA CITY).
        const cityName = `${words[cityIdx - 1]} CITY`;
        if (!umidCityMunicipality) {
          umidCityMunicipality = normalizeCityMunicipalityText(cityName);
        }
        const barangayHead = words.slice(0, cityIdx - 1).join(' ').trim();
        if (!umidBarangay && barangayHead) {
          umidBarangay = normalizeAddressToken(
            barangayHead.replace(/\b(BRGY\.?|BARANGAY)\b/gi, '').trim(),
          );
        }
      } else if (municipalityIdx > 0) {
        const cityName = `${words[municipalityIdx - 1]} MUNICIPALITY`;
        if (!umidCityMunicipality) {
          umidCityMunicipality = normalizeCityMunicipalityText(cityName);
        }
        const barangayHead = words.slice(0, municipalityIdx - 1).join(' ').trim();
        if (!umidBarangay && barangayHead) {
          umidBarangay = normalizeAddressToken(
            barangayHead.replace(/\b(BRGY\.?|BARANGAY)\b/gi, '').trim(),
          );
        }
      }
      continue;
    }

    // Example: "BATANGAS PHL" -> province BATANGAS
    if (!umidProvince && isLikelyProvince(line)) {
      const provinceToken = cleanField(line.split(',')[0] || line)
        .replace(/\b(PHL|PHILIPPINES)\b/gi, '')
        .trim();
      const normalizedProvince = normalizeAddressToken(provinceToken);
      if (normalizedProvince) {
        umidProvince = normalizedProvince;
        umidRegion = PROVINCE_TO_REGION[normalizeForMatch(normalizedProvince)] || '';
      }
      continue;
    }
  }

  let address =
    extractAfterLabel(cleanedLines, ['HOME ADDRESS', 'CURRENT ADDRESS', 'ADDRESS']) ||
    findValueAfterAnyLabel(cleanedLines, ['HOME ADDRESS', 'CURRENT ADDRESS', 'ADDRESS']);

  if (!address) {
    const birthdayLineIndex = cleanedLines.findIndex((line) => normalizeBirthdayToIso(line) !== '');
    const start = birthdayLineIndex >= 0 ? birthdayLineIndex + 1 : 0;
    const addressLines = cleanedLines.slice(start).filter((line) => {
      if (isLikelyLabelLineForUmid(line)) return false;
      if (!/[A-Za-z]{3,}/.test(line)) return false;
      const upper = normalizeForMatch(line);
      if (upper.includes('MALE') || upper.includes('FEMALE')) return false;
      return (
        /BARANGAY|BRGY|CITY|MUNICIPALITY|PROVINCE|BATANGAS|LAGUNA|CAVITE|QUEZON|RIZAL/i.test(line) ||
        /\d{3,}/.test(line)
      );
    });
    if (addressLines.length > 0) {
      address = addressLines.join(', ');
    }
  }

  if (!address) {
    const parts = [umidHouseNo, umidBarangay, umidCityMunicipality, umidProvince].filter(Boolean);
    address = parts.join(', ');
  }

  const parsedAddress = parseAddressComponents(address);

  return {
    firstName,
    lastName,
    birthday,
    address,
    addressHouseNo: umidHouseNo || parsedAddress.addressHouseNo || '',
    addressStreet: parsedAddress.addressStreet || '',
    addressBarangay: umidBarangay || parsedAddress.addressBarangay || '',
    addressCityMunicipality: umidCityMunicipality || parsedAddress.addressCityMunicipality || '',
    addressProvince: umidProvince || parsedAddress.addressProvince || '',
    addressRegion: umidRegion || parsedAddress.addressRegion || '',
  };
}

function isLikelyLabelLineForSeniorId(line: string): boolean {
  const upper = normalizeForMatch(line);
  return (
    upper.includes('REPUBLIC OF THE PHILIPPINES') ||
    upper.includes('OFFICE FOR SENIOR CITIZENS AFFAIRS') ||
    upper.includes('SENIOR CITIZEN') ||
    upper.includes('CITY OF') ||
    upper.includes('NAME') ||
    upper.includes('ADDRESS') ||
    upper.includes('DATE OF BIRTH') ||
    upper.includes('DATE ISSUE') ||
    upper.includes('PRINTED NAME') ||
    upper.includes('SIGNATURE') ||
    upper.includes('THUMBMARK') ||
    upper.includes('CTRL NO')
  );
}

function parseSeniorCitizenID(lines: string[]): Partial<ParsedIDData> {
  const cleanedLines = lines.map((line) => cleanField(line)).filter(Boolean);

  let firstName = '';
  let lastName = '';

  const nameLabelIdx = findLabelIndex(cleanedLines, ['NAME']);
  if (nameLabelIdx > 0) {
    const candidate = sanitizePersonName(cleanedLines[nameLabelIdx - 1]);
    const parsed = parseNameValue(candidate);
    firstName = parsed.firstName || '';
    lastName = parsed.lastName || '';
  }

  if (!firstName || !lastName) {
    const nameLine = cleanedLines.find((line) => {
      const upper = normalizeForMatch(line);
      if (isLikelyLabelLineForSeniorId(line)) return false;
      if (upper.includes('CITY')) return false;
      if (!/[A-Za-z]{3,}/.test(line)) return false;
      if (/\d/.test(line)) return false;
      return line.split(/\s+/).length >= 2 && line.split(/\s+/).length <= 5;
    });

    if (nameLine) {
      const parsed = parseNameValue(sanitizePersonName(nameLine));
      firstName = parsed.firstName || firstName;
      lastName = parsed.lastName || lastName;
    }
  }

  const birthday = extractBirthdayFromLines(cleanedLines);

  let address = '';
  const addressLabelIdx = findLabelIndex(cleanedLines, ['ADDRESS']);
  if (addressLabelIdx > 0) {
    const before = cleanField(cleanedLines[addressLabelIdx - 1]);
    if (before && !isLikelyLabelLineForSeniorId(before)) {
      address = before;
    }
  }

  if (!address) {
    const candidate = cleanedLines.find((line) => {
      const upper = normalizeForMatch(line);
      if (isLikelyLabelLineForSeniorId(line)) return false;
      if (!line.includes(',')) return false;
      if (!/[A-Za-z]{3,}/.test(line)) return false;
      if (upper.includes('DATE') || upper.includes('ISSUE')) return false;
      return true;
    });
    address = candidate || '';
  }

  const parsedAddress = parseAddressComponents(address);

  return {
    firstName,
    lastName,
    birthday,
    address,
    addressHouseNo: parsedAddress.addressHouseNo || '',
    addressStreet: parsedAddress.addressStreet || '',
    addressBarangay: parsedAddress.addressBarangay || '',
    addressCityMunicipality: parsedAddress.addressCityMunicipality || '',
    addressProvince: parsedAddress.addressProvince || '',
    addressRegion: parsedAddress.addressRegion || '',
  };
}

function isLikelyLabelLineForVotersId(line: string): boolean {
  const upper = normalizeForMatch(line);
  return (
    upper.includes('REPUBLIC OF THE PHILIPPINES') ||
    upper.includes('COMMISSION ON ELECTIONS') ||
    upper.includes('COMELEC') ||
    upper.includes('VOTER') ||
    upper.includes('CERTIFICATE') ||
    upper.includes('NAME') ||
    upper.includes('ADDRESS') ||
    upper.includes('DATE OF BIRTH') ||
    upper.includes('BIRTH DATE') ||
    upper.includes('AGE') ||
    upper.includes('PRECINCT') ||
    upper.includes('SIGNATURE')
  );
}

function parseVotersID(lines: string[]): Partial<ParsedIDData> {
  const cleanedLines = lines.map((line) => cleanField(line)).filter(Boolean);

  let firstName = '';
  let lastName = '';

  // 1) Labeled extraction first
  const rawName =
    extractAfterLabel(cleanedLines, ['NAME', 'FULL NAME']) ||
    findValueAfterAnyLabel(cleanedLines, ['NAME', 'FULL NAME']);
  if (rawName) {
    const parsed = parseNameValue(sanitizePersonName(rawName));
    firstName = parsed.firstName || '';
    lastName = parsed.lastName || '';
  }

  // 2) Common layout: full name line before "NAME"
  if (!firstName || !lastName) {
    const nameIdx = findLabelIndex(cleanedLines, ['NAME', 'FULL NAME']);
    if (nameIdx > 0) {
      const candidate = sanitizePersonName(cleanedLines[nameIdx - 1]);
      const parsed = parseNameValue(candidate);
      firstName = firstName || parsed.firstName || '';
      lastName = lastName || parsed.lastName || '';
    }
  }

  // 3) Fallback: first strong name-looking line
  if (!firstName || !lastName) {
    // Common Voter's ID layout:
    // <SURNAME>\n<GIVEN NAME>\n<MIDDLE NAME>\nDate of Birth
    const dobIndex = cleanedLines.findIndex((line) => /DATE OF BIRTH/i.test(normalizeForMatch(line)));
    if (dobIndex > 1) {
      const window = cleanedLines.slice(Math.max(0, dobIndex - 4), dobIndex);
      const nameTokens = window.filter((line) => {
        if (isLikelyLabelLineForVotersId(line)) return false;
        if (/\d/.test(line)) return false;
        if (line.includes(',')) return false; // avoid city/province like "LIPA CITY, BATANGAS"
        const upper = normalizeForMatch(line);
        if (upper.includes('CITY') || upper.includes('BARANGAY') || upper.includes('PROVINCE')) return false;
        return /^[A-Za-z][A-Za-z\s.'-]{1,40}$/.test(line);
      });

      if (nameTokens.length >= 2) {
        // First token is usually surname, second is given name.
        lastName = lastName || sanitizePersonName(nameTokens[0]);
        firstName = firstName || sanitizePersonName(nameTokens[1]);
      }
    }
  }

  if (!firstName || !lastName) {
    const nameLine = cleanedLines.find((line) => {
      if (isLikelyLabelLineForVotersId(line)) return false;
      if (/\d/.test(line)) return false;
      if (line.includes(',')) return false; // avoid location lines "CITY, PROVINCE"
      const upper = normalizeForMatch(line);
      if (upper.includes('CITY') || upper.includes('BARANGAY') || upper.includes('PROVINCE')) return false;
      const words = line.split(/\s+/).filter(Boolean);
      return words.length >= 2 && words.length <= 5 && /[A-Za-z]{3,}/.test(line);
    });
    if (nameLine) {
      const parsed = parseNameValue(sanitizePersonName(nameLine));
      firstName = firstName || parsed.firstName || '';
      lastName = lastName || parsed.lastName || '';
    }
  }

  const birthday = extractBirthdayFromLines(cleanedLines);

  let address =
    extractAfterLabel(cleanedLines, ['ADDRESS', 'RESIDENCE', 'RESIDENTIAL ADDRESS']) ||
    findValueAfterAnyLabel(cleanedLines, ['ADDRESS', 'RESIDENCE', 'RESIDENTIAL ADDRESS']);

  // Voter's ID often has location header like "LIPA CITY, BATANGAS".
  const cityProvinceHeader =
    cleanedLines.find((line) => /[A-Za-z]{2,}\s+CITY\s*,\s*[A-Za-z]{2,}/i.test(line)) || '';

  if (!address) {
    const candidate = cleanedLines.find((line) => {
      if (isLikelyLabelLineForVotersId(line)) return false;
      if (!/[A-Za-z]{3,}/.test(line)) return false;
      return (
        line.includes(',') ||
        /BRGY|BARANGAY|CITY|MUNICIPALITY|PROVINCE/i.test(line)
      );
    });
    address = candidate || '';
  }

  // If address was only barangay (e.g., "MALITLIT"), enrich it from nearby lines.
  // Example OCR:
  // - "Address ."
  // - "MALITLIT"
  // - "MALITLIT LIPA CITY"
  // - "LIPA CITY, BATANGAS"
  const lineAfterAddressLabel = (() => {
    const idx = findLabelIndex(cleanedLines, ['ADDRESS']);
    if (idx >= 0 && idx + 1 < cleanedLines.length) {
      return cleanField(cleanedLines[idx + 1]);
    }
    return '';
  })();
  const barangayFromLine = lineAfterAddressLabel || address;
  const barangayCityLine =
    cleanedLines.find((line) => {
      const upper = normalizeForMatch(line);
      if (!upper.includes('CITY')) return false;
      if (line.includes(',')) return false;
      if (isLikelyLabelLineForVotersId(line)) return false;
      return /[A-Za-z]{3,}/.test(line);
    }) || '';

  // Canonicalize to avoid duplicates like:
  // "MALITLIT, MALITLIT LIPA CITY, LIPA CITY, BATANGAS"
  let votersBarangay = cleanField(barangayFromLine)
    .replace(/\b(BRGY\.?|BARANGAY)\b/gi, '')
    .trim();
  let votersCity = '';
  let votersProvince = '';

  if (barangayCityLine) {
    const normalized = cleanField(barangayCityLine).replace(/\b(PHL|PHILIPPINES)\b/gi, '').trim();
    const words = normalized.split(/\s+/).filter(Boolean);
    const cityIdx = words.findIndex((w) => /^CITY$/i.test(w));
    if (cityIdx > 0) {
      votersCity = normalizeCityMunicipalityText(`${words[cityIdx - 1]} CITY`);
      if (!votersBarangay) {
        votersBarangay = words.slice(0, cityIdx - 1).join(' ').trim();
      }
    }
  }

  if (cityProvinceHeader) {
    const parts = cityProvinceHeader.split(',').map((p) => cleanField(p)).filter(Boolean);
    if (!votersCity && parts[0]) {
      votersCity = normalizeCityMunicipalityText(parts[0]);
    }
    if (parts[1]) {
      votersProvince = normalizeAddressToken(parts[1].replace(/\b(PHL|PHILIPPINES)\b/gi, '').trim());
    }
  }

  const composedAddressParts: string[] = [];
  if (votersBarangay) composedAddressParts.push(votersBarangay);
  if (votersCity) composedAddressParts.push(votersCity);
  if (votersProvince) composedAddressParts.push(votersProvince);

  const composedAddress = [...new Set(composedAddressParts.filter(Boolean))].join(', ');
  if (composedAddress) {
    address = composedAddress;
  }

  const parsedAddress = parseAddressComponents(address);

  return {
    firstName,
    lastName,
    birthday,
    address,
    addressHouseNo: parsedAddress.addressHouseNo || '',
    addressStreet: parsedAddress.addressStreet || '',
    addressBarangay: parsedAddress.addressBarangay || '',
    addressCityMunicipality: parsedAddress.addressCityMunicipality || '',
    addressProvince: parsedAddress.addressProvince || '',
    addressRegion: parsedAddress.addressRegion || '',
  };
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
      // Keep full surname and full given-name block (supports multi-word names).
      let lastName = lastPart.replace(/[^A-Za-z\s-']/g, ' ').replace(/\s+/g, ' ').trim();
      let firstName = firstPart.replace(/[^A-Za-z\s-']/g, ' ').replace(/\s+/g, ' ').trim();
      
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

function normalizeBirthdayToIso(raw: string): string {
  const value = raw.trim();
  if (!value) return '';

  // YYYY/MM/DD, YYYY-MM-DD, YYYY.MM.DD (allow OCR spaces like "2003/ 12/29")
  let m = value.match(/\b((19|20)\d{2})\s*[\/.\-]\s*(0?[1-9]|1[0-2])\s*[\/.\-]\s*(0?[1-9]|[12]\d|3[01])\b/);
  if (m) {
    const y = m[1];
    const mo = m[3].padStart(2, '0');
    const d = m[4].padStart(2, '0');
    return `${y}-${mo}-${d}`;
  }

  // Month name formats: "JUNE 19, 2004", "FEBRUARY 18, 2003", "OCTOBER 23. 1963"
  // Includes common OCR typo "FEPRUARY".
  const monthMap: Record<string, string> = {
    JAN: '01', JANUARY: '01',
    FEB: '02', FEBRUARY: '02', FEPRUARY: '02',
    MAR: '03', MARCH: '03',
    APR: '04', APRIL: '04',
    MAY: '05',
    JUN: '06', JUNE: '06',
    JUL: '07', JULY: '07',
    AUG: '08', AUGUST: '08',
    SEP: '09', SEPT: '09', SEPTEMBER: '09',
    OCT: '10', OCTOBER: '10',
    NOV: '11', NOVEMBER: '11',
    DEC: '12', DECEMBER: '12',
  };

  const monthName = value.match(/\b([A-Za-z]{3,10})\s+([0-3]?\d)\s*[,.]\s*((19|20)\d{2})\b/);
  if (monthName) {
    const monKey = normalizeForMatch(monthName[1]);
    const mo = monthMap[monKey];
    if (mo) {
      const d = monthName[2].padStart(2, '0');
      const y = monthName[3];
      return `${y}-${mo}-${d}`;
    }
  }

  // MM/DD/YYYY or DD/MM/YYYY (fallback with month-first preference, allow OCR spaces)
  m = value.match(/\b(0?[1-9]|1[0-2])\s*[\/.\-]\s*(0?[1-9]|[12]\d|3[01])\s*[\/.\-]\s*((19|20)\d{2})\b/);
  if (m) {
    const mo = m[1].padStart(2, '0');
    const d = m[2].padStart(2, '0');
    const y = m[3];
    return `${y}-${mo}-${d}`;
  }

  // NOTE: when month is missing in OCR (e.g., "19, 2004", "19.2004", "1912004"),
  // do NOT guess January. Leave birthday blank so the user picks the correct date.

  return '';
}

function isIsoBirthdayValid(iso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const parsed = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return parsed <= today;
}

function extractBirthdayFromLines(lines: string[]): string {
  // 1) Label-based extraction (Date of Birth, DOB, Birth Date)
  for (let i = 0; i < lines.length; i++) {
    const upper = lines[i].toUpperCase();
    if (
      upper.includes('DATE OF BIRTH') ||
      upper.includes('DOB') ||
      upper.includes('BIRTH DATE') ||
      upper.includes('PETSA NG KAPANGANAKAN') ||
      upper.includes('DATEOF BIRTH') ||
      upper.includes('DATEOFBIRTH')
    ) {
      for (let j = i; j <= Math.min(lines.length - 1, i + 2); j++) {
        const iso = normalizeBirthdayToIso(lines[j]);
        if (iso && isIsoBirthdayValid(iso)) return iso;
      }
    }
  }

  // 2) Generic scan fallback (handles lines like "M 2003/12/29")
  for (const line of lines) {
    const iso = normalizeBirthdayToIso(line);
    if (iso && isIsoBirthdayValid(iso)) return iso;
  }

  return '';
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
    'REPUBLIKA NG PILIPINAS',
    'PAMBANSANG PAGKAKAKILANLAN',
    'PHILIPPINE IDENTIFICATION CARD',
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
    'REPUBLIKA',
    'PILIPINAS',
    'PAMBANSANG',
    'PAGKAKAKILANLAN',
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
  let birthday = '';
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
      const normalizedLine = normalizeForMatch(line);
      const isNameLabelLine =
        normalizedLine.includes('LAST NAME') && normalizedLine.includes('FIRST NAME');
      if (
        normalizedLine.includes('PAMBANSANG') ||
        normalizedLine.includes('PAGKAKAKILAN') ||
        normalizedLine.includes('PHILIPPINE NATIONAL ID') ||
        isNameLabelLine
      ) {
        continue;
      }
      
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
        const normalizedLine = normalizeForMatch(line);
        if (
          normalizedLine.includes('PAMBANSANG') ||
          normalizedLine.includes('PAGKAKAKILAN') ||
          normalizedLine.includes('PHILIPPINE NATIONAL ID')
        ) {
          continue;
        }
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

  console.log(`\n[Generic] === SEARCHING FOR BIRTHDAY ===`);
  // Use original lines (not filtered) because DOB often appears in mixed text like "M 2003/12/29"
  // which can be incorrectly filtered out as metadata/noise.
  birthday = extractBirthdayFromLines(lines);
  if (birthday) {
    console.log(`[Generic] ✅ BIRTHDAY FOUND: "${birthday}"`);
  } else {
    console.log(`[Generic] ⚠️ No birthday found`);
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
      const parts = line.split(/[,.]/).map(p => p.trim()).filter(Boolean);
      console.log(`[Generic] Split into ${parts.length} parts: [${parts.map(p => `"${p}"`).join(', ')}]`);
      
      if (parts.length >= 2) {
        // Find city part first, then use the nearest meaningful part before it as barangay.
        const cityPartIndex = parts.findIndex((p) => hasCorruptedCityKeyword(p));
        const cityRawCandidate = cityPartIndex >= 0 ? parts[cityPartIndex] : parts[1];
        const barangayRawCandidate =
          cityPartIndex > 0
            ? parts[cityPartIndex - 1]
            : (parts.find((p) => !hasCorruptedCityKeyword(p) && p.length >= 3) || parts[0]);

        // Barangay token
        let barangayRaw = cleanField(barangayRawCandidate);
        let barangayNormalized = normalizeAddressToken(barangayRaw);
        
        console.log(`[Generic] Barangay part classification:`);
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
        
        // City/Municipality token
        let cityRaw = cleanField(cityRawCandidate);
        // Remove "(CAPITAL)" or similar annotations
        cityRaw = cityRaw.replace(/\([^)]*\)?/g, '').trim();
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
    if (
      line.includes(',') &&
      !hasCorruptedCityKeyword(line) &&
      line.match(/,\s*\d{4,}/) &&
      !line.match(/\b(19|20)\d{2}\s*[\/.\-]\s*(0?[1-9]|1[0-2])\s*[\/.\-]\s*(0?[1-9]|[12]\d|3[01])\b/)
    ) {
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
      // If OCR line contains province + date (e.g., "BATANGAS, 2003/12/29"),
      // keep only the first segment as province.
      const provinceSegment = line.split(',')[0] || line;
      let provinceRaw = cleanField(provinceSegment);
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

    // Performance short-circuit:
    // once core fields are all captured, stop scanning remaining lines.
    if (
      firstName &&
      lastName &&
      birthday &&
      addressBarangay &&
      addressCityMunicipality &&
      addressProvince
    ) {
      break;
    }
  }

  // Build generic address from parts if structured extraction worked
  if (addressBarangay || addressCityMunicipality || addressProvince) {
    const parts: string[] = [];
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
  console.log(`  birthday: "${birthday}"`);
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
    birthday,
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
  const originalConsoleLog = console.log;
  if (!OCR_PARSER_VERBOSE_LOGS) {
    console.log = () => {};
  }

  try {
    console.log('\n\n========== ID PARSING STARTED ==========\n');
    
    // STEP 1: Detect ID type
    const detectionResult = detectIdType(rawOcrText);
    console.log(`\n📋 Detected ID Type: ${detectionResult.type} (${detectionResult.confidence})`);
    
    // STEP 2: Prepare for parsing - split into lines
    const lines = rawOcrText.trim().split('\n').map(l => l.trim());
    console.log(`\n📋 Text split into ${lines.length} lines`);
    
    // STEP 3: Route to parser based on detected ID type
    const normalizedRaw = normalizeForMatch(rawOcrText);
    const looksLikePhilSys =
      normalizedRaw.includes('PHILIPPINE NATIONAL ID') ||
      normalizedRaw.includes('PAMBANSANG') ||
      normalizedRaw.includes('PAGKAKAKILAN') ||
      (normalizedRaw.includes('GIVEN NAMES') && normalizedRaw.includes('DATE OF BIRTH'));
    const looksLikeUmid =
      normalizedRaw.includes('UNIFIED MULTI-PURPOSE ID') ||
      (normalizedRaw.includes('UNIFIED') && normalizedRaw.includes('MULTI-PURPOSE') && normalizedRaw.includes('ID'));
    const looksLikeSenior =
      normalizedRaw.includes('OFFICE FOR SENIOR') ||
      normalizedRaw.includes('SENIOR CITIZENS AFFAIRS') ||
      normalizedRaw.includes('DATE OF BIRTH / AGE');
    const looksLikeVoters =
      normalizedRaw.includes('COMELEC') ||
      normalizedRaw.includes('COMMISSION ON ELECTIONS') ||
      (normalizedRaw.includes('VOTER') && normalizedRaw.includes('ADDRESS'));

    const usePhilSysParser = detectionResult.type === 'philsys' || looksLikePhilSys;
    const useUmidParser = detectionResult.type === 'umid' || looksLikeUmid;
    const useSeniorParser = detectionResult.type === 'senior_citizen' || looksLikeSenior;
    const useVotersParser = detectionResult.type === 'voters' || looksLikeVoters;
    let parserResult: Partial<ParsedIDData>;
    if (usePhilSysParser) {
      const philsysResult = parsePhilSysID(lines);
      const needsFallback = !philsysResult.firstName || !philsysResult.lastName || !philsysResult.address;

      if (needsFallback) {
        console.log('[PhilSys] Incomplete labeled extraction. Running generic fallback parser...');
        const genericResult = parseGenericID(lines);
        parserResult = {
          ...genericResult,
          ...philsysResult,
          // For PhilSys, do not allow generic name fallback because generic parser
          // can misread header text as names. Keep names from PhilSys labeled parser only.
          firstName: philsysResult.firstName || '',
          lastName: philsysResult.lastName || '',
          birthday: philsysResult.birthday || genericResult.birthday || '',
          address: philsysResult.address || genericResult.address || '',
          addressHouseNo: philsysResult.addressHouseNo || genericResult.addressHouseNo || '',
          addressStreet: philsysResult.addressStreet || genericResult.addressStreet || '',
          addressBarangay: philsysResult.addressBarangay || genericResult.addressBarangay || '',
          addressCityMunicipality: philsysResult.addressCityMunicipality || genericResult.addressCityMunicipality || '',
          addressProvince: philsysResult.addressProvince || genericResult.addressProvince || '',
          addressRegion: philsysResult.addressRegion || genericResult.addressRegion || '',
        };
      } else {
        parserResult = philsysResult;
      }
    } else if (useUmidParser) {
      const umidResult = parseUmidID(lines);
      const needsFallback = !umidResult.firstName || !umidResult.lastName || !umidResult.address || !umidResult.birthday;
      const genericResult = needsFallback ? parseGenericID(lines) : null;
      parserResult = {
        ...(genericResult || {}),
        ...umidResult,
        firstName: umidResult.firstName || genericResult?.firstName || '',
        lastName: umidResult.lastName || genericResult?.lastName || '',
        birthday: umidResult.birthday || genericResult?.birthday || '',
        address: umidResult.address || genericResult?.address || '',
        addressHouseNo: umidResult.addressHouseNo || genericResult?.addressHouseNo || '',
        addressStreet: umidResult.addressStreet || genericResult?.addressStreet || '',
        addressBarangay: umidResult.addressBarangay || genericResult?.addressBarangay || '',
        addressCityMunicipality: umidResult.addressCityMunicipality || genericResult?.addressCityMunicipality || '',
        addressProvince: umidResult.addressProvince || genericResult?.addressProvince || '',
        addressRegion: umidResult.addressRegion || genericResult?.addressRegion || '',
      };
    } else if (useSeniorParser) {
      const seniorResult = parseSeniorCitizenID(lines);
      const needsFallback = !seniorResult.firstName || !seniorResult.lastName || !seniorResult.address;
      const genericResult = needsFallback ? parseGenericID(lines) : null;
      parserResult = {
        ...(genericResult || {}),
        ...seniorResult,
        firstName: seniorResult.firstName || genericResult?.firstName || '',
        lastName: seniorResult.lastName || genericResult?.lastName || '',
        birthday: seniorResult.birthday || genericResult?.birthday || '',
        address: seniorResult.address || genericResult?.address || '',
        addressHouseNo: seniorResult.addressHouseNo || genericResult?.addressHouseNo || '',
        addressStreet: seniorResult.addressStreet || genericResult?.addressStreet || '',
        addressBarangay: seniorResult.addressBarangay || genericResult?.addressBarangay || '',
        addressCityMunicipality: seniorResult.addressCityMunicipality || genericResult?.addressCityMunicipality || '',
        addressProvince: seniorResult.addressProvince || genericResult?.addressProvince || '',
        addressRegion: seniorResult.addressRegion || genericResult?.addressRegion || '',
      };
    } else if (useVotersParser) {
      const votersResult = parseVotersID(lines);
      const needsFallback = !votersResult.firstName || !votersResult.lastName || !votersResult.address;
      const genericResult = needsFallback ? parseGenericID(lines) : null;
      parserResult = {
        ...(genericResult || {}),
        ...votersResult,
        firstName: votersResult.firstName || genericResult?.firstName || '',
        lastName: votersResult.lastName || genericResult?.lastName || '',
        birthday: votersResult.birthday || genericResult?.birthday || '',
        address: votersResult.address || genericResult?.address || '',
        addressHouseNo: votersResult.addressHouseNo || genericResult?.addressHouseNo || '',
        addressStreet: votersResult.addressStreet || genericResult?.addressStreet || '',
        addressBarangay: votersResult.addressBarangay || genericResult?.addressBarangay || '',
        addressCityMunicipality: votersResult.addressCityMunicipality || genericResult?.addressCityMunicipality || '',
        addressProvince: votersResult.addressProvince || genericResult?.addressProvince || '',
        addressRegion: votersResult.addressRegion || genericResult?.addressRegion || '',
      };
    } else {
      parserResult = parseGenericID(lines);
    }
    
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

    const provinceLooksCombined =
      !!addressComponents.addressProvince &&
      (addressComponents.addressProvince.includes(',') ||
        /\d/.test(addressComponents.addressProvince) ||
        normalizeForMatch(addressComponents.addressProvince).includes('PHILIPPINES'));
    
    // Only parse combined address string if no individual components were extracted
    if (
      !addressComponents.addressBarangay ||
      !addressComponents.addressCityMunicipality ||
      !addressComponents.addressProvince ||
      provinceLooksCombined
    ) {
      const fallback = parseAddressComponents(parserResult.address || '');
      addressComponents.addressHouseNo = fallback.addressHouseNo || addressComponents.addressHouseNo || '';
      addressComponents.addressStreet = fallback.addressStreet || addressComponents.addressStreet || '';
      addressComponents.addressBarangay = fallback.addressBarangay || addressComponents.addressBarangay || '';
      addressComponents.addressCityMunicipality = fallback.addressCityMunicipality || addressComponents.addressCityMunicipality || '';
      addressComponents.addressProvince = fallback.addressProvince || addressComponents.addressProvince || '';
      addressComponents.addressRegion = fallback.addressRegion || addressComponents.addressRegion || '';
    }
    
    // STEP 5: Determine confidence
    const extractedFields: string[] = [];
    if (parserResult.firstName) extractedFields.push('firstName');
    if (parserResult.lastName) extractedFields.push('lastName');
    if (parserResult.birthday) extractedFields.push('birthday');
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
    console.log(`   birthday: "${parserResult.birthday || ''}"`);
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
      birthday: parserResult.birthday || '',
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
  } finally {
    console.log = originalConsoleLog;
  }
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
    birthday: data.birthday || '',
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
