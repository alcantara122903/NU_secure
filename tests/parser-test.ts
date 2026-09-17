/**
 * OCR parser fixtures for the five supported visitor IDs.
 * Run with: npx tsx tests/parser-test.ts
 */

import { detectIdType } from '@/services/ocr/id-detector';
import { parseIDText, validateParsedData } from '@/services/ocr/parsers/parser-registry';

type Expectation = {
  idType: string;
  firstName: string;
  lastName: string;
  birthday?: string;
  barangay?: string;
  cityIncludes?: string;
  provinceIncludes?: string;
};

const cases: Array<{ name: string; ocr: string; expect: Expectation }> = [
  {
    name: "Driver's License",
    ocr: `
REPUBLIC OF THE PHILIPPINES
DRIVERS LICENSE
ALCANTARA, VAN VASQUEZ
GULOD ITAAS. BATANGAS CITY (CAPITAL)
BATANGAS, 4200
Date of Birth 12/29/2003
D01-23-004529
`,
    expect: {
      idType: 'drivers_license',
      firstName: 'VAN VASQUEZ',
      lastName: 'ALCANTARA',
      birthday: '2003-12-29',
      barangay: 'GULOD ITAAS',
      cityIncludes: 'BATANGAS',
      provinceIncludes: 'BATANGAS',
    },
  },
  {
    name: 'National ID (PhilSys)',
    ocr: `
REPUBLIKA NG PILIPINAS
PAMBANSANG PAGKAKAKILANLAN
PHILIPPINE IDENTIFICATION CARD
APELYIDO/LAST NAME
SANTOS
MGA PANGALAN/GIVEN NAMES
MARIA CLARA
GITNANG APELYIDO/MIDDLE NAME
REYES
PETSA NG KAPANGANAKAN/DATE OF BIRTH
1998/05/14
TIRAHAN/ADDRESS
012, BANABA WEST, PADRE GARCIA, BATANGAS, PHILIPPINES
DIGITAL ID NUMBER
1234-5678-9012
`,
    expect: {
      idType: 'philsys',
      firstName: 'MARIA CLARA',
      lastName: 'SANTOS',
      birthday: '1998-05-14',
      barangay: 'BANABA',
      cityIncludes: 'PADRE GARCIA',
      provinceIncludes: 'BATANGAS',
    },
  },
  {
    name: 'UMID',
    ocr: `
REPUBLIC OF THE PHILIPPINES
UNIFIED MULTI-PURPOSE ID
UMID
CRN 0111-1234567-8
DELA CRUZ
JUAN MIGUEL
Date of Birth 03/21/1990
MALE
216 BRGY. MALITLIT
LIPA CITY
BATANGAS PHL
`,
    expect: {
      idType: 'umid',
      firstName: 'JUAN MIGUEL',
      lastName: 'DELA CRUZ',
      birthday: '1990-03-21',
      barangay: 'MALITLIT',
      cityIncludes: 'LIPA',
      provinceIncludes: 'BATANGAS',
    },
  },
  {
    name: "Voter's ID",
    ocr: `
REPUBLIC OF THE PHILIPPINES
COMMISSION ON ELECTIONS
COMELEC
LIPA CITY, BATANGAS
RAMOS
ANA LOUISE
Date of Birth
08/09/1988
Address
MALITLIT
MALITLIT LIPA CITY
`,
    expect: {
      idType: 'voters',
      firstName: 'ANA LOUISE',
      lastName: 'RAMOS',
      birthday: '1988-08-09',
      barangay: 'MALITLIT',
      cityIncludes: 'LIPA',
      provinceIncludes: 'BATANGAS',
    },
  },
  {
    name: 'Senior Citizen ID',
    ocr: `
REPUBLIC OF THE PHILIPPINES
OFFICE FOR SENIOR CITIZENS AFFAIRS
CITY OF LIPA
OSCA
GARCIA, ROSA M
NAME
123 PUROK 2, SANTO TORIBIO, LIPA CITY, BATANGAS
ADDRESS
DATE OF BIRTH / AGE
FEBRUARY 18, 1955 / 70
`,
    expect: {
      idType: 'senior_citizen',
      firstName: 'ROSA M',
      lastName: 'GARCIA',
      birthday: '1955-02-18',
      cityIncludes: 'LIPA',
      provinceIncludes: 'BATANGAS',
    },
  },
];

function assertCase(name: string, ocr: string, expect: Expectation): string[] {
  const issues: string[] = [];
  const detected = detectIdType(ocr);
  const result = parseIDText(ocr);

  console.log('\n' + '='.repeat(64));
  console.log(name);
  console.log('='.repeat(64));
  console.log(`Detected: ${detected.type} (${detected.confidence})`);
  console.log(`Parsed type: ${result.detectedIdType}`);
  console.log(`Name: ${result.lastName}, ${result.firstName}`);
  console.log(`Birthday: ${result.birthday}`);
  console.log(`Address: ${result.address}`);
  console.log(
    `Parts → brgy="${result.addressBarangay}" city="${result.addressCityMunicipality}" province="${result.addressProvince}"`,
  );

  if (result.detectedIdType !== expect.idType && detected.type !== expect.idType) {
    issues.push(`ID type expected ${expect.idType}, got ${result.detectedIdType}/${detected.type}`);
  }
  if (result.firstName.toUpperCase() !== expect.firstName.toUpperCase()) {
    issues.push(`firstName expected "${expect.firstName}", got "${result.firstName}"`);
  }
  if (result.lastName.toUpperCase() !== expect.lastName.toUpperCase()) {
    issues.push(`lastName expected "${expect.lastName}", got "${result.lastName}"`);
  }
  if (expect.birthday && result.birthday !== expect.birthday) {
    issues.push(`birthday expected "${expect.birthday}", got "${result.birthday}"`);
  }
  if (
    expect.barangay &&
    !result.addressBarangay.toUpperCase().includes(expect.barangay.toUpperCase())
  ) {
    issues.push(`barangay expected to include "${expect.barangay}", got "${result.addressBarangay}"`);
  }
  if (
    expect.cityIncludes &&
    !result.addressCityMunicipality.toUpperCase().includes(expect.cityIncludes.toUpperCase())
  ) {
    issues.push(
      `city expected to include "${expect.cityIncludes}", got "${result.addressCityMunicipality}"`,
    );
  }
  if (
    expect.provinceIncludes &&
    !result.addressProvince.toUpperCase().includes(expect.provinceIncludes.toUpperCase())
  ) {
    issues.push(
      `province expected to include "${expect.provinceIncludes}", got "${result.addressProvince}"`,
    );
  }
  if (!validateParsedData(result)) {
    issues.push('validateParsedData failed');
  }

  if (issues.length === 0) {
    console.log('✅ PASS');
  } else {
    console.log('❌ FAIL');
    issues.forEach((issue) => console.log(`  - ${issue}`));
  }

  return issues;
}

const allIssues: string[] = [];
for (const testCase of cases) {
  const issues = assertCase(testCase.name, testCase.ocr, testCase.expect);
  allIssues.push(...issues.map((i) => `${testCase.name}: ${i}`));
}

console.log('\n' + '='.repeat(64));
if (allIssues.length === 0) {
  console.log('ALL ID PARSER FIXTURES PASSED');
  process.exit(0);
} else {
  console.log(`FAILED (${allIssues.length} issue(s))`);
  allIssues.forEach((i) => console.log(`  - ${i}`));
  process.exit(1);
}
