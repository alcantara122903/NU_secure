/**
 * DEPRECATED: Backward compatibility re-export
 * This file is maintained for compatibility with existing code.
 * All OCR functionality has been moved to services/ocr/ocr-client.ts
 * 
 * New code should import from: @/services/ocr
 */

export {
    extractDataFromIDViaBackend, extractTextFromImageViaOCR, testBackendConnection, testOCRConnection
} from '@/services/ocr/ocr-client';

