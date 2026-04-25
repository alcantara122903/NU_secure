/**
 * Philippine ID Type Detector
 * Analyzes OCR raw text to identify the document type
 * Returns the detected ID type so the correct parser can be used
 * 
 * Supported ID Types (17):
 * 1. PhilSys ID, 2. Passport, 3. Driver's License, 4. UMID, 5. PRC ID
 * 6. TIN ID, 7. Postal ID, 8. Voter's ID, 9. Senior Citizen ID, 10. PWD ID
 * 11. PhilHealth ID, 12. SSS ID, 13. School ID, 14. Company/Employee ID
 * 15. Barangay ID/Clearance, 16. Police Clearance, 17. NBI Clearance
 */

import type { IDType, IDTypeDetectionResult } from '@/types/ocr';

/**
 * Detects ID type from OCR raw text
 * Returns the most likely ID type based on keyword matching
 */
export function detectIdType(rawOcrText: string): IDTypeDetectionResult {
  const upperText = rawOcrText.toUpperCase();
  const detectedKeywords: string[] = [];

  const typeScores: Record<IDType, number> = {
    philsys: 0,
    passport: 0,
    drivers_license: 0,
    umid: 0,
    prc: 0,
    tin: 0,
    postal: 0,
    voters: 0,
    senior_citizen: 0,
    pwd: 0,
    philhealth: 0,
    sss: 0,
    school: 0,
    company: 0,
    barangay: 0,
    police_clearance: 0,
    nbi_clearance: 0,
    unknown: 0,
  };

  // PhilSys ID detection
  if (
    upperText.includes('PHILIPPINE IDENTIFICATION') ||
    upperText.includes('PHILIPPINE IDENTIFICATION CARD') ||
    upperText.includes('PHILSYS') ||
    upperText.includes('PSN') ||
    upperText.includes('PAMBANSANG PAGKAKAKILANLAN') ||
    upperText.includes('PAGKAKAKILANLAN') ||
    (upperText.includes('NATIONAL ID') && upperText.includes('PHILIPPINES')) ||
    (upperText.includes('REPUBLIKA NG PILIPINAS') && upperText.includes('PILIPINAS')) ||
    (upperText.includes('APELYIDO') && upperText.includes('MGA PANGALAN')) ||
    (upperText.includes('LAST NAME') && upperText.includes('GIVEN NAMES'))
  ) {
    typeScores.philsys += 3;
    detectedKeywords.push('PhilSys keywords found');
  }

  // Passport detection
  if (
    upperText.includes('PASSPORT') ||
    upperText.includes('P<PHL') ||
    (upperText.includes('REPUBLIC OF THE PHILIPPINES') && upperText.includes('PASSPORT'))
  ) {
    typeScores.passport += 3;
    detectedKeywords.push('Passport keywords found');
  }

  // Driver's License detection
  if (
    upperText.includes("DRIVER'S LICENSE") ||
    upperText.includes('DRIVERS LICENSE') ||
    upperText.includes('LAND TRANSPORTATION OFFICE') ||
    upperText.includes('LTO')
  ) {
    typeScores.drivers_license += 3;
    detectedKeywords.push('Driver\'s License keywords found');
  }

  // UMID detection
  if (
    upperText.includes('UMID') ||
    (upperText.includes('UNIFIED MULTI-PURPOSE') && upperText.includes('IDENTIFICATION'))
  ) {
    typeScores.umid += 3;
    detectedKeywords.push('UMID keywords found');
  }

  // PRC ID detection
  if (
    upperText.includes('PROFESSIONAL REGULATION COMMISSION') ||
    (upperText.includes('PRC') && upperText.includes('PROFESSIONAL'))
  ) {
    typeScores.prc += 3;
    detectedKeywords.push('PRC keywords found');
  }

  // TIN ID detection
  if (
    upperText.includes('BUREAU OF INTERNAL REVENUE') ||
    upperText.includes('BIR') ||
    (upperText.includes('TIN') && upperText.includes('TAXPAYER'))
  ) {
    typeScores.tin += 3;
    detectedKeywords.push('TIN keywords found');
  }

  // Postal ID detection
  if (
    upperText.includes('POSTAL') ||
    upperText.includes('PHLPOST') ||
    upperText.includes('PHILIPPINE POSTAL CORPORATION')
  ) {
    typeScores.postal += 3;
    detectedKeywords.push('Postal ID keywords found');
  }

  // Voter's ID detection
  if (
    upperText.includes('COMELEC') ||
    (upperText.includes('VOTER') && upperText.includes('CERTIFICATE'))
  ) {
    typeScores.voters += 3;
    detectedKeywords.push('Voter\'s ID keywords found');
  }

  // Senior Citizen ID detection
  if (
    upperText.includes('SENIOR CITIZEN') ||
    upperText.includes('SENIOR CITIZEN ID')
  ) {
    typeScores.senior_citizen += 3;
    detectedKeywords.push('Senior Citizen ID keywords found');
  }

  // PWD ID detection
  if (
    upperText.includes('PERSONS WITH DISABILITY') ||
    upperText.includes('PWD') ||
    upperText.includes('PERSON WITH DISABILITY')
  ) {
    typeScores.pwd += 3;
    detectedKeywords.push('PWD ID keywords found');
  }

  // PhilHealth ID detection
  if (upperText.includes('PHILHEALTH')) {
    typeScores.philhealth += 3;
    detectedKeywords.push('PhilHealth ID keywords found');
  }

  // SSS ID detection
  if (
    upperText.includes('SOCIAL SECURITY SYSTEM') ||
    (upperText.includes('SSS') && !upperText.includes('UMID'))
  ) {
    typeScores.sss += 3;
    detectedKeywords.push('SSS keywords found');
  }

  // School ID detection
  if (
    upperText.includes('STUDENT') ||
    upperText.includes('SCHOOL') ||
    upperText.includes('UNIVERSITY') ||
    upperText.includes('COLLEGE') ||
    upperText.includes('REGISTRATION FORM') ||
    upperText.includes('INSTITUTION')
  ) {
    typeScores.school += 2;
    detectedKeywords.push('School ID keywords found');
  }

  // Company / Employee ID detection
  if (
    upperText.includes('EMPLOYEE') ||
    upperText.includes('COMPANY') ||
    upperText.includes('CORPORATION') ||
    upperText.includes('DEPARTMENT') ||
    (upperText.includes('ID') &&
      (upperText.includes('INC.') || upperText.includes('LTD.') || upperText.includes('CORP')))
  ) {
    typeScores.company += 2;
    detectedKeywords.push('Company/Employee ID keywords found');
  }

  // Barangay ID / Clearance detection
  if (
    upperText.includes('BARANGAY') &&
    (upperText.includes('ID') || upperText.includes('CLEARANCE'))
  ) {
    typeScores.barangay += 3;
    detectedKeywords.push('Barangay ID/Clearance keywords found');
  }

  // Police Clearance detection
  if (
    upperText.includes('POLICE') &&
    upperText.includes('CLEARANCE')
  ) {
    typeScores.police_clearance += 3;
    detectedKeywords.push('Police Clearance keywords found');
  }

  // NBI Clearance detection
  if (
    upperText.includes('NATIONAL BUREAU OF INVESTIGATION') ||
    (upperText.includes('NBI') && upperText.includes('CLEARANCE'))
  ) {
    typeScores.nbi_clearance += 3;
    detectedKeywords.push('NBI Clearance keywords found');
  }

  // Find the ID type with the highest score
  let detectedType: IDType = 'unknown';
  let maxScore = 0;

  for (const [type, score] of Object.entries(typeScores)) {
    if (score > maxScore) {
      maxScore = score;
      detectedType = type as IDType;
    }
  }

  // Determine confidence level
  let confidence: 'high' | 'medium' | 'low' = 'low';
  if (maxScore >= 3) {
    confidence = 'high';
  } else if (maxScore >= 2) {
    confidence = 'medium';
  } else {
    confidence = 'low';
  }

  console.log(`\n📋 ID TYPE DETECTION`);
  console.log(`   Detected: ${detectedType.toUpperCase()}`);
  console.log(`   Confidence: ${confidence}`);
  console.log(`   Keywords: ${detectedKeywords.join(', ') || 'none specific'}`);

  return {
    type: detectedType,
    confidence,
    detectedKeywords,
  };
}
