/**
 * Image Compression Utility
 * Resizes and compresses images before OCR.Space upload.
 * Prefer local file URI (camera/gallery). Base64 path writes bytes (1-arg File.write).
 */

import { File, Paths } from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';

const IMAGE_PREP_VERBOSE_LOGS = false;

/** Max width for OCR — readable text, much smaller upload */
export const OCR_MAX_WIDTH = 1200;
/** JPEG quality for OCR (~0.55 balances speed vs accuracy) */
export const OCR_JPEG_QUALITY = 0.55;
/** Compress when larger than this (KB of base64 string approx) */
export const OCR_COMPRESS_THRESHOLD_KB = 350;

const logInfo = (...args: unknown[]) => {
  if (IMAGE_PREP_VERBOSE_LOGS) console.log(...args);
};

const logWarn = (...args: unknown[]) => {
  if (IMAGE_PREP_VERBOSE_LOGS) console.warn(...args);
};

const stripDataUrlPrefix = (base64DataUrl: string): string => {
  if (base64DataUrl.includes('data:') && base64DataUrl.includes(',')) {
    return base64DataUrl.split(',')[1] ?? base64DataUrl;
  }
  return base64DataUrl;
};

/** Decode base64 → bytes (iOS File.write accepts only 1 arg, not encoding options). */
const base64ToUint8Array = (base64: string): Uint8Array => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};

/**
 * Write a base64 / data-URL image to a temp cache file so ImageManipulator can open it.
 */
const writeTempImageFromBase64 = (base64DataUrl: string): File => {
  const clean = stripDataUrlPrefix(base64DataUrl);
  const file = new File(Paths.cache, `ocr-prep-${Date.now()}.jpg`);
  if (!file.exists) {
    file.create({ intermediates: true, overwrite: true });
  }
  // Native bridge expects a single content argument (string | Uint8Array).
  file.write(base64ToUint8Array(clean));
  return file;
};

const runManipulate = async (
  sourceUri: string,
  maxQuality: number,
  maxWidth: number,
): Promise<string | null> => {
  const result = await ImageManipulator.manipulateAsync(
    sourceUri,
    [{ resize: { width: maxWidth } }],
    {
      compress: maxQuality,
      format: ImageManipulator.SaveFormat.JPEG,
      base64: true,
    },
  );
  if (!result.base64) {
    return null;
  }
  return `data:image/jpeg;base64,${result.base64}`;
};

/**
 * Compress from a local file URI (camera / gallery). Preferred path — no temp write.
 */
export const compressImageUriForOCR = async (
  uri: string,
  maxQuality: number = OCR_JPEG_QUALITY,
  maxWidth: number = OCR_MAX_WIDTH,
): Promise<{ uri: string; base64DataUrl: string }> => {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: maxWidth } }],
    {
      compress: maxQuality,
      format: ImageManipulator.SaveFormat.JPEG,
      base64: true,
    },
  );

  if (!result.base64) {
    throw new Error('Image compression produced no base64 output');
  }

  return {
    uri: result.uri,
    base64DataUrl: `data:image/jpeg;base64,${result.base64}`,
  };
};

/**
 * Resize (~1200px wide) + JPEG ~0.55 via expo-image-manipulator.
 */
export const compressBase64Image = async (
  base64DataUrl: string,
  maxQuality: number = OCR_JPEG_QUALITY,
  maxWidth: number = OCR_MAX_WIDTH,
  _maxHeight: number = 600,
): Promise<string> => {
  let tempFile: File | null = null;
  try {
    logInfo('[Compression] Starting image compression...');
    logInfo(`   Input size: ${(base64DataUrl.length / 1024).toFixed(2)} KB`);
    logInfo(`   Target quality: ${maxQuality * 100}%`);
    logInfo(`   Max width: ${maxWidth}px`);

    tempFile = writeTempImageFromBase64(base64DataUrl);
    const output = await runManipulate(tempFile.uri, maxQuality, maxWidth);

    if (!output) {
      logWarn('[Compression] No base64 from manipulator; returning original');
      return base64DataUrl;
    }

    logInfo('[Compression] Compression complete');
    logInfo(`   Output size: ${(output.length / 1024).toFixed(2)} KB`);
    return output;
  } catch (error) {
    console.error('[Compression] Error during compression:', error);
    return base64DataUrl;
  } finally {
    if (tempFile?.exists) {
      try {
        tempFile.delete();
      } catch {
        // ignore cleanup errors
      }
    }
  }
};

/**
 * Estimate base64 size in KB
 */
export const estimateBase64SizeKB = (base64: string): number => {
  return Math.round((base64.length / 1024) * 100) / 100;
};

/**
 * Check if base64 image is too large for efficient OCR processing
 */
export const isImageTooLarge = (
  base64: string,
  thresholdKB: number = OCR_COMPRESS_THRESHOLD_KB,
): boolean => {
  const sizeKB = estimateBase64SizeKB(base64);
  logInfo(`[ImageValidation] Base64 size: ${sizeKB} KB (threshold: ${thresholdKB} KB)`);
  return sizeKB > thresholdKB;
};

export type PrepareImageForOCROptions = {
  /** Prefer this local URI (camera/gallery) — avoids base64 temp-file write. */
  imageUri?: string | null;
};

/**
 * Validate and prepare image for OCR — resize/compress to OCR-friendly JPEG.
 */
export const validateAndPrepareImageForOCR = async (
  base64DataUrl: string,
  options: PrepareImageForOCROptions = {},
): Promise<{
  base64: string;
  sizeKB: number;
  isCompressed: boolean;
  warnings: string[];
}> => {
  const warnings: string[] = [];
  const originalSizeKB = estimateBase64SizeKB(base64DataUrl);
  logInfo(`\n📊 [OCR Preparation] Image validation:`);
  logInfo(`   Original size: ${originalSizeKB} KB`);

  if (originalSizeKB > 1000) {
    warnings.push(`Large image (${originalSizeKB} KB) — compressing for OCR`);
    logWarn(`⚠️  ${warnings[warnings.length - 1]}`);
  }

  let finalBase64 = base64DataUrl;
  let isCompressed = false;

  try {
    const uri = options.imageUri?.trim();
    if (uri && (uri.startsWith('file://') || uri.startsWith('content://') || uri.startsWith('ph://'))) {
      logInfo('[OCR Preparation] Compressing from local URI…');
      const compressed = await compressImageUriForOCR(uri);
      finalBase64 = compressed.base64DataUrl;
      isCompressed = true;
    } else {
      finalBase64 = await compressBase64Image(
        base64DataUrl,
        OCR_JPEG_QUALITY,
        OCR_MAX_WIDTH,
      );
      isCompressed = finalBase64 !== base64DataUrl;
    }
  } catch (error) {
    console.error('[OCR Preparation] Compression failed, using original:', error);
    warnings.push('Compression failed — using original image');
    // Fallback: try base64 path once if URI path failed
    if (options.imageUri) {
      try {
        finalBase64 = await compressBase64Image(base64DataUrl);
        isCompressed = finalBase64 !== base64DataUrl;
      } catch {
        // keep original
      }
    }
  }

  const finalSizeKB = estimateBase64SizeKB(finalBase64);
  logInfo(`   Final size: ${finalSizeKB} KB`);
  logInfo(`   Compressed: ${isCompressed ? 'Yes' : 'No'}\n`);

  return {
    base64: finalBase64,
    sizeKB: finalSizeKB,
    isCompressed,
    warnings,
  };
};
