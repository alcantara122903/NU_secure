/**
 * DEPRECATED: Backward compatibility re-export
 * This file is maintained for compatibility with existing code.
 * All parsing logic has been moved to services/ocr/parsers/parser-registry.ts
 * 
 * New code should import from: @/services/ocr
 */

export type { ParsedIDData } from '@/types/ocr';
export {
  cleanField,
  formatParsedData,
  getConfidenceMessage,
  parseIDText,
  validateParsedData
} from './ocr/parsers/parser-registry';

