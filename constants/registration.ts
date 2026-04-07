/**
 * Registration flow constants
 */

export const REGISTRATION_STEPS = {
  FACIAL_CAPTURE: 1,
  ID_DOCUMENT_CAPTURE: 2,
  ENROLLEE_INFO: 3,
} as const;

export const STEP_LABELS: Record<number, string> = {
  1: 'Capture Face',
  2: 'Capture ID',
  3: 'Confirm Information',
};

export const OFFICES = [
  'Admission Office',
  'Health Services Office',
  "Guidance's Service Office",
  "Registrar's Office",
  'Treasury Office',
  'SDAO',
  'BULLDOGS Exchange',
  'ITSO',
  'FAQ',
  'HR Office',
] as const;

export const VISITOR_TYPES = {
  ENROLLEE: 'enrollee',
  CONTRACTOR: 'contractor',
  NORMAL: 'normal',
} as const;

export const EXTRACTION_CONFIDENCE_MESSAGES: Record<'high' | 'medium' | 'low', string> = {
  high: '✅ High Confidence - Data extracted accurately',
  medium: '⚠️ Medium Confidence - Please verify the fields',
  low: '⚠️ Low Confidence - Please review and correct',
};
