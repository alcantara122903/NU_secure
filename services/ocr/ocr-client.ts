/**
 * OCR Client Service
 * Sends ID images to Supabase Edge Function `ocr-parse` (preferred).
 * OCR.Space API key stays in Supabase secrets — not in the mobile bundle.
 *
 * Fallback: direct OCR.Space call only if edge function is not deployed and
 * EXPO_PUBLIC_OCR_API_KEY is set (local dev).
 */

import { OCR_SETTINGS } from '@/constants/ocr';
import { supabase } from '@/services/database/supabase';
import { validateAndPrepareImageForOCR } from '@/utils/image-compression';

const OCR_PARSE_FUNCTION = 'ocr-parse';

const OCR_VERBOSE_LOGS = false;

const logInfo = (...args: unknown[]) => {
  if (OCR_VERBOSE_LOGS) console.log(...args);
};

const logWarn = (...args: unknown[]) => {
  if (OCR_VERBOSE_LOGS) console.warn(...args);
};

type OcrEdgeResponse = {
  success: boolean;
  message?: string;
  text?: string | null;
};

/**
 * Parse base64 image string - extract clean base64 and mime type
 */
const parseBase64Image = (base64: string): { cleanBase64: string; mimeType: string } | null => {
  if (!base64 || base64.trim().length === 0) {
    console.error('❌ [VALIDATION] Base64 string is empty');
    return null;
  }

  let cleanBase64 = base64;
  let mimeType = 'image/jpeg';

  if (base64.includes('data:')) {
    const commaIdx = base64.indexOf(',');
    const header = commaIdx > 0 ? base64.slice(0, commaIdx) : '';
    const body = commaIdx > 0 ? base64.slice(commaIdx + 1) : '';
    if (body) {
      cleanBase64 = body;
      const mimeMatch = header.match(/data:([^;]+)/);
      if (mimeMatch) {
        mimeType = mimeMatch[1];
      }
    } else {
      logWarn('⚠️ [VALIDATION] Data URL format is malformed, using defaults');
    }
  } else if (!/^[A-Za-z0-9+/=]+$/.test(cleanBase64)) {
    console.error('❌ [VALIDATION] Base64 string contains invalid characters');
    return null;
  }

  if (cleanBase64.length < OCR_SETTINGS.MIN_BASE64_LENGTH) {
    logWarn(`⚠️ [VALIDATION] Base64 string is very small (${cleanBase64.length} chars)`);
  }

  return { cleanBase64, mimeType };
};

const getFunctionErrorStatus = (error: { context?: { status?: number; Response?: Response } }): number | null => {
  const status = error.context?.status;
  if (typeof status === 'number') {
    return status;
  }
  return null;
};

const invokeOcrEdgeFunction = async (
  body: Record<string, unknown>,
): Promise<OcrEdgeResponse | null> => {
  const { data, error } = await supabase.functions.invoke<OcrEdgeResponse>(OCR_PARSE_FUNCTION, { body });

  if (error) {
    const status = getFunctionErrorStatus(error);
    if (status === 404) {
      logWarn('⚠️ ocr-parse edge function not deployed');
      return null;
    }
    console.error('❌ OCR edge function error:', error.message);
    return { success: false, message: error.message };
  }

  if (!data) {
    return { success: false, message: 'Empty response from OCR edge function' };
  }

  return data;
};

const callOcrSpaceDirect = async (cleanBase64: string, mimeType: string): Promise<string | null> => {
  const apiKey = process.env.EXPO_PUBLIC_OCR_API_KEY?.trim();
  if (!apiKey) {
    console.error('❌ OCR not available: deploy ocr-parse or set EXPO_PUBLIC_OCR_API_KEY for local dev');
    return null;
  }

  logWarn('⚠️ Using direct OCR.Space (dev fallback). Deploy ocr-parse and remove EXPO_PUBLIC_OCR_API_KEY from production builds.');

  const params = new URLSearchParams();
  params.append('apikey', apiKey);
  params.append('base64image', `data:${mimeType};base64,${cleanBase64}`);
  params.append('language', 'eng');
  params.append('isoverlayrequired', 'false');

  const timeoutPlan = [OCR_SETTINGS.REQUEST_TIMEOUT, 90000];
  let response: Response | null = null;
  let lastError: unknown = null;

  for (let attempt = 0; attempt < timeoutPlan.length; attempt += 1) {
    const timeoutMs = timeoutPlan[attempt];
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      response = await fetch(OCR_SETTINGS.API_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
        body: params.toString(),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      break;
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      lastError = err;
      const isAbort = err instanceof Error && err.name === 'AbortError';
      if (isAbort && attempt < timeoutPlan.length - 1) {
        console.warn('⚠️ OCR request timed out on first attempt, retrying once...');
        continue;
      }
      throw err;
    }
  }

  if (!response) {
    throw lastError ?? new Error('OCR request failed');
  }

  if (!response.ok) {
    console.error('❌ Direct OCR HTTP error:', response.status);
    return null;
  }

  const data = (await response.json()) as {
    IsErroredOnProcessing?: boolean;
    ErrorMessage?: string;
    ParsedResults?: Array<{ ParsedText?: string }>;
  };

  if (data.IsErroredOnProcessing || !data.ParsedResults?.[0]?.ParsedText?.trim()) {
    console.error('❌ Direct OCR processing failed:', data.ErrorMessage || 'no text');
    return null;
  }

  return data.ParsedResults[0].ParsedText;
};

/**
 * Extract text from ID image via Supabase OCR proxy (or dev fallback).
 */
export const extractTextFromImageViaOCR = async (
  base64Image: string,
  imageUri?: string | null,
): Promise<string | null> => {
  try {
    const { base64: preparedBase64, warnings } = await validateAndPrepareImageForOCR(base64Image, {
      imageUri,
    });

    if (warnings.length > 0) logWarn('⚠️ Image warnings:', warnings);

    const parsed = parseBase64Image(preparedBase64);
    if (!parsed) {
      console.error('❌ [VALIDATION] Failed to parse base64 image');
      return null;
    }

    const { cleanBase64, mimeType } = parsed;
    logInfo('📤 OCR request via Supabase edge function...');

    const edgeResult = await invokeOcrEdgeFunction({
      base64Image: cleanBase64,
      mimeType,
    });

    if (edgeResult?.success && edgeResult.text?.trim()) {
      logInfo('✅ OCR success (edge function)');
      return edgeResult.text;
    }

    if (edgeResult && !edgeResult.success && edgeResult.message) {
      console.error('❌ OCR edge function:', edgeResult.message);
      return null;
    }

    return await callOcrSpaceDirect(cleanBase64, mimeType);
  } catch (error) {
    const err = error as Error;
    if (err.name === 'AbortError') {
      console.warn('⚠️ OCR request timed out. Please try again.');
    } else if (err.message?.includes('Network') || err.message?.includes('fetch')) {
      console.error('❌ Network error - check internet connection');
    } else {
      console.error('❌ OCR error:', err.message || String(error));
    }
    return null;
  }
};

/**
 * Test OCR connectivity (edge function preferred).
 */
export const testOCRConnection = async (): Promise<{ success: boolean; message: string }> => {
  try {
    const edgeResult = await invokeOcrEdgeFunction({ test: true });

    if (edgeResult?.success) {
      return {
        success: true,
        message: edgeResult.message || '✅ OCR proxy (Supabase edge function) is reachable',
      };
    }

    if (edgeResult && !edgeResult.success) {
      return {
        success: false,
        message: edgeResult.message || '❌ OCR edge function test failed',
      };
    }

    const apiKey = process.env.EXPO_PUBLIC_OCR_API_KEY?.trim();
    if (!apiKey) {
      return {
        success: false,
        message:
          '❌ Deploy supabase function ocr-parse and set OCR_SPACE_API_KEY secret, or set EXPO_PUBLIC_OCR_API_KEY for local dev.',
      };
    }

    const params = new URLSearchParams();
    params.append('apikey', apiKey);
    params.append('url', 'https://api.ocr.space/screenshot');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    const response = await fetch(OCR_SETTINGS.API_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      return {
        success: true,
        message: '✅ Direct OCR.Space OK (dev fallback — deploy ocr-parse for production)',
      };
    }

    return { success: false, message: `❌ OCR.Space HTTP ${response.status}` };
  } catch (error) {
    const err = error as Error;
    return {
      success: false,
      message: `❌ OCR connection test failed: ${err.message}`,
    };
  }
};

export const extractDataFromIDViaBackend = extractTextFromImageViaOCR;
export const testBackendConnection = testOCRConnection;
