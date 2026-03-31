/**
 * Philippine Multi-ID Parser System
 * 
 * Supports 17 different Philippine government and private ID types
 * Uses ID type detection to route to the appropriate parser
 * Each parser is optimized for that ID type's specific layout
 * 
 * Key Features:
 * - Type-specific parsing logic
 * - Safe fallbacks for unknown layouts
 * - Label-based extraction where possible
 * - Blacklist of document headers to prevent extraction
 * - Comprehensive debug logging
 * - Returns empty fields instead of wrong values
 */

import { IDType, detectIdType } from './id-type-detector';

export interface ParsedIDData {
  firstName: string;
  lastName: string;
  address: string;
  confidence: 'high' | 'medium' | 'low';
  detectedIdType: IDType;
  rawOcrText?: string;
}

// Shared blacklist of words to ignore globally
const BLACKLIST_KEYWORDS = new Set([
  'REPUBLIC',
  'PHILIPPINES',
  'DEPARTMENT',
  'LICENSE',
  'PASSPORT',
  'IDENTIFICATION',
  'COMMISSION',
  'GOVERNMENT',
  'SIGNATURE',
  'CLEARANCE',
  'NATIONAL',
  'OFFICE',
  'AGENCY',
  'FORM',
  'CERTIFIED',
  'OFFICIAL',
  'CARD',
  'DOCUMENT',
  'AUTHORITY',
]);

// Shared metadata keywords to identify label lines
const METADATA_KEYWORDS = new Set([
  'LAST',
  'FIRST',
  'MIDDLE',
  'NAME',
  'ADDRESS',
  'SIGNATURE',
  'SEX',
  'HEIGHT',
  'WEIGHT',
  'BLOOD',
  'TYPE',
  'NATIONALITY',
  'DATE',
  'BIRTH',
  'ISSUED',
  'VALIDITY',
  'EXPIRATION',
  'RESTRICTIONS',
  'CONDITIONS',
  'CODE',
  'CONTROL',
  'NUMBER',
  'ID',
  'PHONE',
  'CONTACT',
  'EMAIL',
  'STREET',
  'CITY',
  'PROVINCE',
  'BARANGAY',
  'OCCUPATION',
  'STATUS',
  'REGISTERED',
]);

/**
 * Clean OCR noise from extracted values
 */
function cleanField(text: string): string {
  let cleaned = text.trim();
  cleaned = cleaned.replace(/^[^A-Za-z0-9]+/, '');
  cleaned = cleaned.replace(/[^A-Za-z0-9,.'-\s]+$/g, '');
  cleaned = cleaned.replace(/,+/g, ',');
  cleaned = cleaned.replace(/\s*,\s*/g, ', ');
  cleaned = cleaned.replace(/\s+/g, ' ');
  return cleaned.trim();
}

/**
 * Normalize OCR name by removing diacritics and accents
 * Fixes OCR errors like "ALCANTÅRÅ" → "ALCANTARA"
 */
function normalizeOCRName(text: string): string {
  if (!text) return text;
  
  try {
    // Normalize Unicode: decompose characters with accents
    // "Å" becomes "A°" then we remove the accent mark
    const normalized = text
      .normalize('NFD') // Decompose accents
      .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
      .normalize('NFC'); // Recompose
    
    return normalized;
  } catch (e) {
    // Fallback to original if normalization fails
    return text;
  }
}

/**
 * Extract lines that don't contain blacklist keywords or metadata keywords
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

    // Skip if too many blacklist words
    let blacklistCount = 0;
    let metadataCount = 0;

    for (const word of words) {
      if (combinedBlacklist.has(word)) blacklistCount++;
      if (METADATA_KEYWORDS.has(word)) metadataCount++;
    }

    // Skip lines that are mostly headers/metadata
    if (blacklistCount > 1) return false;
    if (metadataCount >= 2) return false;

    return true;
  });
}

/**
 * Find label and extract the value on the next line(s)
 * Useful for structured IDs with explicit field labels
 */
function extractAfterLabel(
  lines: string[],
  labelPatterns: string[]
): string {
  for (let i = 0; i < lines.length - 1; i++) {
    const lineTrimmed = lines[i].toUpperCase().trim();

    for (const pattern of labelPatterns) {
      if (lineTrimmed.includes(pattern)) {
        // Found label, extract next non-empty line
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

  // Format 1: "LASTNAME, FIRSTNAME MIDDLE"
  if (cleaned.includes(',')) {
    const [lastPart, firstPart] = cleaned
      .split(',')
      .map(p => p.trim());
    if (lastPart && firstPart) {
      const lastName = lastPart.split(/\s+/)[0];
      const firstName = firstPart.split(/\s+/)[0];
      return { firstName, lastName };
    }
  }

  // Format 2: "FIRSTNAME LASTNAME" or just two words
  const words = cleaned.split(/\s+/).filter(w => w && w.length >= 2);
  if (words.length >= 2) {
    return { firstName: words[0], lastName: words.slice(1).join(' ') };
  } else if (words.length === 1) {
    // Only one name, can't determine which is first/last
    return { firstName: words[0], lastName: '' };
  }

  return { firstName: '', lastName: '' };
}

/**
 * CLASS: LINE CLASSIFIER
 * Determines if a line is a header, metadata, name, address, or other
 */
class LineClassifier {
  private headerKeywords = new Set([
    'REPUBLIC', 'PHILIPPINES', 'DEPARTMENT', 'TRANSPORTATION',
    'LAND', 'OFFICE', 'DRIVER', 'LICENSE', "DRIVER'S", 'DRIVERS',
    'NATIONAL', 'IDENTIFICATION', 'AGENCY', 'GOVERNMENT', 'COMMISSION',
  ]);

  private addressKeywords = new Set([
    'CITY', 'PROVINCE', 'BARANGAY', 'BRGY', 'STREET', 'ST',
    'AVE', 'AVENUE', 'ROAD', 'RD', 'ZONE', 'SUBDIVISION',
    'CORNER', 'DISTRICT', 'METRO', 'MUNICIPAL', 'BUILDING',
    'FLOOR', 'UNIT', 'APARTMENTS', 'APARTMENT', 'APT', 'BLVD',
    'BOULEVARD', 'BLOCK', 'LOT', 'SECTOR',
    'BATANGAS', 'MANILA', 'QUEZON', 'MAKATI', 'CEBU', 'DAVAO',
    'TALIPAPA', 'GULOD', 'ITAAS', 'LUNGSOD',
  ]);

  classifyAsName(line: string): boolean {
    const upper = line.toUpperCase().trim();
    if (upper.length < 5 || upper.length > 80) return false;

    const words = upper.split(/[\s,]+/);
    const letterPct =
      (line.match(/[A-Za-z]/g) || []).length / line.length;

    // Check: 2-4 words, 60%+ letters
    if (words.length >= 2 && words.length <= 4 && letterPct >= 0.6) {
      // But NOT if it has metadata keywords
      let metaCount = 0;
      for (const word of words) {
        if (METADATA_KEYWORDS.has(word)) metaCount++;
      }

      if (metaCount === 0) return true;
    }

    return false;
  }

  classifyAsAddress(line: string): boolean {
    const upper = line.toUpperCase().trim();
    if (line.length < 10) return false;

    const words = upper.split(/[\s,]+/);
    let addressCount = 0;
    let headerCount = 0;

    for (const word of words) {
      if (this.addressKeywords.has(word)) addressCount++;
      if (this.headerKeywords.has(word)) headerCount++;
    }

    return addressCount >= 1 && headerCount === 0;
  }
}

const classifier = new LineClassifier();

/**
 * PARSER: Driver's License (LTO)
 * Uses label-based extraction with multiple strategies
 */
function parseDriversLicense(lines: string[]): Partial<ParsedIDData> {
  let firstName = '';
  let lastName = '';
  let address = '';
  let nameLineIndex = -1; // Track where name was found for address fallback

  console.log(`[DriverLicense] Starting parsing, total lines: ${lines.length}`);

  // PHASE 1: Extract name - try multiple strategies
  // Strategy A: Look for comma-separated name in first 15 lines (most reliable)
  for (let i = 0; i < Math.min(15, lines.length); i++) {
    const line = lines[i].trim();
    if (line.includes(',') && line.length >= 10) {
      const parsed = parseNameValue(line);
      if (parsed.firstName && parsed.lastName) {
        firstName = parsed.firstName;
        lastName = parsed.lastName;
        nameLineIndex = i;
        console.log(`[DriverLicense] Strategy A - Found comma-separated name at line ${i}: "${line}" -> "${firstName}" "${lastName}"`);
        break;
      }
    }
  }

  // Strategy B: If not found, look for label then next data line
  if (!firstName && !lastName) {
    for (let i = 0; i < lines.length - 1; i++) {
      const lineUpper = lines[i].toUpperCase().trim();
      if (lineUpper.includes('LAST') && lineUpper.includes('FIRST')) {
        let j = i + 1;
        while (j < lines.length) {
          const nameDataLine = lines[j].trim();
          if (nameDataLine.length >= 5) {
            const parsed = parseNameValue(nameDataLine);
            if (parsed.firstName && parsed.lastName) {
              firstName = parsed.firstName;
              lastName = parsed.lastName;
              nameLineIndex = j;
              console.log(`[DriverLicense] Strategy B - Found label-based name at line ${j}: "${nameDataLine}" -> "${firstName}" "${lastName}"`);
              break;
            }
          }
          j++;
        }
        if (firstName && lastName) break;
      }
    }
  }

  // PHASE 2: Extract address
  // Strategy A: Look for "ADDRESS" label
  let foundAddress = false;
  for (let i = 0; i < lines.length - 1; i++) {
    const lineUpper = lines[i].toUpperCase().trim();
    
    if (lineUpper === 'ADDRESS' || lineUpper.startsWith('ADDRESS')) {
      const addressLines: string[] = [];
      let j = i + 1;
      
      while (j < lines.length && addressLines.length < 2) {
        const addrLine = lines[j].trim();
        const addrUpper = addrLine.toUpperCase();
        
        // Stop at metadata
        if (addrUpper.includes('LICENSE') || addrUpper.includes('NO.') || 
            addrUpper.includes('EXPIRATION') || addrUpper.includes('AGE') ||
            addrUpper.includes('BLOOD') || addrUpper.includes('EYES') ||
            addrUpper.includes('DL CODES') || addrUpper.includes('BIRTHDAY') ||
            addrUpper.includes('DATE OF BIRTH') || addrUpper.includes('VALIDITY')) {
          break;
        }
        
        if (addrLine.length >= 5) {
          addressLines.push(addrLine);
        }
        j++;
      }
      
      if (addressLines.length > 0) {
        address = cleanField(addressLines.join(', '));
        console.log(`[DriverLicense] Strategy A - Found address after label: "${address}"`);
        foundAddress = true;
      }
      break;
    }
  }

  // Strategy B: If no ADDRESS label found, look for address-like lines after name
  // (contains city/province keywords or comma-separated location info)
  if (!foundAddress && nameLineIndex >= 0) {
    console.log(`[DriverLicense] Strategy B - Looking for address without label...`);
    const addressKeywords = ['CITY', 'PROVINCE', 'BARANGAY', 'STREET', 'ROAD', 'AVENUE', 'DISTRICT'];
    
    for (let i = nameLineIndex + 1; i < Math.min(nameLineIndex + 5, lines.length); i++) {
      const line = lines[i].trim();
      const upper = line.toUpperCase();
      
      // Stop at metadata
      if (upper.includes('LICENSE') || upper.includes('NO.') || upper.includes('EXPIRATION')) {
        break;
      }
      
      // Check if line looks like address (has city/province keywords or comma)
      const looksLikeAddress = addressKeywords.some(kw => upper.includes(kw)) || 
                               line.includes(',');
      
      if (line.length >= 10 && looksLikeAddress) {
        address = cleanField(line);
        console.log(`[DriverLicense] Strategy B - Found address-like line at ${i}: "${address}"`);
        break;
      }
    }
  }

  return { firstName, lastName, address };
}

/**
 * PARSER: PhilSys ID / National ID
 */
function parsePhilSys(lines: string[]): Partial<ParsedIDData> {
  // Label-based extraction
  let firstName = extractAfterLabel(lines, ['FIRST NAME', 'GIVEN NAME']);
  let lastName = extractAfterLabel(lines, ['LAST NAME', 'SURNAME']);
  let address = extractAfterLabel(lines, ['ADDRESS', 'RESIDENTIAL']);

  return { firstName, lastName, address };
}

/**
 * PARSER: Passport
 */
function parsePassport(lines: string[]): Partial<ParsedIDData> {
  const dataLines = filterDataLines(lines, ['PASSPORT', 'REPUBLIC']);

  // Passports have specific format, usually name is near top
  let firstName = '';
  let lastName = '';

  for (let i = 0; i < Math.min(10, dataLines.length); i++) {
    const line = dataLines[i];
    if (classifier.classifyAsName(line)) {
      const parsed = parseNameValue(line);
      if (parsed.firstName || parsed.lastName) {
        firstName = parsed.firstName;
        lastName = parsed.lastName;
        break;
      }
    }
  }

  // Passports usually don't have address, return empty
  const address = '';

  return { firstName, lastName, address };
}

/**
 * PARSER: UMID / SSS
 */
function parseUMIDOrSSS(lines: string[]): Partial<ParsedIDData> {
  // Label-based extraction
  let firstName = extractAfterLabel(lines, ['FIRST NAME', 'GIVEN NAME', 'FNAME']);
  let lastName = extractAfterLabel(lines, [
    'LAST NAME',
    'SURNAME',
    'FAMILY NAME',
    'LNAME',
  ]);
  let address = extractAfterLabel(lines, ['ADDRESS', 'RESIDENTIAL ADDRESS']);

  // Fallback: look for name pattern if labels not found
  if (!firstName && !lastName) {
    const dataLines = filterDataLines(lines, ['UMID', 'SSS', 'SOCIAL']);
    for (const line of dataLines) {
      if (classifier.classifyAsName(line)) {
        const parsed = parseNameValue(line);
        if (parsed.firstName || parsed.lastName) {
          firstName = parsed.firstName;
          lastName = parsed.lastName;
          break;
        }
      }
    }
  }

  return { firstName, lastName, address };
}

/**
 * PARSER: PRC ID
 */
function parsePRCID(lines: string[]): Partial<ParsedIDData> {
  let firstName = extractAfterLabel(lines, [
    'FIRST NAME',
    'GIVEN NAME',
    'FNAME',
  ]);
  let lastName = extractAfterLabel(lines, [
    'LAST NAME',
    'SURNAME',
    'FAMILY NAME',
    'LNAME',
  ]);
  const address = extractAfterLabel(lines, ['ADDRESS', 'RESIDENTIAL ADDRESS']);

  return { firstName, lastName, address };
}

/**
 * PARSER: School ID
 */
function parseSchoolID(lines: string[]): Partial<ParsedIDData> {
  const dataLines = filterDataLines(lines, [
    'SCHOOL',
    'UNIVERSITY',
    'COLLEGE',
    'STUDENT',
  ]);

  let firstName = extractAfterLabel(lines, ['FIRST NAME', 'GIVEN NAME']);
  let lastName = extractAfterLabel(lines, [
    'LAST NAME',
    'SURNAME',
    'FAMILY NAME',
  ]);

  // Fallback to pattern matching
  if (!firstName && !lastName) {
    for (const line of dataLines) {
      if (classifier.classifyAsName(line)) {
        const parsed = parseNameValue(line);
        if (parsed.firstName || parsed.lastName) {
          firstName = parsed.firstName;
          lastName = parsed.lastName;
          break;
        }
      }
    }
  }

  const address = '';
  return { firstName, lastName, address };
}

/**
 * PARSER: Company / Employee ID
 */
function parseCompanyID(lines: string[]): Partial<ParsedIDData> {
  const dataLines = filterDataLines(lines, [
    'COMPANY',
    'EMPLOYEE',
    'CORPORATION',
  ]);

  let firstName = extractAfterLabel(lines, ['FIRST NAME', 'GIVEN NAME']);
  let lastName = extractAfterLabel(lines, [
    'LAST NAME',
    'SURNAME',
    'FAMILY NAME',
  ]);

  // Fallback to pattern matching
  if (!firstName && !lastName) {
    for (const line of dataLines) {
      if (classifier.classifyAsName(line)) {
        const parsed = parseNameValue(line);
        if (parsed.firstName || parsed.lastName) {
          firstName = parsed.firstName;
          lastName = parsed.lastName;
          break;
        }
      }
    }
  }

  const address = '';
  return { firstName, lastName, address };
}

/**
 * PARSER: Clearance Documents (Police, NBI, Barangay)
 */
function parseClearanceDocument(lines: string[]): Partial<ParsedIDData> {
  let firstName = extractAfterLabel(lines, [
    'FIRST NAME',
    'GIVEN NAME',
    'APPLICANT',
  ]);
  let lastName = extractAfterLabel(lines, [
    'LAST NAME',
    'SURNAME',
    'FAMILY NAME',
  ]);
  let address = extractAfterLabel(lines, ['ADDRESS', 'RESIDENTIAL ADDRESS']);

  return { firstName, lastName, address };
}

/**
 * PARSER: Postal ID (Philippines)
 * Multiple strategies to extract name and address
 */
function parsePostalID(lines: string[]): Partial<ParsedIDData> {
  let firstName = '';
  let lastName = '';
  let address = '';

  console.log(`[PostalID] Starting parsing, total lines: ${lines.length}`);

  // PHASE 1: Find name using multiple strategies
  let nameLineIndex = -1;
  
  // Strategy A: Look for a line with 2-5 words that's mostly letters
  for (let i = 0; i < Math.min(10, lines.length); i++) {
    const line = lines[i].trim();
    const upper = line.toUpperCase();
    
    // Skip obvious headers/labels
    const skipKeywords = ['POSTAL', 'REPUBLIC', 'IDENTITY', 'CARD', 'PHLPOST', 'PHILIPPINES',
                         'FIRST NAME', 'LAST NAME', 'SURNAME', 'NAME', 'DEPT'];
    if (skipKeywords.some(kw => upper.includes(kw)) || line.length < 8) {
      continue;
    }

    const words = line.split(/\s+/).filter(w => w && w.length > 0);
    const letterCount = (line.match(/[A-Za-z]/g) || []).length;
    const letterRatio = letterCount / line.length;

    // Accept if: 2-5 words, 60%+ letters (relaxed criteria)
    if (words.length >= 2 && words.length <= 5 && letterRatio >= 0.60) {
      firstName = normalizeOCRName(words[0]);
      lastName = normalizeOCRName(words[words.length - 1]);
      nameLineIndex = i;
      console.log(`[PostalID] Found name at line ${i}: "${line}" -> "${firstName}" "${lastName}"`);
      break;
    }
  }

  // PHASE 2: Extract full address block
  const addressLines: string[] = [];
  
  if (nameLineIndex >= 0) {
    console.log(`[PostalID] Searching for address from line ${nameLineIndex + 1} onwards`);
    
    for (let i = nameLineIndex + 1; i < lines.length; i++) {
      const line = lines[i].trim();
      const upper = line.toUpperCase();

      // Stop at metadata keywords
      if (upper.includes('PRN') || upper.includes('PREMIUM') || 
          upper.includes('DATE OF BIRTH') || upper.includes('VALIDITY') ||
          upper.includes('NATIONAL') || upper.includes('POSTAL OFFICE') ||
          upper.match(/JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC/)) {
        console.log(`[PostalID] Hit metadata at line ${i}`);
        break;
      }

      // Collect non-empty lines as address
      if (line.length >= 3) {
        let fixedLine = line.replace(/\bELK\b/g, 'BLK').replace(/\belk\b/g, 'blk');
        addressLines.push(fixedLine);
      }
    }
  }

  if (addressLines.length > 0) {
    address = cleanField(addressLines.join(' '));
    console.log(`[PostalID] Final address: "${address}"`);
  } else {
    console.log(`[PostalID] No address lines found`);
  }

  return { firstName, lastName, address };
}

/**
 * PARSER: Generic / Fallback Parser
 * Used when ID type is unknown or unsupported
 */
function parseGeneric(lines: string[]): Partial<ParsedIDData> {
  const dataLines = filterDataLines(lines);

  let firstName = '';
  let lastName = '';
  let address = '';

  // Try to find name
  for (const line of dataLines) {
    if (classifier.classifyAsName(line)) {
      const parsed = parseNameValue(line);
      if (parsed.firstName || parsed.lastName) {
        firstName = parsed.firstName;
        lastName = parsed.lastName;
        break;
      }
    }
  }

  // Try to find address
  for (const line of dataLines) {
    if (classifier.classifyAsAddress(line)) {
      address = cleanField(line);
      if (address.length > 10) break;
    }
  }

  return { firstName, lastName, address };
}

/**
 * MAIN PARSING FUNCTION
 * Routes to the appropriate parser based on detected ID type
 */
export function parseIDText(rawOcrText: string): ParsedIDData {
  console.log(
    '\n╔════════════════════════════════════════════════════════════╗'
  );
  console.log(
    '║   MULTI-ID PARSER - Support for 17 Philippine ID Types     ║'
  );
  console.log(
    '╚════════════════════════════════════════════════════════════╝\n'
  );

  // STEP 1: Detect ID type
  const detection = detectIdType(rawOcrText);
  const detectedType = detection.type;

  // STEP 2: Parse lines
  const allLines = rawOcrText
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);

  console.log(`\n📝 Raw text: ${rawOcrText.length} characters, ${allLines.length} lines`);

  // STEP 3: Route to appropriate parser
  console.log(`\n🔍 Routing to parser for: ${detectedType.toUpperCase()}\n`);

  let parsedData: Partial<ParsedIDData>;

  switch (detectedType) {
    case 'drivers_license':
      parsedData = parseDriversLicense(allLines);
      break;
    case 'philsys':
      parsedData = parsePhilSys(allLines);
      break;
    case 'passport':
      parsedData = parsePassport(allLines);
      break;
    case 'umid':
    case 'sss':
      parsedData = parseUMIDOrSSS(allLines);
      break;
    case 'prc':
      parsedData = parsePRCID(allLines);
      break;
    case 'school':
      parsedData = parseSchoolID(allLines);
      break;
    case 'company':
      parsedData = parseCompanyID(allLines);
      break;
    case 'postal':
      parsedData = parsePostalID(allLines);
      break;
    case 'police_clearance':
    case 'nbi_clearance':
    case 'barangay':
      parsedData = parseClearanceDocument(allLines);
      break;
    case 'tin':
    case 'voters':
    case 'senior_citizen':
    case 'pwd':
    case 'philhealth':
    default:
      // Fallback to generic parser for unsupported types
      parsedData = parseGeneric(allLines);
      break;
  }

  // STEP 4: Calculate confidence
  const firstName = (parsedData.firstName || '').trim();
  const lastName = (parsedData.lastName || '').trim();
  const address = (parsedData.address || '').trim();

  let confidence: 'high' | 'medium' | 'low' = 'low';

  if (firstName && lastName && address && detection.confidence === 'high') {
    confidence = 'high';
  } else if ((firstName || lastName) && detection.confidence === 'high') {
    confidence = 'medium';
  } else if (firstName || lastName) {
    confidence = 'medium';
  } else {
    confidence = 'low';
  }

  // STEP 5: Final output
  console.log('═'.repeat(60));
  console.log('EXTRACTION RESULT');
  console.log('═'.repeat(60));
  console.log(`  ID Type:     ${detectedType.toUpperCase()}`);
  console.log(
    `  Confidence:  ${detection.confidence.toUpperCase()} (${confidence.toUpperCase()})`
  );
  console.log(`  First Name:  "${firstName}"`);
  console.log(`  Last Name:   "${lastName}"`);
  console.log(`  Address:     "${address}"`);
  console.log('═'.repeat(60) + '\n');

  return {
    firstName,
    lastName,
    address,
    confidence,
    detectedIdType: detectedType,
    rawOcrText,
  };
}

/**
 * Validate parsed data - accepts partial results
 * Returns true if at least ONE field was extracted
 */
export function validateParsedData(data: ParsedIDData): boolean {
  const hasFirstName: boolean = !!(
    data.firstName && data.firstName.length >= 2
  );
  const hasLastName: boolean = !!(data.lastName && data.lastName.length >= 2);
  const hasAddress: boolean = !!(data.address && data.address.length >= 5);

  // Accept if any field was found
  return hasFirstName || hasLastName || hasAddress;
}

/**
 * Format parsed data for display
 */
export function formatParsedData(
  data: ParsedIDData
): Record<string, string | boolean> {
  return {
    first_name: data.firstName || '',
    last_name: data.lastName || '',
    address: data.address || '',
    confidence: data.confidence,
    id_type: data.detectedIdType,
  };
}

/**
 * Get human-readable confidence message
 */
export function getConfidenceMessage(confidence: string): string {
  switch (confidence) {
    case 'high':
      return '✅ High confidence - Data extracted from clear ID';
    case 'medium':
      return '⚠️ Medium confidence - Some fields may need verification';
    case 'low':
      return '❌ Low confidence - Please verify or manually enter data';
    default:
      return '❓ Unable to determine confidence';
  }
}
