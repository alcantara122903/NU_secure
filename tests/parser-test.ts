/**
 * Quick test for OCR parser - especially driver's license address extraction
 * Run with: npx ts-node tests/parser-test.ts
 */

import { parseIDText, validateParsedData } from '@/services/ocr/parsers/parser-registry';

// Test case: Real driver's license OCR from conversation summary
// Raw OCR text: "GULOD ITAAS. BATANGAS CITY (CAPITAL)"
const driverLicenseSampleOCR = `
REPUBLIC OF THE PHILIPPINES
DRIVERS LICENSE

ALCANTARA, VAN VASQUEZ

GULOD ITAAS. BATANGAS CITY (CAPITAL)
`;

console.log('='.repeat(60));
console.log('DRIVER\'S LICENSE PARSER TEST');
console.log('='.repeat(60));

const result = parseIDText(driverLicenseSampleOCR);

console.log('\n' + '='.repeat(60));
console.log('FINAL PARSED RESULT:');
console.log('='.repeat(60));
console.log(`First Name: "${result.firstName}"`);
console.log(`Last Name: "${result.lastName}"`);
console.log(`Address: "${result.address}"`);
console.log(`\nAddress Components:`);
console.log(`  House No: "${result.addressHouseNo}"`);
console.log(`  Street: "${result.addressStreet}"`);
console.log(`  Barangay: "${result.addressBarangay}"`);
console.log(`  City/Municipality: "${result.addressCityMunicipality}"`);
console.log(`  Province: "${result.addressProvince}"`);
console.log(`  Region: "${result.addressRegion}"`);
console.log(`\nConfidence: ${result.confidence}`);
console.log(`ID Type: ${result.detectedIdType}`);

// Validate
const isValid = validateParsedData(result);
console.log(`\nValidation: ${isValid ? '✅ PASS' : '❌ FAIL'}`);

// Check specific fields we expect
const issues: string[] = [];
if (!result.firstName) issues.push('First Name is empty');
if (!result.lastName) issues.push('Last Name is empty');
if (!result.addressBarangay) issues.push('Barangay is empty (EXPECTED: GULOD ITAAS)');
if (!result.addressCityMunicipality) issues.push('City/Municipality is empty (EXPECTED: BATANGAS CITY)');

if (issues.length > 0) {
  console.log(`\n⚠️ ISSUES DETECTED:`);
  issues.forEach(issue => console.log(`  - ${issue}`));
} else {
  console.log(`\n✅ All expected fields extracted!`);
}
