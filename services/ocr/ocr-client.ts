/**
 * OCR Client Service
 * Handles communication with OCR.Space API
 * Converts images to text for ID document analysis
 * 
 * Uses OCR.Space API (cloud-based):
 * - No local backend required
 * - Works from any network with internet
 * - REST API endpoint: https://api.ocr.space/parse/image
 * - Supports multiple languages and document types
 * - Uses EXPO_PUBLIC_OCR_API_KEY environment variable
 */

import { OCR_SETTINGS } from '@/constants/ocr';
import { validateAndPrepareImageForOCR } from '@/utils/image-compression';

/**
 * Parse base64 image string - extract clean base64 and mime type
 * OCR.Space API requires base64image parameter in format: data:<mime_type>;base64,<base64_string>
 */
const parseBase64Image = (base64: string): { cleanBase64: string; mimeType: string } | null => {
  if (!base64 || base64.trim().length === 0) {
    console.error('❌ [VALIDATION] Base64 string is empty');
    return null;
  }

  let cleanBase64 = base64;
  let mimeType = 'image/jpeg';
  
  if (base64.includes('data:')) {
    const matches = base64.match(/^data:([^;]+);base64,(.+)$/);
    if (matches && matches.length === 3) {
      mimeType = matches[1];
      cleanBase64 = matches[2];
    } else {
      console.warn('⚠️ [VALIDATION] Data URL format is malformed, using defaults');
      const parts = base64.split(',');
      if (parts.length === 2) {
        cleanBase64 = parts[1];
        const mimeMatch = parts[0].match(/data:([^;]+)/);
        if (mimeMatch) {
          mimeType = mimeMatch[1];
        }
      }
    }
  } else {
    if (!/^[A-Za-z0-9+/=]+$/.test(cleanBase64)) {
      console.error('❌ [VALIDATION] Base64 string contains invalid characters');
      console.error(`   First 100 chars: ${cleanBase64.substring(0, 100)}`);
      return null;
    }
  }

  if (cleanBase64.length < OCR_SETTINGS.MIN_BASE64_LENGTH) {
    console.warn(`⚠️ [VALIDATION] Base64 string is very small (${cleanBase64.length} chars), may not be valid image`);
  }

  return { cleanBase64, mimeType };
};

/**
 * Extract text from ID image using OCR.Space API
 */
export const extractTextFromImageViaOCR = async (base64Image: string): Promise<string | null> => {
  try {
    // Validate and prepare image
    const { base64: preparedBase64, sizeKB, warnings } = await validateAndPrepareImageForOCR(base64Image);
    
    if (warnings.length > 0) {
      console.warn('⚠️ Image warnings:', warnings);
    }
    
    const apiKey = process.env.EXPO_PUBLIC_OCR_API_KEY;

    if (!apiKey) {
      console.error('❌ OCR_SPACE_API_KEY environment variable not set');
      console.error('   Please set EXPO_PUBLIC_OCR_API_KEY in .env.local');
      return null;
    }

    console.log('\n========== OCR.Space API Request ==========');
    console.log('📤 Sending image to OCR.Space API...');
    console.log(`   Image size: ${sizeKB} KB`);
    console.log(`   Input prefix: ${preparedBase64.substring(0, 50)}...`);

    const parsed = parseBase64Image(preparedBase64);
    if (!parsed) {
      console.error('❌ [VALIDATION] Failed to parse base64 image');
      return null;
    }

    const { cleanBase64, mimeType } = parsed;
    console.log(`✅ Base64 validation passed`);
    console.log(`   Mime type: ${mimeType}`);
    console.log(`   Clean base64 length: ${cleanBase64.length} chars`);

    // Remove data: prefix if present - send only base64
    const base64ForAPI = cleanBase64;
    
    console.log(`   Final base64 (first 100 chars): ${base64ForAPI.substring(0, 100)}...`);

    // Use URL-encoded form data (more compatible with React Native/Expo than FormData)
    const params = new URLSearchParams();
    params.append('apikey', apiKey);
    params.append('base64image', `data:${mimeType};base64,${base64ForAPI}`);
    params.append('language', 'eng');
    params.append('isoverlayrequired', 'false');

    console.log('✅ Request payload prepared');
    console.log('   Method: URL-encoded form data');
    console.log('   Fields: apikey, base64image, language, isoverlayrequired');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), OCR_SETTINGS.REQUEST_TIMEOUT);

    console.log(`⏳ Sending request to OCR.Space (timeout: ${OCR_SETTINGS.REQUEST_TIMEOUT / 1000}s)...`);
    console.log('   ⚠️ Please wait - this may take 30-60 seconds for slower networks');

    const response = await fetch(OCR_SETTINGS.API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: params.toString(),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      let errorData: any = {};
      try {
        errorData = await response.json();
      } catch (e) {
        // Response not JSON
      }

      const errorMsg = errorData?.error?.errorDetail || `HTTP ${response.status}`;
      console.error('❌ HTTP error:', errorMsg);
      return null;
    }

    const data = await response.json();

    console.log('\n🔍 [DEBUG] Raw OCR.Space Response:');
    console.log(JSON.stringify(data, null, 2));
    
    console.log('\n📋 Response Structure:');
    console.log(`   IsErroredOnProcessing: ${data.IsErroredOnProcessing}`);
    console.log(`   ErrorMessage: "${data.ErrorMessage || 'none'}"`);
    console.log(`   ParsedResults exists: ${!!data.ParsedResults}`);
    console.log(`   ParsedResults length: ${data.ParsedResults?.length || 0}`);
    
    if (data.ParsedResults && data.ParsedResults.length > 0) {
      console.log(`   ParsedResults[0].ParsedText length: ${data.ParsedResults[0].ParsedText?.length || 0}`);
      console.log(`   ParsedResults[0].Confidence: ${data.ParsedResults[0].Confidence || 'N/A'}`);
    }

    if (data.IsErroredOnProcessing) {
      console.error('❌ [OCR FAILURE] OCR.Space API reported processing error');
      console.error(`   ErrorMessage: ${data.ErrorMessage}`);
      return null;
    }

    if (!data.ParsedResults || data.ParsedResults.length === 0) {
      console.error('❌ [OCR FAILURE] No ParsedResults from OCR.Space');
      return null;
    }

    const parsedText = data.ParsedResults[0].ParsedText;

    if (!parsedText || parsedText.trim().length === 0) {
      console.error('❌ [OCR FAILURE] ParsedText is empty or missing');
      return null;
    }

    console.log(`\n✅ [OCR SUCCESS] Received raw text from OCR.Space`);
    console.log(`   Text length: ${parsedText.length} characters`);
    console.log(`   Lines: ${parsedText.trim().split('\n').length}`);
    console.log(`\n📝 Text Preview (first 300 chars):`);
    console.log(`   ${parsedText.substring(0, 300).replace(/\n/g, ' | ')}`);
    console.log('========================================\n');
    
    return parsedText;
  } catch (error) {
    const err = error as any;

    if (err.name === 'AbortError') {
      console.error('❌ OCR request timed out (>60 seconds)');
    } else if (err.message?.includes('Network') || err.message?.includes('fetch')) {
      console.error('❌ Network error - check internet connection');
    } else {
      console.error('❌ Error calling OCR.Space API:', err?.message || String(error));
    }
    console.log('========================================\n');

    return null;
  }
};

/**
 * Test if OCR.Space API is reachable
 */
export const testOCRConnection = async (): Promise<{ success: boolean; message: string }> => {
  try {
    console.log('🔌 Testing connection to OCR.Space API...');
    console.log(`   Endpoint: ${OCR_SETTINGS.API_ENDPOINT}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const params = new URLSearchParams();
    const apiKey = process.env.EXPO_PUBLIC_OCR_API_KEY;
    if (apiKey) {
      params.append('apikey', apiKey);
    }
    params.append('url', 'https://api.ocr.space/screenshot');

    const response = await fetch(OCR_SETTINGS.API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      console.log('✅ OCR.Space API connection successful!');
      return {
        success: true,
        message: `✅ Connected to OCR.Space API!`,
      };
    } else {
      console.error('❌ OCR.Space API returned error status:', response.status);
      const data = await response.json().catch(() => ({}));
      return {
        success: false,
        message: `❌ OCR.Space API error: ${data.ErrorMessage || `HTTP ${response.status}`}`,
      };
    }
  } catch (error) {
    const err = error as any;
    console.error('❌ Connection test failed:', err.message);

    let message = '❌ Cannot connect to OCR.Space API\n';
    message += `   Endpoint: ${OCR_SETTINGS.API_ENDPOINT}\n`;
    message += `   Error: ${err.message}\n\n`;
    message += 'Troubleshooting:\n';
    message += '1. Check internet connection (OCR.Space is cloud-based)\n';
    message += '2. Verify device has access to https://api.ocr.space\n';
    message += '3. Check firewall/proxy settings\n';

    return { success: false, message };
  }
};

// Backward compatibility exports
export const extractDataFromIDViaBackend = extractTextFromImageViaOCR;
export const testBackendConnection = testOCRConnection;
