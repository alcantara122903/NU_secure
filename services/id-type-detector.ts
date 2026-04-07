/**
 * DEPRECATED: Backward compatibility re-export
 * This file is maintained for compatibility with existing code.
 * New code should import from: @/services/ocr
 */

export type { IDType, IDTypeDetectionResult } from '@/types/ocr';
export { detectIdType } from './ocr/id-detector';

