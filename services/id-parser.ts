/**
 * ID Parser Service - SAFE & CONSERVATIVE Extraction
 * 
 * SAFETY-FIRST APPROACH:
 * - Only extracts: first_name, last_name, address
 * - Rejects results with low confidence
 * - Uses comprehensive blacklist to filter invalid values
 * - Never forces auto-fill if unsure
 * - Skips document headers/labels before extracting names
 * - Returns empty strings when not confident
 * - Stores rawOcrText for debug logging only
 */

export interface ParsedIDData {
  firstName: string;
  lastName: string;
  address: string;
  confidence: 'high' | 'medium' | 'low';
  rawOcrText?: string; // For debugging only - NOT shown in form fields
}

// BLACKLIST: Words that indicate metadata/document headers, NOT person names
const NAME_BLACKLIST = new Set([
  'DEPARTMENT',
  'TRANSPORTATION',
  'REPUBLIC',
  'PHILIPPINES',
  'DRIVER',
  'LICENSE',
  'NATIONAL',
  'CITIZENSHIP',
  'VALIDITY',
  'SIGNATURE',
  'AGENCY',
  'AUTHORITY',
  'GOVERNMENT',
  'ISSUED',
  'EXPIRATION',
  'DATE',
  'BLOOD',
  'SEX',
  'HEIGHT',
  'WEIGHT',
  'RESTRICTIONS',
  'CONDITION',
  'CLASSIFICATION',
  'IDENTIFICATION',
  'DOCUMENT',
  'CLASS',
  'ENDORSEMENT',
  'RESTRICTION',
  'CATEGORY',
  'SURNAME',
  'GIVEN',
  'MIDDLE',
  'NAME',
  'PROFESSIONAL',
  'CERTIFICATE',
  'ID',
  'REGISTRY',
  'BIRTH',
  'ADDRESS',
  'CITY',
  'PROVINCE',
  'REGION',
  'BARANGAY',
  'OF',
  'THE',
  'AND',
  'MR',
  'MRS',
  'MS',
  'DR',
  'ATTY',
  'ENGR',
  'CPA',
  'RN',
  'MD',
  'DDS',
  'DVM',
  'ARCHBISHOP',
  'OFFICE',  // Added
  'LAND',    // Added
  'VALIDITY',
  'CIVIL',
  'STATUS',
  'RIGHT',
  'THUMB',
  'PRINTED',
  'CODE',
  'CONGENITAL',
]);

// Metadata line patterns - skip these entirely
const METADATA_LINE_PATTERNS = [
  /license\s+number/i,
  /license\s+no/i,
  /expiration\s+date/i,
  /valid.*until/i,
  /agency\s+code/i,
  /blood\s+type/i,
  /blood\s+group/i,
  /eye\s+color/i,
  /eyes?\s+color/i,
  /date\s+of\s+birth/i,
  /dob/i,
  /date\s+born/i,
  /weight/i,
  /height/i,
  /restrictions/i,
  /signature/i,
  /validity/i,
  /middle\s+name/i,
  /nationality/i,
  /citizenship/i,
  /sex/i,
  /civil\s+status/i,
  /crn/i,
  /psn/i,
  /id\s+number/i,
  /id\s+no\./i,
  /validity\s+period/i,
  /reference\s+number/i,
  /issued/i,
  /date\s+issued/i,
  /issue\s+date/i,
  /classification/i,
  /class\s+[0-9abc]/i,
  /endorsement/i,
  /category/i,
  /congenital\s+condition/i,
];

/**
 * Check if a word is in the name blacklist
 */
const isBlacklistedWord = (word: string): boolean => {
  return NAME_BLACKLIST.has(word.toUpperCase());
};

/**
 * Check if a line is a metadata/header line
 */
const isMetadataLine = (line: string): boolean => {
  return METADATA_LINE_PATTERNS.some(pattern => pattern.test(line));
};

/**
 * Check if a word is valid as part of a name (not metadata)
 */
const isValidNameWord = (word: string): boolean => {
  // Must be at least 2 characters
  if (word.length < 2) return false;

  // Check blacklist first
  if (isBlacklistedWord(word)) return false;

  // Should NOT be ALL CAPS single letters or very short
  if (word.length === 1) return false;

  // Should be mostly letters (allow apostrophes, hyphens)
  const letterCount = (word.match(/[A-Za-z]/g) || []).length;
  const totalChars = word.replace(/['-]/g, '').length;
  if (totalChars === 0) return false;

  const letterRatio = letterCount / totalChars;
  
  // More strict: require 85% letters for valid names
  return letterRatio >= 0.85;
};

/**
 * Check if a line looks like a person's name
 * - Should have 2-4 words (FIRST LAST / FIRST MIDDLE LAST / LAST, FIRST)
 * - All words should be valid names (not metadata)
 * - Not a metadata/header line
 * - Should NOT be just headers or labels
 */
const isNameLine = (line: string): boolean => {
  // Skip metadata lines entirely
  if (isMetadataLine(line)) return false;

  // Trim and check basic format
  const trimmed = line.trim();
  if (trimmed.length < 5) return false;
  
  // Don't accept lines that are too long (likely OCR garbage)
  if (trimmed.length > 80) return false;

  // Split by space or comma
  const words = trimmed
    .split(/[\s,]+/)
    .map(w => w.trim())
    .filter(w => w.length > 0);

  // Names typically have 2-4 words
  if (words.length < 2 || words.length > 4) return false;

  // All words must be valid name words (no metadata)
  const validWords = words.filter(w => isValidNameWord(w));

  // Must have at least 2 valid name words
  if (validWords.length < 2) return false;

  // Additional check: Don't accept if ANY word is suspiciously short (1-2 chars, except hyphens/apostrophes)
  // Common names are usually longer than 2 characters
  const suspiciousShortWords = words.filter(w => w.length <= 2 && !/['-]/.test(w));
  if (suspiciousShortWords.length > 0) {
    // Allow if it's a hyphenated or apostrophed name (e.g., "O'BRIEN")
    return false;
  }

  return true;
};

/**
 * Extract first and last name from a name line
 */
const extractNameFromLine = (line: string): { firstName: string; lastName: string } => {
  let firstName = '';
  let lastName = '';

  const trimmed = line.trim();

  // Format 1: "LAST, FIRST" or "LAST, FIRST MIDDLE"
  if (trimmed.includes(',')) {
    const [lastPart, firstPart] = trimmed.split(',').map(p => p.trim());

    // Get last name
    const lastWords = lastPart
      .split(/\s+/)
      .filter(w => isValidNameWord(w));
    lastName = lastWords.join(' ');

    // Get first name (first word only)
    const firstWords = firstPart
      .split(/\s+/)
      .filter(w => isValidNameWord(w));
    firstName = firstWords[0] || '';

    return { firstName, lastName };
  }

  // Format 2: "FIRST LAST" or "FIRST MIDDLE LAST"
  const words = trimmed
    .split(/\s+/)
    .filter(w => isValidNameWord(w));

  if (words.length === 2) {
    return {
      firstName: words[0],
      lastName: words[1],
    };
  }

  if (words.length >= 3) {
    return {
      firstName: words[0],
      lastName: words.slice(1).join(' '),
    };
  }

  return { firstName: '', lastName: '' };
};

/**
 * SAFE extraction from OCR text
 * 
 * Strategy:
 * 1. Skip all document headers/metadata lines (first 15+ lines often have them)
 * 2. Look for actual name patterns:
 *    - "LAST, FIRST" or "LAST, FIRST MIDDLE" (Philippine format)
 *    - "FIRST LAST" or "FIRST MIDDLE LAST" (Western format)
 * 3. Validate names are NOT headers or labels
 * 4. Extract address after "Address" keyword or similar
 * 5. Return empty if not confident
 */
export const parseIDText = (ocrText: string): ParsedIDData => {
  try {
    // Split into lines
    const allLines = ocrText
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);

    console.log(`📄 [SAFE PARSER] Processing ${allLines.length} lines...`);

    let firstName = '';
    let lastName = '';
    let address = '';
    let nameLineIndex = -1;

    // STEP 1: Skip document headers and labels (first 15 lines often contain metadata)
    let dataStartIndex = 0;
    for (let i = 0; i < Math.min(15, allLines.length); i++) {
      if (!isMetadataLine(allLines[i]) && allLines[i].length > 4) {
        dataStartIndex = i;
        console.log(`⏭️ Skipped ${i} header/metadata line(s)`);
        break;
      }
    }

    // STEP 2: Find the first valid name line
    // Search in the next ~8 lines after headers
    const searchStart = dataStartIndex;
    const searchEnd = Math.min(searchStart + 8, allLines.length);
    
    for (let i = searchStart; i < searchEnd; i++) {
      const currentLine = allLines[i];
      
      // Skip very short lines
      if (currentLine.length < 5) continue;
      
      // Skip pure metadata lines
      if (isMetadataLine(currentLine)) continue;
      
      if (isNameLine(currentLine)) {
        console.log(`✅ Found name line at ${i}: "${currentLine}"`);
        const nameParts = extractNameFromLine(currentLine);
        
        // Only accept if we got BOTH first and last name
        if (nameParts.firstName && nameParts.lastName) {
          firstName = nameParts.firstName;
          lastName = nameParts.lastName;
          nameLineIndex = i;
          console.log(`   ✓ Extracted: First="${firstName}", Last="${lastName}"`);
          break;
        }
      }
    }

    // STEP 3: Find address (only if we found a valid name)
    if (nameLineIndex !== -1) {
      // Look for address markers
      const addressMarkers = ['address', 'addr', 'street', 'barangay', 'brgy', 'city', 'province'];
      
      for (let i = nameLineIndex + 1; i < allLines.length; i++) {
        const line = allLines[i];
        const lowerLine = line.toLowerCase();
        
        // Check if this line contains an address marker
        const hasAddressMarker = addressMarkers.some(marker => lowerLine.includes(marker));
        
        if (hasAddressMarker) {
          console.log(`📍 Found address marker at line ${i}: "${line}"`);

          // Collect address lines after the marker
          const addressLines: string[] = [];
          
          // Start collecting from next line
          for (let j = i + 1; j < allLines.length && addressLines.length < 3; j++) {
            const addrLine = allLines[j];

            // Stop if we hit metadata
            if (isMetadataLine(addrLine)) {
              console.log(`⏹️ Stopped collecting address at metadata`);
              break;
            }

            // Skip very short lines
            if (addrLine.length < 4) continue;
            
            // Stop if we've collected enough
            if (addressLines.length > 0 && addrLine.length < 10) break;
            
            addressLines.push(addrLine);
          }

          // Join collected address lines
          if (addressLines.length > 0) {
            address = addressLines.join(', ').trim();
            
            // Clean up address - remove common OCR errors
            address = address.replace(/\s+/g, ' '); // Normalize spaces
            
            // Limit length
            if (address.length > 120) {
              console.warn(`⚠️ Address too long, truncating`);
              address = address.substring(0, 120);
            }
            
            console.log(`   ✓ Extracted address: "${address.substring(0, 60)}..."`);
          }
          break;
        }
      }
    }

    // STEP 4: VALIDATION - Reject if validation fails
    const validateName = (name: string): boolean => {
      if (!name || name.length < 2) return false;

      const words = name.split(/\s+/);
      
      // Check if ANY word is blacklisted
      for (const word of words) {
        if (isBlacklistedWord(word)) {
          console.warn(`⚠️ Name contains blacklisted word: "${word}"`);
          return false;
        }
      }

      // Must be mostly letters
      const letterCount = (name.match(/[A-Za-z]/g) || []).length;
      const totalChars = name.replace(/\s/g, '').length;
      if (totalChars > 0 && letterCount / totalChars < 0.75) {
        console.warn(`⚠️ Name has too many non-letters: "${name}"`);
        return false;
      }

      return true;
    };

    // Validate both names
    if (!validateName(firstName)) {
      console.warn(`❌ First name failed validation: "${firstName}"`);
      firstName = '';
    } else {
      console.log(`✓ First name valid: "${firstName}"`);
    }

    if (!validateName(lastName)) {
      console.warn(`❌ Last name failed validation: "${lastName}"`);
      lastName = '';
    } else {
      console.log(`✓ Last name valid: "${lastName}"`);
    }

    // STEP 5: Determine confidence level
    let confidence: 'high' | 'medium' | 'low' = 'low';
    if (firstName && lastName && address.length > 15) {
      confidence = 'high';
    } else if (firstName && lastName) {
      confidence = 'medium';
    }

    console.log(
      `📊 [RESULT] First="${firstName}" Last="${lastName}" Addr="${address.substring(0, 50)}${address.length > 50 ? '...' : ''}" Confidence=${confidence}`
    );

    return {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      address: address.trim(),
      confidence,
      rawOcrText: ocrText,
    };
  } catch (error) {
    console.error('❌ Parse error:', error);
    return {
      firstName: '',
      lastName: '',
      address: '',
      confidence: 'low',
      rawOcrText: ocrText,
    };
  }
};

/**
 * Validate if parsed data is usable
 * Returns true ONLY if name extraction was successful
 */
export const validateParsedData = (data: ParsedIDData): boolean => {
  // Both names required
  if (!data.firstName || !data.lastName) {
    console.warn('❌ Validation failed: Missing name fields');
    return false;
  }

  // No blacklisted words in names
  const checkName = (name: string): boolean => {
    const words = name.split(/\s+/);
    for (const word of words) {
      if (isBlacklistedWord(word)) {
        console.warn(`❌ Blacklisted word in name: "${word}"`);
        return false;
      }
    }
    return true;
  };

  if (!checkName(data.firstName) || !checkName(data.lastName)) {
    return false;
  }

  console.log('✅ Data validation passed');
  return true;
};

/**
 * Format parsed data (uppercase only)
 */
export const formatParsedData = (data: ParsedIDData): Omit<ParsedIDData, 'rawOcrText'> => {
  return {
    firstName: data.firstName.trim().toUpperCase(),
    lastName: data.lastName.trim().toUpperCase(),
    address: data.address.trim(), // Keep original case for address
    confidence: data.confidence,
  };
};

/**
 * Get user-friendly confidence message
 */
export const getConfidenceMessage = (confidence: 'high' | 'medium' | 'low'): string => {
  switch (confidence) {
    case 'high':
      return '✅ HIGH confidence - Data looks accurate. Please review before continuing.';
    case 'medium':
      return '⚠️ MEDIUM confidence - Some fields were extracted. Please verify carefully.';
    case 'low':
      return '❌ LOW confidence - Extraction had difficulty. Please verify and correct manually.';
    default:
      return '';
  }
};
