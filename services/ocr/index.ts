/**
 * OCR Service Barrel Export
 * Unified interface for OCR functionality
 */

export { detectIdType } from './id-detector';
export { extractDataFromIDViaBackend, extractTextFromImageViaOCR, testBackendConnection, testOCRConnection } from './ocr-client';
export {
    cleanField, formatParsedData,
    getConfidenceMessage, parseIDText,
    validateParsedData
} from './parsers/parser-registry';

export type { IDType, IDTypeDetectionResult, OCRExtractionResult, ParsedIDData } from '@/types/ocr';

